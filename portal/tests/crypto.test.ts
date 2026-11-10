import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { LOCALES } from "../src/i18n/config";
import { defaultSettings } from "../src/lib/tenant-defaults";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

// Key versioning and rotation (ADR: one previous key, no KMS): v1 ciphertexts written before the change, v2 key ids,
// the rotate script, backup codes and domain proofs under either key, and one verified domain per organisation.
const h = vi.hoisted(() => {
  const CURRENT = "test-only-app-secret-0123456789-abcdefghij-0123456789";
  const PREVIOUS = "previous-test-only-app-secret-9876543210-zyxwvutsrq";
  return {
    CURRENT,
    PREVIOUS,
    db: undefined as unknown,
    env: { secret: CURRENT, previousSecret: undefined as string | undefined, domainProofSecret: CURRENT, isProd: false, TRUST_PROXY: 0, showOtp: false },
    viewer: { user: { id: "00000000-0000-4000-8000-000000000001", email: "op@platform.test", locale: "en" }, tenant: { id: "", name: "Org", settings: {} } },
    txt: new Map<string, string[][]>(),
    audits: [] as { action: string; meta?: Record<string, unknown> }[],
  };
});
const { CURRENT, PREVIOUS } = h;
/** Sealed by the v1 code (no key id) under CURRENT: the format every installation holds today. Must stay readable. */
const V1_FIXTURE = "v1:HQEc9Jtx7qwJzsqc:ShQZ_3JBYvHc3honIgHd_w:WhUdNklQGLIXSNCx6t6GWUPlFOLklAUWfQBMRkw";
const V1_PLAIN = "smtp-password-before-rotation";
const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
/** domainProofRecord(TENANT_A, CURRENT) as published before the change: existing TXT records must keep verifying. */
const PROOF_FIXTURE = "cyclowareness-verify=2b103e34c7e6c77a591191d2";

vi.stubEnv("APP_SECRET", CURRENT);
vi.mock("../src/server/env", () => ({ env: h.env, appUrl: () => "http://localhost:3000" }));
vi.mock("../src/server/db", async () => ({ db: () => h.db, dbHandle: () => ({ driver: "pglite", db: h.db }), t: await import("../src/server/db/schema") }));
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => h.viewer, hasFeature: () => true }));
vi.mock("../src/server/services/audit", () => ({ audit: async (_db: unknown, entry: { action: string }) => void h.audits.push(entry) }));
vi.mock("../src/server/mail", () => ({ sendTestEmail: vi.fn(), resendableMail: vi.fn(), queueEmail: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null, userAgent: async () => null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key, getFormatter: async () => ({ dateTime: () => "today" }) }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    async resolveTxt(name: string) {
      const v = h.txt.get(name);
      if (!v) throw Object.assign(new Error("queryTxt ENODATA"), { code: "ENODATA" });
      return v;
    }
  },
}));

const { decryptSecret, encryptSecret, sealedWithCurrentKey } = await import("../src/server/crypto");
const { backupCodeHashes, hashBackupCode, legacyBackupHash } = await import("../src/server/auth/totp");
const { domainProofFound, domainProofRecord, domainProofRecords } = await import("../src/server/auth/domain-proof");
const { countVerifiedDomains, rotateStoredSecrets, rotationRefusal } = await import("../src/server/services/secret-rotation");
const { verifyDomainAction } = await import("../src/server/actions/settings");
const { verifyTenantDomainAction } = await import("../src/server/actions/platform");

const kidOf = (sealed: string) => sealed.split(":")[1];
const sealedWith = (secret: string, plain: string) => {
  vi.stubEnv("APP_SECRET", secret);
  try {
    return encryptSecret(plain);
  } finally {
    vi.stubEnv("APP_SECRET", CURRENT);
  }
};
const rotation = (on: boolean) => {
  vi.stubEnv("APP_SECRET_PREVIOUS", on ? PREVIOUS : "");
  h.env.previousSecret = on ? PREVIOUS : undefined;
};

const { db, ready } = testDb();
beforeAll(async () => {
  await ready();
  h.db = db;
}, DB_SETUP_TIMEOUT);
beforeEach(() => {
  rotation(false);
  h.txt.clear();
  h.audits.length = 0;
});

describe("ciphertext versions", () => {
  it("still opens a v1 ciphertext written before key ids existed", () => {
    expect(decryptSecret(V1_FIXTURE)).toBe(V1_PLAIN);
    expect(sealedWithCurrentKey(V1_FIXTURE)).toBe(false);
  });

  it("writes v2 with the current key's id and opens it by that id after the secret moved to APP_SECRET_PREVIOUS", () => {
    const sealed = encryptSecret("ldap-bind-password");
    expect(sealed).toMatch(/^v2:[0-9a-f]{8}:/);
    // The id is derived with its own label, never the plain hash of the secret.
    expect(kidOf(sealed)).toBe(createHash("sha256").update(`kid:${CURRENT}`).digest("hex").slice(0, 8));
    expect(kidOf(sealed)).not.toBe(createHash("sha256").update(CURRENT).digest("hex").slice(0, 8));
    expect(sealedWithCurrentKey(sealed)).toBe(true);
    vi.stubEnv("APP_SECRET", PREVIOUS);
    vi.stubEnv("APP_SECRET_PREVIOUS", CURRENT);
    try {
      expect(decryptSecret(sealed)).toBe("ldap-bind-password");
      expect(sealedWithCurrentKey(sealed)).toBe(false);
      expect(kidOf(encryptSecret("x"))).not.toBe(kidOf(sealed));
    } finally {
      vi.stubEnv("APP_SECRET", CURRENT);
    }
  });

  it("falls back to every key when the id matches none, and opens v1 with the previous key", () => {
    const sealed = encryptSecret("webhook-signing-secret");
    const wrongId = sealed.replace(/^v2:[0-9a-f]{8}:/, "v2:00000000:");
    expect(decryptSecret(wrongId)).toBe("webhook-signing-secret");
    const oldV2 = sealedWith(PREVIOUS, "smtp-password");
    expect(decryptSecret(oldV2)).toBeNull();
    rotation(true);
    expect(decryptSecret(oldV2)).toBe("smtp-password");
    vi.stubEnv("APP_SECRET", PREVIOUS);
    vi.stubEnv("APP_SECRET_PREVIOUS", CURRENT);
    try {
      expect(decryptSecret(V1_FIXTURE)).toBe(V1_PLAIN);
    } finally {
      vi.stubEnv("APP_SECRET", CURRENT);
    }
  });
});

describe("rotate-secret", () => {
  it("re-encrypts every stored secret with the current key once, leaves what it cannot open, and keeps them readable after the old key is removed", async () => {
    rotation(true);
    const settings = structuredClone((await addTenant(db)).settings);
    settings.identity.sso = { protocol: "oidc", autoCreate: false, clientSecretEnc: sealedWith(PREVIOUS, "sso-secret") };
    settings.identity.ldap = { url: "ldaps://ldap.test", passwordEnc: sealedWith(PREVIOUS, "ldap-password"), departmentSource: "attribute", syncManagers: false, syncLanguage: false, schedule: "off", passwordSignIn: false, matchByEmail: true };
    settings.email = { enabled: true, passwordEnc: V1_FIXTURE };
    settings.integrations = { ...settings.integrations, webhookSecretEnc: sealedWith(CURRENT, "already-current") };
    const tenant = await addTenant(db, { settings });
    const untouched = await addTenant(db);
    // A row saved before some settings group existed must not stop the run.
    const partial = await addTenant(db, { settings: { email: { enabled: true, passwordEnc: sealedWith(PREVIOUS, "partial-password") } } as never });
    const user = await addUser(db, tenant.id, { totpSecret: sealedWith(PREVIOUS, "JBSWY3DPEHPK3PXP") });
    const current = await addUser(db, tenant.id, { totpSecret: sealedWith(CURRENT, "CURRENTKEY") });
    const unreadable = await addUser(db, tenant.id, { totpSecret: sealedWith("some-other-secret-nobody-has-any-more-0123456789", "LOST") });

    expect(await rotateStoredSecrets(db)).toEqual({ tenants: 2, users: 1, unreadable: 1, skipped: [] });
    expect(decryptSecret((await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, partial.id)))[0].settings.email.passwordEnc)).toBe("partial-password");
    const [row] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenant.id));
    const resealed = [row.settings.identity.sso?.clientSecretEnc, row.settings.identity.ldap?.passwordEnc, row.settings.email.passwordEnc, row.settings.integrations.webhookSecretEnc] as string[];
    for (const value of resealed) expect(sealedWithCurrentKey(value)).toBe(true);
    expect(resealed[3]).toBe(settings.integrations.webhookSecretEnc);
    const totp = async (id: string) => (await db.select({ s: t.users.totpSecret }).from(t.users).where(eq(t.users.id, id)))[0].s as string;
    expect(sealedWithCurrentKey(await totp(user.id))).toBe(true);
    expect(await totp(current.id)).toBe(current.totpSecret);
    expect(await totp(unreadable.id)).toBe(unreadable.totpSecret);
    expect((await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, untouched.id)))[0].settings).toEqual(untouched.settings);

    expect(await rotateStoredSecrets(db)).toEqual({ tenants: 0, users: 0, unreadable: 1, skipped: [] });
    rotation(false);
    expect(resealed.map(decryptSecret)).toEqual(["sso-secret", "ldap-password", V1_PLAIN, "already-current"]);
    expect(decryptSecret(await totp(user.id))).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("rotate-secret with an organisation deleted mid-run", () => {
  it("skips the missing row, finishes the others and reports the skipped id", async () => {
    rotation(true);
    const sealed = (plain: string) => ({ ...defaultSettings("en"), email: { enabled: true, passwordEnc: sealedWith(PREVIOUS, plain) } });
    const doomed = await addTenant(db, { settings: sealed("doomed-password") });
    const survivor = await addTenant(db, { settings: sealed("survivor-password") });
    // The id list is read before the per-organisation locks: the first lock finds the row gone.
    const transaction = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementationOnce(async (fn) => {
      await db.delete(t.tenants).where(eq(t.tenants.id, doomed.id));
      return transaction(fn);
    });
    const counts = await rotateStoredSecrets(db);
    expect(counts.skipped).toEqual([doomed.id]);
    const [row] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, survivor.id));
    expect(sealedWithCurrentKey(row.settings.email.passwordEnc as string)).toBe(true);
    expect(decryptSecret(row.settings.email.passwordEnc)).toBe("survivor-password");
  });
});

describe("rotate-secret refusal", () => {
  it("refuses to seal with the development key wherever a database is named, and a previous key too short to count", () => {
    const weak = "short";
    expect(rotationRefusal({ DATABASE_URL: "postgres://db/portal", APP_SECRET: weak })).toMatch(/APP_SECRET \(32\+/);
    expect(rotationRefusal({ NODE_ENV: "production", APP_SECRET: "" })).toMatch(/APP_SECRET \(32\+/);
    expect(rotationRefusal({ APP_SECRET: CURRENT, APP_SECRET_PREVIOUS: weak })).toMatch(/APP_SECRET_PREVIOUS/);
    // The script does not load env.ts, so it refuses the old key left equal to the new one itself.
    expect(rotationRefusal({ DATABASE_URL: "postgres://db/portal", APP_SECRET: CURRENT, APP_SECRET_PREVIOUS: CURRENT })).toMatch(/equals APP_SECRET/);
    expect(rotationRefusal({ DATABASE_URL: "postgres://db/portal", APP_SECRET: CURRENT, APP_SECRET_PREVIOUS: PREVIOUS })).toBeNull();
    // The embedded development database is the only place the fallback key may be used.
    expect(rotationRefusal({ APP_SECRET: "" })).toBeNull();
  });

  it("refuses a rotation that would break published domain proofs: verified domains and no domain-proof key of its own", async () => {
    const before = await countVerifiedDomains(db);
    await addTenant(db, { domain: "proven.gov.az", domainVerifiedAt: new Date() });
    await addTenant(db, { domain: "unproven.gov.az" });
    const verified = await countVerifiedDomains(db);
    expect(verified).toBe(before + 1);
    expect(rotationRefusal({ APP_SECRET: CURRENT, APP_SECRET_PREVIOUS: PREVIOUS }, verified)).toMatch(/APP_DOMAIN_PROOF_SECRET.*step 1/);
    expect(rotationRefusal({ APP_SECRET: CURRENT, APP_SECRET_PREVIOUS: PREVIOUS, APP_DOMAIN_PROOF_SECRET: CURRENT }, verified)).toBeNull();
    expect(rotationRefusal({ APP_SECRET: CURRENT, APP_SECRET_PREVIOUS: PREVIOUS }, 0)).toBeNull();
  });
});

describe("backup codes", () => {
  it("accepts a code hashed with the previous key only while APP_SECRET_PREVIOUS is set", () => {
    const code = "abcde-fghjk";
    const old = hashBackupCode(code, PREVIOUS);
    expect(backupCodeHashes(code)).toEqual([hashBackupCode(code), legacyBackupHash(code)]);
    rotation(true);
    expect(backupCodeHashes(code)).toEqual([hashBackupCode(code), old, legacyBackupHash(code)]);
    expect(old).not.toBe(hashBackupCode(code));
  });
});

describe("domain proof", () => {
  it("keeps the published record and accepts the record of either key during a rotation", async () => {
    expect(domainProofRecord(TENANT_A, CURRENT)).toBe(PROOF_FIXTURE);
    expect(domainProofRecords(TENANT_A)).toEqual([PROOF_FIXTURE]);
    const old = domainProofRecord(TENANT_A, PREVIOUS);
    h.txt.set("agency.gov.az", [[old]]);
    expect(await domainProofFound("agency.gov.az", domainProofRecords(TENANT_A))).toBe(false);
    rotation(true);
    expect(domainProofRecords(TENANT_A)).toEqual([PROOF_FIXTURE, old]);
    expect(await domainProofFound("agency.gov.az", domainProofRecords(TENANT_A))).toBe(true);
    h.txt.set("agency.gov.az", [[PROOF_FIXTURE]]);
    expect(await domainProofFound("agency.gov.az", domainProofRecords(TENANT_A))).toBe(true);
    // The domain-proof secret, when set apart, is the only one the published record comes from.
    h.env.domainProofSecret = "stable-domain-proof-secret-0123456789-abcdef";
    try {
      expect(domainProofRecords(TENANT_A)[0]).toBe(domainProofRecord(TENANT_A, "stable-domain-proof-secret-0123456789-abcdef"));
    } finally {
      h.env.domainProofSecret = CURRENT;
    }
  });
});

describe("one verified domain per organisation", () => {
  it("refuses a second organisation's proof of a domain another one verified, by the operator or by its own admin", async () => {
    const first = await addTenant(db, { domain: "shared.gov.az", domainVerifiedAt: new Date() });
    const second = await addTenant(db);
    expect(await verifyTenantDomainAction(second.id, "shared.gov.az", true)).toEqual({ ok: false, error: "domainTaken", found: false });
    h.viewer.tenant = { id: second.id, name: second.name, settings: second.settings };
    h.txt.set("shared.gov.az", [[domainProofRecord(second.id, CURRENT)]]);
    expect(await verifyDomainAction("shared.gov.az")).toEqual({ ok: false, verified: false, found: true, kept: false, error: "domainTaken" });
    expect(h.audits.map((a) => [a.action, a.meta?.taken, a.meta?.byOperator])).toEqual([["domain.rechecked", true, true], ["domain.rechecked", true, undefined]]);
    const [row] = await db.select({ domain: t.tenants.domain, verifiedAt: t.tenants.domainVerifiedAt }).from(t.tenants).where(eq(t.tenants.id, second.id));
    expect(row).toEqual({ domain: null, verifiedAt: null });
    // The same domain unverified is no conflict (the index is partial), nor is the first organisation's own re-check.
    h.txt.clear();
    expect(await verifyTenantDomainAction(second.id, "shared.gov.az", false)).toEqual({ ok: true, verified: false, found: false });
    expect(await verifyTenantDomainAction(first.id, "shared.gov.az", true)).toEqual({ ok: true, verified: true, found: false });
  });

  it("has the refusal message in every language, for administrators and for the operator", () => {
    for (const locale of LOCALES) {
      const read = (ns: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "messages", locale, `${ns}.json`), "utf8"));
      expect(read("settings").branding.domainTaken, `${locale} settings`).toMatch(/\S/);
      expect(read("admin").platform.domainTaken, `${locale} admin`).toMatch(/\S/);
    }
  });
});
