import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import { generateTOTP } from "@oslojs/otp";
import { decodeBase32IgnorePadding } from "@oslojs/encoding";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { defaultSettings } from "../src/lib/tenant-defaults";
import { sha256Hex } from "../src/server/crypto";

// The sign-in actions against a real (in-memory) database, so the conditional updates and the claim-then-count limits run as
// they do in production. Mail, SMS, passwords and the audit log are stubbed.
const h = vi.hoisted(() => ({
  db: undefined as unknown,
  ip: "203.0.113.1" as string | null,
  later: [] as (() => unknown)[],
  mails: [] as string[],
  sms: [] as string[],
  session: null as unknown,
}));
vi.mock("../src/server/db", async () => ({ db: () => h.db, dbHandle: () => ({ driver: "pglite", db: h.db }), t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({
  env: { TRUST_PROXY: 1, showOtp: false, isProd: false, secret: "test-only-secret-0123456789-abcdefghij-0123456789", BOOTSTRAP_OPERATOR_EMAIL: "op@platform.test" },
  appUrl: () => "http://localhost:3000",
}));
vi.mock("../src/server/request", async (original) => ({ ...(await original<typeof import("../src/server/request")>()), clientIp: async () => h.ip, userAgent: async () => null }));
vi.mock("../src/server/auth/password", () => ({ hashPassword: async () => "hash", verifyPassword: async (_: string | null, pw: string) => pw === "right password", passwordProblem: () => null }));
vi.mock("../src/server/auth/viewer", () => ({ getSession: async () => h.session, actionViewer: async () => h.session }));
vi.mock("../src/server/sms", () => ({ smsAvailable: () => true, sendSms: async (to: string) => (h.sms.push(to), { ok: true, simulated: true }) }));
vi.mock("../src/server/mail", () => ({ queueEmail: async (_db: unknown, _tenant: unknown, mail: { to: string }) => void h.mails.push(mail.to), renderEmailHtml: () => "" }));
vi.mock("../src/server/services/audit", () => ({ audit: async () => undefined }));
vi.mock("../src/server/services/library", () => ({ CONTENT_SYNC_LOCK_KEY: 1, syncLibrary: async () => ({ modules: 0, lessons: 0, locales: { en: 0, az: 0, ru: 0 } }), syncPaths: async () => 0 }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => undefined, get: () => undefined }), headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void h.later.push(fn) }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const auth = await import("../src/server/actions/auth");
const { hashBackupCode, legacyBackupHash, newTotpKey } = await import("../src/server/auth/totp");
const { renewedExpiry, shouldRenew, SESSION_MAX_DAYS } = await import("../src/server/auth/session");
const db = () => h.db as DB;

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
/** The error of a refused step, or "signed-in" when the action redirected after starting a session. */
const outcome = (run: Promise<unknown>) =>
  run.then(
    (r) => (r as { error?: string } | undefined)?.error ?? "ok",
    (e: { digest?: string }) => {
      if (String(e?.digest).startsWith("NEXT_REDIRECT")) return "signed-in";
      throw e;
    },
  );
const runLater = async () => {
  for (const fn of h.later.splice(0)) await fn();
};
const tally = (results: string[]) => results.reduce<Record<string, number>>((n, r) => ({ ...n, [r]: (n[r] ?? 0) + 1 }), {});

let tenantId: string;
let ssoTenantId: string;
async function person(values: Partial<typeof t.users.$inferInsert> & { email: string }) {
  const [row] = await db().insert(t.users).values({ tenantId, name: "Test Person", passwordHash: "hash", locale: "en", ...values }).returning();
  return row;
}

beforeAll(async () => {
  const pglite = new PGlite();
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  h.db = drizzle(pglite, { schema: t });
  const branding = { primary: "#4f46e5", accent: "#ff7a1a" };
  [{ id: tenantId }] = await db().insert(t.tenants).values({ slug: "acme", name: "Acme", plan: "professional", branding, settings: defaultSettings("en") }).returning();
  const ssoSettings = defaultSettings("en");
  ssoSettings.identity = { ...ssoSettings.identity, ssoEnabled: true, sso: { protocol: "oidc", issuer: "https://idp.sso.test", clientId: "portal", autoCreate: false } };
  [{ id: ssoTenantId }] = await db()
    .insert(t.tenants)
    .values({ slug: "ssoorg", name: "SSO Org", plan: "professional", branding, settings: ssoSettings, domain: "sso.test", domainVerifiedAt: new Date() })
    .returning();
}, 180_000);

beforeEach(() => {
  h.ip = "203.0.113.1";
  h.later.length = 0;
  h.mails.length = 0;
  h.sms.length = 0;
});

describe("second factor under a parallel burst", () => {
  it("gives a burst of wrong codes five guesses at most, then locks", async () => {
    const u = await person({ email: "burst@acme.test", totpEnabled: true, totpRecovery: [] });
    h.session = { user: { id: u.id }, sessionId: "pending" };
    const results = await Promise.all(Array.from({ length: 30 }, () => outcome(auth.verifySecondFactorAction(undefined, form({ mode: "backup", code: "wrong-guess" })))));
    const n = tally(results);
    expect(n.invalidBackupCode ?? 0).toBeLessThanOrEqual(5);
    expect((n.invalidBackupCode ?? 0) + (n.locked ?? 0)).toBe(30);
    const failed = await db().select().from(t.loginAttempts).where(and(eq(t.loginAttempts.key, `2fa:${u.id}`), eq(t.loginAttempts.success, false)));
    expect(failed.length).toBeLessThanOrEqual(5);
  });

  it("spends a backup code once even when it is sent twice at the same time, and still takes codes made before the keyed hash", async () => {
    expect(hashBackupCode("abcde-fghjk")).not.toBe(legacyBackupHash("abcde-fghjk"));
    const u = await person({ email: "codes@acme.test", totpEnabled: true, totpRecovery: [hashBackupCode("abcde-fghjk"), legacyBackupHash("old23-codes")] });
    h.session = { user: { id: u.id }, sessionId: "pending" };
    const both = await Promise.all([1, 2].map(() => outcome(auth.verifySecondFactorAction(undefined, form({ mode: "backup", code: "ABCDE-FGHJK" })))));
    expect(both.sort()).toEqual(["invalidBackupCode", "signed-in"]);
    expect(await outcome(auth.verifySecondFactorAction(undefined, form({ mode: "backup", code: "old23-codes" })))).toBe("signed-in");
    expect(await outcome(auth.verifySecondFactorAction(undefined, form({ mode: "backup", code: "old23-codes" })))).toBe("invalidBackupCode");
    const [left] = await db().select({ codes: t.users.totpRecovery }).from(t.users).where(eq(t.users.id, u.id));
    expect(left.codes).toEqual([]);
  });
});

describe("phone codes", () => {
  const codeFor = async (userId: string, code: string, expiresInMs = 5 * 60_000) => {
    await db().insert(t.authTokens).values({ id: sha256Hex(`otp:${userId}:${code}`), userId, kind: "phone_otp", expiresAt: new Date(Date.now() + expiresInMs) });
  };

  it("lets a code take five guesses in all, from however many places, and then refuses even the right one", async () => {
    const u = await person({ email: "phone@acme.test", phone: "+994501110001" });
    await codeFor(u.id, "123456");
    let n = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => {
        h.ip = `198.51.100.${++n}`;
        return outcome(auth.verifyPhoneCodeAction(undefined, form({ phone: "+994501110001", code: "654321" })));
      }),
    );
    expect(results.every((r) => r === "invalidCode")).toBe(true);
    const [token] = await db().select().from(t.authTokens).where(eq(t.authTokens.userId, u.id));
    expect(token.attempts).toBe(5);
    h.ip = "198.51.100.200";
    expect(await outcome(auth.verifyPhoneCodeAction(undefined, form({ phone: "+994501110001", code: "123456" })))).toBe("invalidCode");
  });

  it("answers an expired code like a wrong one, and signs in with a live one", async () => {
    const u = await person({ email: "expired@acme.test", phone: "+994501110002" });
    await codeFor(u.id, "111111", -1_000);
    expect(await outcome(auth.verifyPhoneCodeAction(undefined, form({ phone: "+994501110002", code: "111111" })))).toBe("invalidCode");
    expect(await outcome(auth.verifyPhoneCodeAction(undefined, form({ phone: "+994501119999", code: "111111" })))).toBe("invalidCode");
    await db().delete(t.authTokens).where(eq(t.authTokens.userId, u.id));
    await codeFor(u.id, "222222");
    expect(await outcome(auth.verifyPhoneCodeAction(undefined, form({ phone: "+994501110002", code: "222222" })))).toBe("signed-in");
  });

  it("answers a registered number exactly like an unknown one and texts only learners, after the answer", async () => {
    await person({ email: "learner-sms@acme.test", phone: "+994501110003" });
    await person({ email: "head-sms@acme.test", phone: "+994501110004", role: "department_head" });
    const known = await auth.requestPhoneCodeAction(undefined, form({ phone: "+994501110003" }));
    const unknown = await auth.requestPhoneCodeAction(undefined, form({ phone: "+994501119998" }));
    const head = await auth.requestPhoneCodeAction(undefined, form({ phone: "+994501110004" }));
    expect(known).toEqual({ step: "code", phone: "+994501110003" });
    expect(unknown).toEqual({ step: "code", phone: "+994501119998" });
    expect(head).toEqual({ step: "code", phone: "+994501110004" });
    expect(h.sms).toEqual([]);
    await runLater();
    expect(h.sms).toEqual(["+994501110003"]);
  });

  it("keeps texting the owner while someone else floods the number", async () => {
    await person({ email: "flooded@acme.test", phone: "+994501110005" });
    const ask = (ip: string) => {
      h.ip = ip;
      return outcome(auth.requestPhoneCodeAction(undefined, form({ phone: "+994501110005" })));
    };
    for (const ip of ["192.0.2.1", "192.0.2.2"]) for (let i = 0; i < 5; i++) expect(await ask(ip)).toBe("ok");
    expect(await ask("192.0.2.1")).toBe("rateLimited");
    expect(await ask("192.0.2.3")).toBe("ok");
    expect(await ask("192.0.2.3")).toBe("rateLimited");
  });
});

describe("password sign-in lockout", () => {
  const signIn = (email: string, password: string, ip: string) => {
    h.ip = ip;
    return outcome(auth.signInAction(undefined, form({ email, password, next: "/app" })));
  };

  it("locks the client that guessed, not the owner signing in from elsewhere", async () => {
    await person({ email: "target@acme.test", role: "tenant_admin" });
    for (let i = 0; i < 5; i++) expect(await signIn("target@acme.test", "guess", "192.0.2.10")).toBe("invalidCredentials");
    expect(await signIn("target@acme.test", "right password", "192.0.2.10")).toBe("locked");
    expect(await signIn("target@acme.test", "right password", "192.0.2.11")).toBe("signed-in");
  });

  it("holds every client that failed once the account is under attack from many places, but never one that has not", async () => {
    await person({ email: "busy@acme.test" });
    expect(await signIn("busy@acme.test", "typo", "192.0.2.20")).toBe("invalidCredentials");
    for (let ip = 30; ip < 40; ip++) for (let i = 0; i < 5; i++) await signIn("busy@acme.test", "guess", `192.0.2.${ip}`);
    expect(await signIn("busy@acme.test", "right password", "192.0.2.20")).toBe("locked");
    expect(await signIn("busy@acme.test", "right password", "192.0.2.21")).toBe("signed-in");
  });
});

describe("password reset mail", () => {
  const forgot = (email: string, ip: string) => {
    h.ip = ip;
    return auth.forgotPasswordAction(undefined, form({ email }));
  };

  it("answers every address alike, mails only after the answer, and lets the owner's request through a flood", async () => {
    await person({ email: "reset@acme.test" });
    expect(await forgot("nobody@acme.test", "192.0.2.50")).toEqual({ done: true });
    expect(await forgot("reset@acme.test", "192.0.2.50")).toEqual({ done: true });
    expect(h.mails).toEqual([]);
    await runLater();
    expect(h.mails).toEqual(["reset@acme.test"]);
    h.mails.length = 0;
    for (const ip of ["192.0.2.51", "192.0.2.52", "192.0.2.53"]) for (let i = 0; i < 3; i++) await forgot("reset@acme.test", ip);
    // The throttle counts every address alike, so it can say so.
    expect(await forgot("reset@acme.test", "192.0.2.51")).toEqual({ error: "rateLimited", email: "reset@acme.test" });
    await runLater();
    expect(h.mails.length).toBe(9);
    await forgot("reset@acme.test", "192.0.2.54");
    await runLater();
    expect(h.mails.length).toBe(10);
  });

  it("does not let requests for made-up addresses use up the reset mails of real people", async () => {
    await person({ email: "owner@acme.test" });
    h.ip = null;
    for (let i = 0; i < 1001; i++) await auth.forgotPasswordAction(undefined, form({ email: `fake${i}@nowhere.test` }));
    expect(await auth.forgotPasswordAction(undefined, form({ email: "owner@acme.test" }))).toEqual({ done: true });
    await runLater();
    expect(h.mails).toEqual(["owner@acme.test"]);
  }, 120_000);
});

describe("single sign-on domain", () => {
  it("refuses password, reset mail and phone codes to its learners, and keeps the password step for administrators", async () => {
    await db().insert(t.users).values({ tenantId: ssoTenantId, email: "ann@sso.test", name: "Ann", passwordHash: "hash", phone: "+994501110010" });
    await db().insert(t.users).values({ tenantId: ssoTenantId, email: "boss@sso.test", name: "Boss", passwordHash: "hash", role: "tenant_admin" });
    h.ip = "192.0.2.60";
    expect(await outcome(auth.signInAction(undefined, form({ email: "ann@sso.test", password: "right password", next: "/app" })))).toBe("invalidCredentials");
    expect(await outcome(auth.signInAction(undefined, form({ email: "boss@sso.test", password: "right password", next: "/app" })))).toBe("signed-in");
    // The email step answers alike for a learner, an administrator and an unknown address of the domain.
    for (const email of ["ann@sso.test", "boss@sso.test", "ghost@sso.test"]) {
      expect(await auth.checkEmailAction(undefined, form({ email }))).toEqual({ step: "sso", email, ssoUrl: "/api/sso/start?tenant=ssoorg" });
    }
    await auth.forgotPasswordAction(undefined, form({ email: "ann@sso.test" }));
    await auth.requestPhoneCodeAction(undefined, form({ phone: "+994501110010" }));
    await runLater();
    expect(h.mails).toEqual([]);
    expect(h.sms).toEqual([]);
  });
});

describe("two-step setup", () => {
  it("signs out every other session once two-step verification is on", async () => {
    const { confirmTotpAction } = await import("../src/server/actions/profile");
    const key = newTotpKey();
    const u = await person({ email: "enrol@acme.test", totpSecret: key.encrypted });
    const now = new Date(Date.now() + 86_400_000);
    await db().insert(t.sessions).values(["here", "elsewhere"].map((id) => ({ id, userId: u.id, tenantId, expiresAt: now, twoFactorVerified: true })));
    h.session = { user: { id: u.id, role: "learner" }, sessionId: "here", tenant: { id: tenantId, name: "Acme", settings: defaultSettings("en") } };
    const code = generateTOTP(decodeBase32IgnorePadding(key.base32), 30, 6);
    expect(await confirmTotpAction(code)).toMatchObject({ ok: true });
    const left = await db().select({ id: t.sessions.id }).from(t.sessions).where(eq(t.sessions.userId, u.id));
    expect(left.map((s) => s.id)).toEqual(["here"]);
  });
});

describe("time-based codes", () => {
  it("takes a code once: the same code is refused on reuse", async () => {
    const key = newTotpKey();
    const u = await person({ email: "replay@acme.test", totpEnabled: true, totpSecret: key.encrypted, totpRecovery: [] });
    h.session = { user: { id: u.id }, sessionId: "pending" };
    const code = generateTOTP(decodeBase32IgnorePadding(key.base32), 30, 6);
    expect(await outcome(auth.verifySecondFactorAction(undefined, form({ mode: "totp", code })))).toBe("signed-in");
    expect(await outcome(auth.verifySecondFactorAction(undefined, form({ mode: "totp", code })))).toBe("invalidCode");
    const [row] = await db().select({ step: t.users.totpLastStep }).from(t.users).where(eq(t.users.id, u.id));
    expect(row.step).toBe(Math.floor(Date.now() / 30_000));
  });
});

describe("changing the password", () => {
  it("needs the current password, applies the password rules and signs the other devices out", async () => {
    const { changePasswordAction } = await import("../src/server/actions/profile");
    const u = await person({ email: "change@acme.test", passwordHash: "old" });
    const now = new Date(Date.now() + 86_400_000);
    await db().insert(t.sessions).values(["mine", "theirs"].map((id) => ({ id, userId: u.id, tenantId, expiresAt: now, twoFactorVerified: true })));
    h.session = { user: { id: u.id, email: u.email, name: u.name, role: "learner" }, sessionId: "mine", tenant: { id: tenantId, name: "Acme", settings: defaultSettings("en") } };
    expect(await changePasswordAction("wrong password", "N3w-passw0rd-long", "N3w-passw0rd-long")).toEqual({ ok: false, error: "wrongPassword" });
    expect(await changePasswordAction("right password", "N3w-passw0rd-long", "other")).toEqual({ ok: false, error: "mismatch" });
    expect(await changePasswordAction("right password", "Change@Acme.test", "Change@Acme.test")).toEqual({ ok: false, error: "sameAsEmail" });
    expect(await changePasswordAction("right password", "N3w-passw0rd-long", "N3w-passw0rd-long")).toEqual({ ok: true });
    const [row] = await db().select({ hash: t.users.passwordHash }).from(t.users).where(eq(t.users.id, u.id));
    expect(row.hash).toBe("hash");
    const left = await db().select({ id: t.sessions.id }).from(t.sessions).where(eq(t.sessions.userId, u.id));
    expect(left.map((s) => s.id)).toEqual(["mine"]);
  });
});

describe("deletion request", () => {
  it("notifies the administrators once while a request is pending", async () => {
    const { requestDeletionAction } = await import("../src/server/actions/profile");
    const u = await person({ email: "leaving@acme.test" });
    const admin = await person({ email: "admin-del@acme.test", role: "tenant_admin" });
    h.session = { user: { id: u.id, name: "Leaving", role: "learner" }, sessionId: "s", tenant: { id: tenantId, name: "Acme", settings: defaultSettings("en") } };
    expect(await requestDeletionAction()).toEqual({ ok: true });
    expect(await requestDeletionAction()).toEqual({ ok: true });
    const notes = await db().select().from(t.notifications).where(and(eq(t.notifications.userId, admin.id), eq(t.notifications.kind, "deletion")));
    expect(notes).toHaveLength(1);
  });
});

describe("session lifetime", () => {
  const DAY = 86_400_000;
  it("never renews past the absolute lifetime, and not at all without the sign-in time", () => {
    const soon = new Date(Date.now() + DAY);
    expect(shouldRenew(soon)).toBe(false);
    expect(shouldRenew(soon, new Date(Date.now() - 20 * DAY))).toBe(true);
    const old = new Date(Date.now() - (SESSION_MAX_DAYS - 1) * DAY);
    expect(renewedExpiry(old).getTime()).toBe(old.getTime() + SESSION_MAX_DAYS * DAY);
    expect(shouldRenew(new Date(old.getTime() + SESSION_MAX_DAYS * DAY), old)).toBe(false);
  });
});

describe("bootstrap", () => {
  it("prints the operator's invitation link once, not on every start", async () => {
    const { bootstrap } = await import("../src/server/bootstrap");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await bootstrap();
    await bootstrap();
    const links = info.mock.calls.filter((c) => String(c[0]).includes("/account/invite/"));
    expect(links).toHaveLength(1);
    info.mockRestore();
  });
});
