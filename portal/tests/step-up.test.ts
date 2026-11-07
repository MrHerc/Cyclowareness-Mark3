import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Role } from "../src/server/db/schema";
import type { Mail } from "../src/server/mail";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

/*
 * Account-takeover tooling (S-06): a 2FA reset, a password reset link, a role change and the
 * operator's support link take the actor's own password (10 tries per actor per 15 minutes),
 * tell the person and, for an administrator, the other administrators, and the operator's link
 * works only inside a 72-hour window the organisation granted in Settings → Security.
 */
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key, getFormatter: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/queries/admin", () => ({}));
vi.mock("../src/server/auth/session", () => ({ invalidateUserSessions: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => "127.0.0.1" }));
vi.mock("../src/server/auth/domain-proof", () => ({ normaliseHost: (d: string) => d, domainProofRecord: () => "", domainProofFound: vi.fn() }));
const issueAccountLink = vi.fn(async (userId: string, kind: string) => `http://localhost/account/${kind}/token-for-${userId}`);
vi.mock("../src/server/auth/links", () => ({ issueAccountLink: (userId: string, kind: string) => issueAccountLink(userId, kind) }));
const sent: Mail[] = [];
vi.mock("../src/server/mail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server/mail")>()),
  queueEmail: vi.fn(async (_db: unknown, _tenantId: unknown, mail: Mail) => {
    sent.push(mail);
    return { id: "1", status: "logged" };
  }),
}));

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

let actor = { id: "", name: "", email: "", role: "tenant_admin" as Role };
let tenant = { id: "", name: "" };
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({ user: actor, tenant: { ...tenant, features: new Set(), settings: { defaultLocale: "en", email: { enabled: false } } } }),
  hasFeature: () => true,
}));

const people = await import("../src/server/actions/people");
const platform = await import("../src/server/actions/platform");
const settings = await import("../src/server/actions/settings");
const { hashPassword } = await import("../src/server/auth/password");

const PW = "Correct-Horse-Battery-9";
type U = typeof t.users.$inferSelect;
let org: { id: string; name: string };
let platformOrg: { id: string; name: string };
let admin: U, admin2: U, limited: U, peer: U, targetAdmin: U, learner: U, invited: U, suspended: U, operator: U;

const as = (u: U) => {
  actor = { id: u.id, name: u.name, email: u.email, role: u.role };
  tenant = u.tenantId === org.id ? org : platformOrg;
};
const row = async (id: string) => (await db.select().from(t.users).where(eq(t.users.id, id)))[0];
const notices = (userId: string) => db.select().from(t.notifications).where(eq(t.notifications.userId, userId));
const audits = (tenantId: string, action: string) => db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenantId), eq(t.auditLog.action, action)));
const supportUntil = async () => (await db.select({ s: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, org.id)))[0].s.security?.supportAccessUntil ?? null;

beforeAll(async () => {
  await ready();
  const passwordHash = await hashPassword(PW);
  org = await addTenant(db, { name: "Acme" });
  platformOrg = await addTenant(db, { slug: "platform", name: "Platform" });
  const adminOf = (o: { id: string }, name: string, role: Role = "tenant_admin") => addUser(db, o.id, { name, role, passwordHash, totpEnabled: true, totpSecret: "secret" });
  admin = await adminOf(org, "Aysel Admin");
  admin2 = await adminOf(org, "Rauf Admin");
  limited = await adminOf(org, "Leyla Admin");
  peer = await adminOf(org, "Nigar Peer");
  targetAdmin = await adminOf(org, "Murad Target");
  learner = await addUser(db, org.id, { name: "Kamran Learner", totpEnabled: true, totpSecret: "secret" });
  invited = await addUser(db, org.id, { name: "Invited Person", status: "invited" });
  suspended = await addUser(db, org.id, { name: "Suspended Person", status: "suspended" });
  operator = await adminOf(platformOrg, "Platform Operator", "super_admin");
}, DB_SETUP_TIMEOUT);

describe("step-up before account-takeover actions", () => {
  it("refuses a 2FA reset with the wrong password, leaves the account alone and records the refusal", async () => {
    as(admin);
    expect(await people.resetTwoFactorAction(targetAdmin.id, "not-it")).toEqual({ ok: false, error: "wrongPassword" });
    expect((await row(targetAdmin.id)).totpEnabled).toBe(true);
    const [failed] = await audits(org.id, "security.step_up_failed");
    expect(failed).toMatchObject({ actorId: admin.id, targetType: "user", targetId: targetAdmin.id, meta: { action: "auth.2fa_reset", error: "wrongPassword" } });
  });

  it("resets 2FA with the right password and tells the person and every other administrator", async () => {
    as(admin);
    expect(await people.resetTwoFactorAction(targetAdmin.id, PW)).toEqual({ ok: true });
    expect((await row(targetAdmin.id)).totpEnabled).toBe(false);
    expect(await audits(org.id, "auth.2fa_reset")).toHaveLength(1);
    expect(await notices(targetAdmin.id)).toMatchObject([{ kind: "twoFactorReset", href: "/profile" }]);
    expect(sent.map((m) => [m.to, m.subject])).toEqual([[targetAdmin.email, "Your two-step verification was reset"]]);
    const [toPeer] = await notices(peer.id);
    expect(toPeer).toMatchObject({ kind: "security", href: `/admin/users/${targetAdmin.id}` });
    expect(toPeer.title).toContain(targetAdmin.name);
    expect(toPeer.title).toContain(admin.name);
    // The actor needs no notice of their own action.
    expect(await notices(admin.id)).toEqual([]);
  });

  it("tells only the person when they do not administer the organisation", async () => {
    as(admin);
    const before = (await notices(peer.id)).length;
    expect(await people.resetTwoFactorAction(learner.id, PW)).toEqual({ ok: true });
    expect(await notices(learner.id)).toMatchObject([{ kind: "twoFactorReset" }]);
    expect((await notices(peer.id)).length).toBe(before);
  });

  it("locks the actor out after 10 failures, even with the right password", async () => {
    as(limited);
    for (let i = 0; i < 10; i++) expect(await people.resetTwoFactorAction(learner.id, "not-it")).toEqual({ ok: false, error: "wrongPassword" });
    expect(await people.resetTwoFactorAction(learner.id, PW)).toEqual({ ok: false, error: "rateLimited" });
    const refusals = (await audits(org.id, "security.step_up_failed")).filter((a) => a.actorId === limited.id);
    expect(refusals.map((a) => a.meta?.error)).toEqual([...Array(10).fill("wrongPassword"), "rateLimited"]);
  });

  it("asks for the password for a reset link but not for an invite link, which only a never-activated account gets", async () => {
    as(admin2);
    // Without this an invite link for a live account would be a password reset without the step-up.
    issueAccountLink.mockClear();
    expect(await people.createLinkAction(learner.id, "invite")).toEqual({ ok: false });
    expect(issueAccountLink).not.toHaveBeenCalled();
    expect(await audits(org.id, "person.invite_link")).toEqual([]);
    expect(await people.createLinkAction(invited.id, "invite")).toMatchObject({ ok: true, url: expect.stringContaining("/invite/") });
    expect(await people.createLinkAction(learner.id, "reset")).toEqual({ ok: false, error: "wrongPassword" });
    expect(await people.createLinkAction(learner.id, "reset", PW)).toMatchObject({ ok: true, url: expect.stringContaining("/reset/") });
    expect(await notices(learner.id)).toMatchObject([{ kind: "twoFactorReset" }, { kind: "resetLinkIssued", href: "/profile" }]);
    expect(sent.at(-1)).toMatchObject({ to: learner.email, subject: "A password reset link was created for your account" });
  });

  it("still tells a suspended person, so suspend-reset-reactivate leaves a trace", async () => {
    as(admin);
    expect(await people.createLinkAction(suspended.id, "reset", PW)).toMatchObject({ ok: true });
    expect(await notices(suspended.id)).toMatchObject([{ kind: "resetLinkIssued" }]);
    expect(sent.at(-1)).toMatchObject({ to: suspended.email, subject: "A password reset link was created for your account" });
  });

  it("asks for the password only when the role actually changes, and names the new role", async () => {
    as(admin2);
    expect(await people.changeRoleAction(learner.id, "learner")).toEqual({ ok: true });
    expect(await audits(org.id, "person.role_changed")).toEqual([]);
    expect(await people.changeRoleAction(learner.id, "analyst", "not-it")).toEqual({ ok: false, error: "wrongPassword" });
    expect((await row(learner.id)).role).toBe("learner");
    expect(await people.changeRoleAction(learner.id, "analyst", PW)).toEqual({ ok: true });
    expect((await row(learner.id)).role).toBe("analyst");
    expect(await audits(org.id, "person.role_changed")).toHaveLength(1);
    expect(sent.at(-1)).toMatchObject({ to: learner.email, subject: `Your role in ${org.name} changed` });
    expect(sent.at(-1)?.text).toContain("Analyst");
    // Making someone an administrator is a peer action: the other administrators hear of it.
    const before = (await notices(peer.id)).length;
    expect(await people.changeRoleAction(learner.id, "tenant_admin", PW)).toEqual({ ok: true });
    expect((await notices(peer.id)).length).toBe(before + 1);
  });
});

describe("the operator's support link", () => {
  it("is refused without the operator's password and without the organisation's grant", async () => {
    as(operator);
    issueAccountLink.mockClear();
    expect(await platform.adminLinkAction(org.id, targetAdmin.id, "not-it")).toEqual({ ok: false, error: "wrongPassword" });
    expect(await platform.adminLinkAction(org.id, targetAdmin.id, PW)).toEqual({ ok: false, error: "supportAccess" });
    expect(issueAccountLink).not.toHaveBeenCalled();
    expect((await audits(platformOrg.id, "security.step_up_failed")).map((a) => a.meta?.action)).toEqual(["platform.admin_link"]);
  });

  it("works for 72 hours after the organisation's administrator grants it, and tells the administrator", async () => {
    as(admin);
    const before = Date.now();
    expect(await settings.grantSupportAccessAction()).toEqual({ ok: true });
    const until = Date.parse((await supportUntil()) ?? "");
    expect(until - before).toBeGreaterThanOrEqual(72 * 3_600_000 - 5_000);
    expect(until - before).toBeLessThanOrEqual(72 * 3_600_000 + 5_000);
    expect(await audits(org.id, "support.access_granted")).toHaveLength(1);

    as(operator);
    const peerBefore = (await notices(peer.id)).length;
    expect(await platform.adminLinkAction(org.id, targetAdmin.id, PW)).toMatchObject({ ok: true, link: expect.stringContaining("/reset/") });
    expect(await audits(org.id, "platform.admin_link")).toHaveLength(1);
    expect((await notices(targetAdmin.id)).at(-1)).toMatchObject({ kind: "resetLinkIssued" });
    expect((await notices(peer.id)).length).toBe(peerBefore + 1);
  });

  it("is refused again once the grant is revoked or has run out", async () => {
    as(admin);
    expect(await settings.revokeSupportAccessAction()).toEqual({ ok: true });
    expect(await supportUntil()).toBeNull();
    expect(await audits(org.id, "support.access_revoked")).toHaveLength(1);
    as(operator);
    expect(await platform.adminLinkAction(org.id, targetAdmin.id, PW)).toEqual({ ok: false, error: "supportAccess" });

    const [{ s }] = await db.select({ s: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, org.id));
    await db
      .update(t.tenants)
      .set({ settings: { ...s, security: { supportAccessUntil: new Date(Date.now() - 1_000).toISOString() } } })
      .where(eq(t.tenants.id, org.id));
    expect(await platform.adminLinkAction(org.id, targetAdmin.id, PW)).toEqual({ ok: false, error: "supportAccess" });
  });
});
