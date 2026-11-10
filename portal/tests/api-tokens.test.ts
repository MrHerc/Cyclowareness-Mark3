/**
 * The reporting API (docs/API.md §10): tokens are minted once-visible, scoped to read permissions,
 * revocable and capped per organisation; a bearer token serves the report and people routes with the
 * token's permissions only, is refused when revoked, disowned or over its rate limit, and never writes.
 */
import { createFormatter, createTranslator } from "next-intl";
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { messagesFor } from "../src/i18n/translator";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
let actor: Viewer;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { isProd: false, TRUST_PROXY: 0, secret: "0123456789abcdef0123456789abcdef" }, appUrl: () => "http://localhost:3000" }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => undefined }) }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getFormatter: async () => createFormatter({ locale: "en", timeZone: "Asia/Baku" }),
  getTranslations: async (namespace: string) => createTranslator({ ...(await messagesFor("en")), namespace: namespace as never }),
}));
vi.mock("../src/server/request", () => ({ clientIp: async () => null, currentPath: async () => "/", sameOrigin: () => true }));
let session: Viewer | null = null;
// The real gates (allowed, twoFactorGap, apiTokenViewer); only the signed-in administrator (minting tokens, or downloading from the console) is stubbed.
vi.mock("../src/server/auth/viewer", async (importOriginal) => ({ ...(await importOriginal<object>()), actionViewer: async () => actor, getViewer: async () => session }));
// Minting takes the actor's password; the step-up itself (attempt limit, audit) is covered in step-up.test.ts.
const PW = "Correct-Horse-Battery-9";
vi.mock("../src/server/auth/step-up", async (importOriginal) => ({ ...(await importOriginal<object>()), stepUp: async (_v: unknown, password: unknown) => (password === PW ? null : "wrongPassword") }));

const { createApiTokenAction, revokeApiTokenAction } = await import("../src/server/actions/settings");
const { changePasswordAction, signOutOtherDevicesAction } = await import("../src/server/actions/profile");
const { setPasswordAction } = await import("../src/server/actions/auth");
const { resetTwoFactorAction, setStatusAction } = await import("../src/server/actions/people");
const { hashPassword } = await import("../src/server/auth/password");
const { API_TOKEN_RATE_LIMIT } = await import("../src/server/auth/api");
const { rateLimit } = await import("../src/server/rate-limit");
const { sha256Hex } = await import("../src/server/crypto");
const reports = await import("../src/app/api/admin/reports/[kind]/route");
const people = await import("../src/app/api/admin/people/[kind]/route");

let tenant: typeof t.tenants.$inferSelect;
let admin: typeof t.users.$inferSelect;
let other: typeof t.tenants.$inferSelect;

const viewerFor = (user: typeof t.users.$inferSelect, org: typeof t.tenants.$inferSelect): Viewer => ({ sessionId: "s", twoFactorVerified: true, user, tenant: { ...org, settings: withDefaults(org.settings), features: featuresFor(org.plan, org.features) } });
const audited = (action: string, tenantId = tenant.id) => db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenantId), eq(t.auditLog.action, action)));
const bearer = (path: string, token: string, init?: RequestInit) => new Request(`http://localhost:3000${path}`, { ...init, headers: { authorization: `Bearer ${token}` } });
const ctx = (kind: string) => ({ params: Promise.resolve({ kind }) });
const mint = async (permissions: t.ApiTokenPermission[], name = "HR sync") => {
  const res = await createApiTokenAction({ name, permissions }, PW);
  if (!res.ok || !res.token) throw new Error(`mint failed: ${JSON.stringify(res)}`);
  return { token: res.token, id: sha256Hex(res.token) };
};

beforeAll(async () => {
  await ready();
  tenant = await addTenant(db, { plan: "professional" });
  admin = await addUser(db, tenant.id, { role: "tenant_admin" });
  other = await addTenant(db, { plan: "professional" });
  await addUser(db, other.id, { name: "Only In B" });
  actor = viewerFor(admin, tenant);
}, DB_SETUP_TIMEOUT);

describe("minting", () => {
  it("stores only the hash, returns the secret once and audits the creation", async () => {
    const res = await createApiTokenAction({ name: " BI tool ", permissions: ["reports.read", "reports.read", "people.read"] }, PW);
    expect(res.ok).toBe(true);
    expect(res.token).toMatch(/^cyk_[A-Za-z0-9_-]{32}$/);
    const [row] = await db.select().from(t.apiTokens).where(eq(t.apiTokens.id, sha256Hex(res.token!)));
    expect(row).toMatchObject({ tenantId: tenant.id, name: "BI tool", permissions: ["reports.read", "people.read"], createdBy: admin.id, lastUsedAt: null, revokedAt: null });
    expect(JSON.stringify(row)).not.toContain(res.token);
    expect(await audited("api_token.created")).toMatchObject([{ actorId: admin.id, targetType: "api_token", targetId: row.id, meta: { name: "BI tool", permissions: ["reports.read", "people.read"], expiresAt: row.expiresAt.toISOString() } }]);
  });

  it("takes the actor's password and tells the other administrators", async () => {
    const peer = await addUser(db, tenant.id, { role: "tenant_admin" });
    const before = (await db.select().from(t.apiTokens)).length;
    expect(await createApiTokenAction({ name: "Stolen session", permissions: ["people.read"] })).toEqual({ ok: false, error: "wrongPassword" });
    expect(await createApiTokenAction({ name: "Stolen session", permissions: ["people.read"] }, "guess")).toEqual({ ok: false, error: "wrongPassword" });
    expect(await db.select().from(t.apiTokens)).toHaveLength(before);
    await mint(["people.read"], "Payroll export");
    const notices = await db.select().from(t.notifications).where(eq(t.notifications.userId, peer.id));
    expect(notices).toMatchObject([{ kind: "security", title: `${admin.name} created the API token “Payroll export”.`, href: "/admin/settings?tab=integrations" }]);
    expect(await db.select().from(t.notifications).where(eq(t.notifications.userId, admin.id))).toEqual([]);
  });

  it("expires after the lifetime picked at minting: 90 days unless chosen, a year at most", async () => {
    const day = 86_400_000;
    const expiry = async (res: Awaited<ReturnType<typeof createApiTokenAction>>) => (await db.select().from(t.apiTokens).where(eq(t.apiTokens.id, sha256Hex(res.token!))))[0].expiresAt.getTime();
    const plain = await createApiTokenAction({ name: "default", permissions: ["reports.read"] }, PW);
    expect(Math.round((await expiry(plain)) / day - Date.now() / day)).toBe(90);
    const year = await createApiTokenAction({ name: "year", permissions: ["reports.read"], expiresInDays: 365 }, PW);
    expect(Math.round((await expiry(year)) / day - Date.now() / day)).toBe(365);
    for (const expiresInDays of [0, 366, 1.5]) expect(await createApiTokenAction({ name: "x", permissions: ["reports.read"], expiresInDays }, PW)).toEqual({ ok: false, field: "expiresInDays" });
  });

  it("refuses an empty name, no permission and a write permission", async () => {
    expect(await createApiTokenAction({ name: "  ", permissions: ["reports.read"] })).toEqual({ ok: false, field: "name" });
    expect(await createApiTokenAction({ name: "x", permissions: [] })).toEqual({ ok: false, field: "permissions" });
    expect(await createApiTokenAction({ name: "x", permissions: ["people.write" as never] })).toMatchObject({ ok: false });
    expect(await createApiTokenAction({ name: "x", permissions: Array(t.API_TOKEN_PERMISSIONS.length + 1).fill("reports.read") })).toEqual({ ok: false, field: "permissions" });
  });

  it("caps active tokens at 20 per organisation, also under concurrent creates; a revoked one frees a slot", async () => {
    const org = await addTenant(db, { plan: "professional" });
    const boss = await addUser(db, org.id, { role: "tenant_admin" });
    actor = viewerFor(boss, org);
    try {
      let last = "";
      for (let i = 0; i < t.MAX_API_TOKENS - 1; i++) last = (await mint(["reports.read"], `t${i}`)).id;
      // Guards the behaviour only: PGlite runs one transaction at a time, so this passes without the FOR UPDATE lock too.
      const race = await Promise.all([1, 2, 3].map((i) => createApiTokenAction({ name: `race${i}`, permissions: ["reports.read"] }, PW)));
      expect(race.filter((r) => r.ok)).toHaveLength(1);
      expect(await db.select().from(t.apiTokens).where(and(eq(t.apiTokens.tenantId, org.id), isNull(t.apiTokens.revokedAt)))).toHaveLength(t.MAX_API_TOKENS);
      expect(await createApiTokenAction({ name: "one more", permissions: ["reports.read"] }, PW)).toEqual({ ok: false, error: "limit" });
      expect(await revokeApiTokenAction(last)).toEqual({ ok: true });
      expect((await createApiTokenAction({ name: "one more", permissions: ["reports.read"] }, PW)).ok).toBe(true);
      // An expired token, still unrevoked, frees its slot too.
      await db.update(t.apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(t.apiTokens.name, "t0"));
      expect((await createApiTokenAction({ name: "after expiry", permissions: ["reports.read"] }, PW)).ok).toBe(true);
      expect(await createApiTokenAction({ name: "over", permissions: ["reports.read"] }, PW)).toEqual({ ok: false, error: "limit" });
    } finally {
      actor = viewerFor(admin, tenant);
    }
  });

  it("revokes only the organisation's own token, once, and audits it", async () => {
    const { id } = await mint(["reports.read"], "Old");
    const foreign = viewerFor(await addUser(db, other.id, { role: "tenant_admin" }), other);
    actor = foreign;
    expect(await revokeApiTokenAction(id)).toEqual({ ok: false });
    actor = viewerFor(admin, tenant);
    expect(await revokeApiTokenAction("not-a-hash")).toEqual({ ok: false });
    expect(await revokeApiTokenAction(id)).toEqual({ ok: true });
    expect(await revokeApiTokenAction(id)).toEqual({ ok: false });
    const [row] = await db.select().from(t.apiTokens).where(eq(t.apiTokens.id, id));
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(await audited("api_token.revoked")).toMatchObject([{ actorId: admin.id, targetId: id, meta: { name: "Old" } }]);
  });
});

describe("bearer access", () => {
  it("serves a report with the token, audits the download against the token and marks it used", async () => {
    const { token, id } = await mint(["reports.read"]);
    const res = await reports.GET(bearer("/api/admin/reports/completion?format=csv", token), ctx("completion"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const entries = await audited("report.downloaded");
    expect(entries.at(-1)).toMatchObject({ actorId: admin.id, meta: { kind: "completion", format: "csv", apiToken: id } });
    const [row] = await db.select().from(t.apiTokens).where(eq(t.apiTokens.id, id));
    expect(row.lastUsedAt).toBeInstanceOf(Date);
  });

  it("limits the token to its own permissions and audits the refusal", async () => {
    const { token, id } = await mint(["people.read"]);
    const refused = await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"));
    expect(refused.status).toBe(403);
    expect(await audited("api_token.refused")).toMatchObject([{ targetId: id, meta: { reason: "forbidden", permission: "reports.read" } }]);
    const served = await people.GET(bearer("/api/admin/people/export", token), ctx("export"));
    expect(served.status).toBe(200);
  });

  it("sees only its own organisation's people", async () => {
    const { token } = await mint(["people.read"]);
    const csv = await (await people.GET(bearer("/api/admin/people/export", token), ctx("export"))).text();
    expect(csv).toContain(admin.email);
    expect(csv).not.toContain("Only In B");
  });

  it("refuses a revoked token, a suspended creator's token and an unknown token with 401", async () => {
    const { token, id } = await mint(["reports.read"]);
    await revokeApiTokenAction(id);
    expect((await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"))).status).toBe(401);
    expect(await audited("api_token.refused")).toContainEqual(expect.objectContaining({ targetId: id, meta: { reason: "revoked" } }));

    const suspended = await addUser(db, tenant.id, { role: "tenant_admin", status: "suspended" });
    actor = viewerFor(suspended, tenant);
    const disowned = await mint(["reports.read"]);
    actor = viewerFor(admin, tenant);
    expect((await reports.GET(bearer("/api/admin/reports/completion", disowned.token), ctx("completion"))).status).toBe(401);
    expect(await audited("api_token.refused")).toContainEqual(expect.objectContaining({ targetId: disowned.id, meta: { reason: "creator_inactive" } }));

    const before = (await audited("api_token.refused")).length;
    expect((await reports.GET(bearer("/api/admin/reports/completion", "cyk_nobody"), ctx("completion"))).status).toBe(401);
    expect((await audited("api_token.refused")).length).toBe(before);
  });

  it("refuses an expired token with 401 and audits the reason", async () => {
    const { token, id } = await mint(["reports.read"], "expiring");
    await db.update(t.apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(t.apiTokens.id, id));
    expect((await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"))).status).toBe(401);
    expect(await audited("api_token.refused")).toContainEqual(expect.objectContaining({ targetId: id, meta: { reason: "expired" } }));
  });

  it("loses a permission, then all access, when its creator is demoted, then suspended, after minting", async () => {
    const creator = await addUser(db, tenant.id, { role: "tenant_admin" });
    actor = viewerFor(creator, tenant);
    const { token, id } = await mint(["reports.read"], "demoted");
    actor = viewerFor(admin, tenant);
    await db.update(t.users).set({ role: "learner" }).where(eq(t.users.id, creator.id));
    expect((await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"))).status).toBe(403);
    expect(await audited("api_token.refused")).toContainEqual(expect.objectContaining({ targetId: id, meta: { reason: "forbidden", permission: "reports.read" } }));
    await db.update(t.users).set({ role: "tenant_admin", status: "suspended" }).where(eq(t.users.id, creator.id));
    expect((await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"))).status).toBe(401);
    expect(await audited("api_token.refused")).toContainEqual(expect.objectContaining({ targetId: id, meta: { reason: "creator_inactive" } }));
  });

  it("does not serve the import template, which no token permission names", async () => {
    const { token } = await mint(["audit.read"]);
    expect((await people.GET(bearer("/api/admin/people/template", token), ctx("template"))).status).toBe(403);
  });

  it("never opens a write route: the token cannot hold a write permission", async () => {
    const { token } = await mint(["reports.read", "people.read", "audit.read"]);
    const res = await people.POST(bearer("/api/admin/people/invite-links", token, { method: "POST" }), ctx("invite-links"));
    expect(res.status).toBe(403);
    expect(await db.select().from(t.authTokens)).toEqual([]);
  });

  it("rate-limits each token on its own", async () => {
    const { token, id } = await mint(["reports.read"]);
    const spare = await mint(["reports.read"], "spare");
    for (let i = 0; i < API_TOKEN_RATE_LIMIT; i++) await rateLimit(`api-token:${id}`, API_TOKEN_RATE_LIMIT, 60_000);
    const res = await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await reports.GET(bearer("/api/admin/reports/completion", spare.token), ctx("completion"))).status).toBe(200);
  });

  it("rate-limits a revoked token before auditing its refusals, so a leaked token cannot flood the log", async () => {
    const { token, id } = await mint(["reports.read"], "leaked");
    await revokeApiTokenAction(id);
    const statuses: number[] = [];
    for (let i = 0; i < API_TOKEN_RATE_LIMIT + 5; i++) statuses.push((await reports.GET(bearer("/api/admin/reports/completion", token), ctx("completion"))).status);
    expect(statuses.slice(0, API_TOKEN_RATE_LIMIT).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(API_TOKEN_RATE_LIMIT).every((s) => s === 429)).toBe(true);
    expect((await audited("api_token.refused")).filter((e) => e.targetId === id && (e.meta as { reason: string }).reason === "revoked")).toHaveLength(API_TOKEN_RATE_LIMIT);
  });

  it("refuses a token once the plan loses the integrations feature, while revoking it still works", async () => {
    const org = await addTenant(db, { plan: "professional" });
    const boss = await addUser(db, org.id, { role: "tenant_admin" });
    actor = viewerFor(boss, org);
    try {
      const { token, id } = await mint(["people.read"], "pre-downgrade");
      const [downgraded] = await db.update(t.tenants).set({ features: { integrations: false } }).where(eq(t.tenants.id, org.id)).returning();
      const res = await people.GET(bearer("/api/admin/people/export", token), ctx("export"));
      expect(res.status).toBe(403);
      expect(await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, org.id), eq(t.auditLog.action, "api_token.refused")))).toMatchObject([{ actorId: boss.id, targetId: id, meta: { reason: "plan" } }]);
      actor = viewerFor(boss, downgraded);
      expect(await revokeApiTokenAction(id)).toEqual({ ok: true });
      expect(await createApiTokenAction({ name: "after", permissions: ["people.read"] })).toEqual({ ok: false });
    } finally {
      actor = viewerFor(admin, tenant);
    }
  });

  it("gives all of a creator's tokens one endpoint bucket, apart from the console's", async () => {
    const first = await mint(["reports.read"], "busy");
    const second = await mint(["reports.read"], "fresh");
    let status = 200;
    // Ends at the creator's token bucket (60/h, partly spent above) or, run alone, the per-token 60/min.
    for (let i = 0; i <= API_TOKEN_RATE_LIMIT && status === 200; i++) status = (await reports.GET(bearer("/api/admin/reports/completion", first.token), ctx("completion"))).status;
    expect(status).toBe(429);
    expect((await reports.GET(bearer("/api/admin/reports/completion", second.token), ctx("completion"))).status).toBe(429);
    session = { ...actor, user: { ...actor.user, totpEnabled: true } };
    try {
      expect((await reports.GET(new Request("http://localhost:3000/api/admin/reports/completion"), ctx("completion"))).status).toBe(200);
    } finally {
      session = null;
    }
  });
});

describe("a credential recovery of the creator", () => {
  // Its own organisation: its audit entries, sign-in links and endpoint quota stay apart from the tests above.
  let org: typeof t.tenants.$inferSelect;
  let boss: typeof t.users.$inferSelect;
  beforeAll(async () => {
    org = await addTenant(db, { plan: "professional" });
    boss = await addUser(db, org.id, { role: "tenant_admin" });
  });
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  // Each way the creator's sessions end for a security reason, run with the actor who would run it.
  const recoveries: [string, (creator: typeof t.users.$inferSelect) => Promise<unknown>][] = [
    ["password_change", (c) => ((actor = viewerFor(c, org)), changePasswordAction(PW, "An0ther-long-passphrase", "An0ther-long-passphrase"))],
    [
      "password_reset",
      async (c) => {
        await db.insert(t.authTokens).values({ id: sha256Hex(`reset-${c.id}`), userId: c.id, kind: "reset", expiresAt: new Date(Date.now() + 60_000) });
        return setPasswordAction(undefined, form({ token: `reset-${c.id}`, kind: "reset", password: "An0ther-long-passphrase", confirm: "An0ther-long-passphrase" }));
      },
    ],
    ["other_devices_signed_out", (c) => ((actor = viewerFor(c, org)), signOutOtherDevicesAction())],
    ["sessions_ended", (c) => resetTwoFactorAction(c.id, PW)],
    ["sessions_ended", (c) => setStatusAction([c.id], "suspended")],
  ];

  it.each(recoveries)("revokes the creator's live tokens (%s), audited once each with the reason, and leaves other tokens working", async (reason, recover) => {
    const creator = await addUser(db, org.id, { role: "tenant_admin", passwordHash: await hashPassword(PW) });
    actor = viewerFor(creator, org);
    const mine = await mint(["reports.read"], "creator's");
    const expired = await mint(["reports.read"], "already expired");
    await db.update(t.apiTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(t.apiTokens.id, expired.id));
    actor = viewerFor(boss, org);
    const others = await mint(["reports.read"], "someone else's");
    try {
      expect(await recover(creator)).toMatchObject(reason === "password_reset" ? { done: true } : { ok: true });
    } finally {
      actor = viewerFor(admin, tenant);
    }
    // A suspension refuses as creator_inactive anyway; the revocation is what keeps a reactivation from reviving it.
    await db.update(t.users).set({ status: "active" }).where(eq(t.users.id, creator.id));
    expect((await reports.GET(bearer("/api/admin/reports/completion", mine.token), ctx("completion"))).status).toBe(401);
    expect(await audited("api_token.refused", org.id)).toContainEqual(expect.objectContaining({ targetId: mine.id, meta: { reason: "revoked" } }));
    const revoked = (await audited("api_token.revoked", org.id)).filter((e) => e.targetId === mine.id || e.targetId === expired.id);
    expect(revoked).toMatchObject([{ actorId: null, targetId: mine.id, meta: { name: "creator's", reason } }]);
    expect((await reports.GET(bearer("/api/admin/reports/completion", others.token), ctx("completion"))).status).toBe(200);
  });
});
