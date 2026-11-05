import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => void jar.set(name, { value, options }),
    delete: (o: { name: string }) => void jar.delete(o.name),
  }),
  headers: async () => new Headers(),
}));
vi.mock("../src/server/request", () => ({ currentPath: async () => "/learn" }));

const session = await import("../src/server/auth/session");
const viewer = await import("../src/server/auth/viewer");
const { sha256Hex } = await import("../src/server/crypto");

beforeAll(ready, DB_SETUP_TIMEOUT);
beforeEach(() => jar.clear());

const DAY = 86_400_000;
const sessionsOf = (userId: string) => db.select().from(t.sessions).where(eq(t.sessions.userId, userId));
const base = { twoFactorVerified: false, ip: "10.0.0.1", userAgent: "Vitest", maxDevices: null };

describe("createSession", () => {
  it("stores only the token's hash, for 30 days, with a watermark code for the leak check", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id);
    const before = Date.now();
    const s = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id });
    expect(s.token).toMatch(/^[a-z2-7]{39}$/);
    expect(s.id).toBe(sha256Hex(s.token));
    const [row] = await sessionsOf(user.id);
    expect(row).toMatchObject({ id: s.id, tenantId: tenant.id, ip: "10.0.0.1", userAgent: "Vitest", twoFactorVerified: false });
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(30 * DAY - 5_000);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(30 * DAY + 5_000);
    const [code] = await db.select().from(t.watermarkCodes).where(eq(t.watermarkCodes.sessionId, s.id));
    expect(code.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(code.userId).toBe(user.id);
  });

  it("signs out the least recently used devices beyond the limit, and logs each", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id);
    const old = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id });
    await db.update(t.sessions).set({ lastSeenAt: new Date(Date.now() - 3 * DAY) }).where(eq(t.sessions.id, old.id));
    const mid = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id });
    await db.update(t.sessions).set({ lastSeenAt: new Date(Date.now() - DAY) }).where(eq(t.sessions.id, mid.id));
    const fresh = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id, maxDevices: 2 });
    expect((await sessionsOf(user.id)).map((s) => s.id).sort()).toEqual([mid.id, fresh.id].sort());
    const logs = await db.select().from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id));
    expect(logs.map((l) => l.action)).toEqual(["auth.device_limit"]);
  });

  it("keeps the new session and still enforces the limit when another device was seen later (clocks out of step)", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id);
    const a = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id });
    const b = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id });
    // The app server that last saw these devices runs a minute ahead of the database.
    await db.update(t.sessions).set({ lastSeenAt: new Date(Date.now() + 60_000) }).where(eq(t.sessions.id, a.id));
    await db.update(t.sessions).set({ lastSeenAt: new Date(Date.now() + 120_000) }).where(eq(t.sessions.id, b.id));
    const fresh = await session.createSession({ ...base, userId: user.id, tenantId: tenant.id, maxDevices: 2 });
    const left = (await sessionsOf(user.id)).map((s) => s.id);
    expect(left).toContain(fresh.id);
    expect(left).toHaveLength(2);
    expect(left).not.toContain(a.id);
  });
});

describe("ending sessions", () => {
  it("ends one session, or every session of a person except the current one", async () => {
    const tenant = await addTenant(db);
    const user = await addUser(db, tenant.id);
    const other = await addUser(db, tenant.id);
    const [a, b, c] = [
      await session.createSession({ ...base, userId: user.id, tenantId: tenant.id }),
      await session.createSession({ ...base, userId: user.id, tenantId: tenant.id }),
      await session.createSession({ ...base, userId: user.id, tenantId: tenant.id }),
    ];
    const keep = await session.createSession({ ...base, userId: other.id, tenantId: tenant.id });
    await session.invalidateSession(a.id);
    expect((await sessionsOf(user.id)).map((s) => s.id).sort()).toEqual([b.id, c.id].sort());
    await session.invalidateUserSessions(user.id, c.id);
    expect((await sessionsOf(user.id)).map((s) => s.id)).toEqual([c.id]);
    await session.invalidateUserSessions(user.id);
    expect(await sessionsOf(user.id)).toEqual([]);
    expect((await sessionsOf(other.id)).map((s) => s.id)).toEqual([keep.id]);
  });
});

describe("the session cookie", () => {
  it("is http-only, same-site lax and scoped to the whole site", async () => {
    const expires = new Date(Date.now() + DAY);
    await session.setSessionCookie("tok", expires);
    expect(jar.get(session.SESSION_COOKIE)).toEqual({ value: "tok", options: { httpOnly: true, sameSite: "lax", secure: false, path: "/", expires } });
    expect(await session.readSessionToken()).toBe("tok");
    await session.clearSessionCookie();
    expect(await session.readSessionToken()).toBeNull();
  });
});

describe("getSession and getViewer", () => {
  async function signedIn(o: Partial<typeof t.users.$inferInsert> = {}, s: { twoFactorVerified?: boolean } = {}) {
    const tenant = await addTenant(db, { plan: "professional" });
    const user = await addUser(db, tenant.id, o);
    const created = await session.createSession({ ...base, ...s, userId: user.id, tenantId: tenant.id });
    jar.set(session.SESSION_COOKIE, { value: created.token });
    return { tenant, user, created };
  }

  it("returns the person and the organisation with its settings and plan features", async () => {
    const { tenant, user } = await signedIn({ role: "analyst" });
    const v = await viewer.getSession();
    expect(v?.user).toMatchObject({ id: user.id, role: "analyst", email: user.email });
    expect(v?.tenant).toMatchObject({ id: tenant.id, plan: "professional" });
    expect(v?.tenant.features.has("sandbox")).toBe(true);
    expect(v?.tenant.features.has("closed_loops")).toBe(false);
    expect(v?.tenant.settings.identity.requireAdmin2fa).toBe(true);
  });

  it("refuses a missing, unknown, oversized or expired token, and ends the expired session", async () => {
    expect(await viewer.getSession()).toBeNull();
    jar.set(session.SESSION_COOKIE, { value: "unknown" });
    expect(await viewer.getSession()).toBeNull();
    jar.set(session.SESSION_COOKIE, { value: "x".repeat(101) });
    expect(await viewer.getSession()).toBeNull();
    const { user, created } = await signedIn();
    await db.update(t.sessions).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(t.sessions.id, created.id));
    expect(await viewer.getSession()).toBeNull();
    expect(await sessionsOf(user.id)).toEqual([]);
  });

  it("refuses suspended people", async () => {
    await signedIn({ status: "suspended" });
    expect(await viewer.getSession()).toBeNull();
  });

  it("records activity at most every five minutes and extends a session past half its life", async () => {
    const { user, created } = await signedIn();
    await viewer.getSession();
    const [fresh] = await sessionsOf(user.id);
    const [u0] = await db.select({ at: t.users.lastActiveAt }).from(t.users).where(eq(t.users.id, user.id));
    expect(u0.at).toBeNull();
    const stale = new Date(Date.now() - 10 * 60_000);
    const nearlyOver = new Date(Date.now() + 2 * DAY);
    await db.update(t.sessions).set({ lastSeenAt: stale, expiresAt: nearlyOver }).where(eq(t.sessions.id, created.id));
    await viewer.getSession();
    const [renewed] = await sessionsOf(user.id);
    expect(renewed.lastSeenAt.getTime()).toBeGreaterThan(stale.getTime());
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(nearlyOver.getTime());
    expect(renewed.expiresAt.getTime()).toBeLessThanOrEqual(fresh.createdAt.getTime() + 90 * DAY);
    const [u1] = await db.select({ at: t.users.lastActiveAt }).from(t.users).where(eq(t.users.id, user.id));
    expect(u1.at).toBeInstanceOf(Date);
  });

  it("holds back people with two-step verification until the second step is done", async () => {
    await signedIn({ totpEnabled: true, totpSecret: "x" });
    expect(await viewer.getSession()).not.toBeNull();
    expect(await viewer.getViewer()).toBeNull();
    await expect(viewer.actionViewer()).rejects.toThrow("UNAUTHENTICATED");
    await signedIn({ totpEnabled: true, totpSecret: "x" }, { twoFactorVerified: true });
    expect(await viewer.getViewer()).not.toBeNull();
  });
});

describe("actionViewer", () => {
  async function as(role: t.Role, o: { plan?: t.Plan; totp?: boolean } = {}) {
    const tenant = await addTenant(db, { plan: o.plan ?? "enterprise_hrm" });
    const user = await addUser(db, tenant.id, { role, totpEnabled: !!o.totp, totpSecret: o.totp ? "x" : null });
    const created = await session.createSession({ ...base, twoFactorVerified: !!o.totp, userId: user.id, tenantId: tenant.id });
    jar.set(session.SESSION_COOKIE, { value: created.token });
  }

  it("lets self-service actions through and checks permission, plan feature and the admin 2FA rule", async () => {
    await as("learner");
    await expect(viewer.actionViewer()).resolves.toBeTruthy();
    await expect(viewer.actionViewer("campaigns.write")).rejects.toThrow("FORBIDDEN");
    await as("campaign_manager");
    await expect(viewer.actionViewer("campaigns.write")).rejects.toThrow("TWO_FACTOR_REQUIRED");
    await as("campaign_manager", { totp: true });
    await expect(viewer.actionViewer("campaigns.write")).resolves.toBeTruthy();
    await as("analyst", { plan: "essentials", totp: true });
    await expect(viewer.actionViewer("studio.write")).rejects.toThrow("FORBIDDEN");
  });
});
