import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import type { Role } from "../src/server/db/schema";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/services/notify", () => ({ notifyUsers: vi.fn(), notifyTakeover: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/queries/admin", () => ({}));
const issueAccountLink = vi.fn(async (userId: string, kind: string) => `http://localhost/account/${kind}/token-for-${userId}`);
vi.mock("../src/server/auth/links", () => ({ issueAccountLink: (userId: string, kind: string) => issueAccountLink(userId, kind) }));
vi.mock("../src/server/auth/session", () => ({ invalidateUserSessions: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => "127.0.0.1" }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

let tenantId = "";
let actor = { id: "", role: "tenant_admin" as Role };
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({ user: actor, tenant: { id: tenantId, features: new Set(), settings: { defaultLocale: "en", email: { enabled: false } } } }),
}));

const people = await import("../src/server/actions/people");
const { hashPassword } = await import("../src/server/auth/password");

const ids = { operator: "", second: "", admin: "", learner: "" };
let departmentId = "";
// Takeover actions (reset link, 2FA reset, role change) take the actor's own password.
const PW = "Correct-Horse-Battery-9";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "platform", name: "Platform", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  const [dept] = await db.insert(t.departments).values({ tenantId, name: "Ops", nameKey: "ops" }).returning();
  departmentId = dept.id;
  const passwordHash = await hashPassword(PW);
  const add = async (email: string, role: Role) =>
    (await db.insert(t.users).values({ tenantId, email, name: email.split("@")[0], role, passwordHash, totpEnabled: true, totpSecret: "secret", deletionRequestedAt: new Date() }).returning())[0].id;
  ids.operator = await add("operator@platform.test", "super_admin");
  ids.second = await add("second@platform.test", "super_admin");
  ids.admin = await add("admin@platform.test", "tenant_admin");
  ids.learner = await add("learner@platform.test", "learner");
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

const row = async (id: string) => (await db.select().from(t.users).where(eq(t.users.id, id)))[0];

describe("a tenant admin and the platform operator", () => {
  it("cannot reach a super_admin through any people action", async () => {
    actor = { id: ids.admin, role: "tenant_admin" };
    const before = await row(ids.operator);
    expect(await people.createLinkAction(ids.operator, "reset", PW)).toEqual({ ok: false });
    expect(await people.createLinkAction(ids.operator, "invite")).toEqual({ ok: false });
    expect(await people.resetTwoFactorAction(ids.operator, PW)).toEqual({ ok: false });
    expect(await people.changeRoleAction(ids.operator, "learner", PW)).toEqual({ ok: false });
    expect(await people.updatePersonAction(ids.operator, { name: "Taken over", locale: "en", phone: "" })).toMatchObject({ ok: false });
    expect(await people.setStatusAction([ids.operator], "suspended")).toEqual({ ok: false });
    expect(await people.moveDepartmentAction([ids.operator], departmentId)).toEqual({ ok: false });
    expect(await people.deletePersonAction(ids.operator)).toEqual({ ok: false });
    expect(await people.decideDeletionAction(ids.operator, true)).toEqual({ ok: false });
    expect(issueAccountLink).not.toHaveBeenCalled();
    expect(await row(ids.operator)).toEqual(before);
  });

  it("still acts on everyone else in a bulk selection that includes a super_admin", async () => {
    actor = { id: ids.admin, role: "tenant_admin" };
    expect(await people.setStatusAction([ids.operator, ids.learner], "suspended")).toEqual({ ok: true });
    expect((await row(ids.learner)).status).toBe("suspended");
    expect((await row(ids.operator)).status).toBe("active");
    expect(await people.moveDepartmentAction([ids.operator, ids.learner], departmentId)).toEqual({ ok: true });
    expect((await row(ids.learner)).departmentId).toBe(departmentId);
    expect((await row(ids.operator)).departmentId).toBeNull();
    await people.setStatusAction([ids.learner], "active");
  });

  it("leaves a super_admin to another super_admin", async () => {
    actor = { id: ids.operator, role: "super_admin" };
    expect(await people.resetTwoFactorAction(ids.second, PW)).toEqual({ ok: true });
    expect((await row(ids.second)).totpEnabled).toBe(false);
    expect(await people.createLinkAction(ids.second, "reset", PW)).toMatchObject({ ok: true });
  });
});

describe("deleting a person", () => {
  it("removes their mail from the outbox, the sign-off IP and the address in audit entries", async () => {
    actor = { id: ids.admin, role: "tenant_admin" };
    const email = "learner@platform.test";
    await db.insert(t.outbox).values([
      { tenantId, to: email, subject: "Reminder", html: "<p>Hi learner</p>", text: "Hi learner", kind: "reminder", status: "queued" },
      { tenantId, to: email, subject: "Welcome", html: "<p>Welcome</p>", text: "Welcome", kind: "welcome", status: "failed" },
      { tenantId, to: "Learner@Platform.test", subject: "Typed", html: "<p>Typed</p>", text: "Typed", kind: "reminder", status: "queued" },
      { tenantId, to: "admin@platform.test", subject: "Other", html: "<p>Other</p>", text: "Other", kind: "reminder", status: "sent" },
    ]);
    const [policy] = await db.insert(t.policies).values({ tenantId, title: "AUP" }).returning();
    const [version] = await db.insert(t.policyVersions).values({ policyId: policy.id, version: 1, title: "AUP", bodyMd: "Text" }).returning();
    await db.insert(t.policySignoffs).values({ versionId: version.id, userId: ids.learner, ip: "198.51.100.7" });
    await db.insert(t.auditLog).values([
      { tenantId, actorId: ids.admin, action: "person.added", targetType: "user", targetId: ids.learner, meta: { email, role: "learner" } },
      { tenantId, actorId: ids.admin, action: "person.added", targetType: "user", targetId: ids.admin, meta: { email: "admin@platform.test", role: "tenant_admin" } },
    ]);

    expect(await people.deletePersonAction(ids.learner)).toEqual({ ok: true });

    const mail = await db.select({ to: t.outbox.to }).from(t.outbox).where(eq(t.outbox.tenantId, tenantId));
    expect(mail).toEqual([{ to: "admin@platform.test" }]);
    expect((await db.select({ ip: t.policySignoffs.ip }).from(t.policySignoffs).where(eq(t.policySignoffs.userId, ids.learner)))[0].ip).toBeNull();
    const meta = new Map((await db.select({ targetId: t.auditLog.targetId, meta: t.auditLog.meta }).from(t.auditLog)).map((r) => [r.targetId, r.meta]));
    expect(meta.get(ids.learner)).toEqual({ role: "learner" });
    expect(meta.get(ids.admin)).toEqual({ email: "admin@platform.test", role: "tenant_admin" });
    expect((await row(ids.learner)).email).toBe(`deleted+${ids.learner}@invalid.local`);
  });
});

describe("unlinking single sign-on", () => {
  it("clears the bound provider identity and records it", async () => {
    const { audit } = await import("../src/server/services/audit");
    actor = { id: ids.admin, role: "tenant_admin" };
    const [u] = await db.insert(t.users).values({ tenantId, email: "sso@platform.test", name: "Sso", ssoSubject: "https://idp.test sub-1" }).returning();
    expect(await people.unlinkSsoAction(u.id)).toEqual({ ok: true });
    expect((await db.select({ s: t.users.ssoSubject }).from(t.users).where(eq(t.users.id, u.id)))[0].s).toBeNull();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "sso.unlinked", targetId: u.id }));
    // Nothing to unlink: no entry, no success.
    expect(await people.unlinkSsoAction(u.id)).toEqual({ ok: false });
  });
});
