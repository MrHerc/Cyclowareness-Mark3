import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { can, PERMISSION_FEATURE, type Permission } from "../src/server/auth/permissions";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
type V = { user: typeof t.users.$inferSelect; tenant: { id: string; slug: string; name: string; plan: t.Plan; branding: t.TenantBranding; settings: t.TenantSettings; features: Set<string> } };
/** Each action takes the next viewer in line, so two people can act in one Promise.all. */
const viewers: V[] = [];

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: {}, appUrl: () => "https://portal.example" }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en", getTranslations: async () => (k: string) => k }));
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => viewers.shift()!,
  allowed: (v: V, p: Permission) => can(v.user.role, p) && (!PERMISSION_FEATURE[p] || v.tenant.features.has(PERMISSION_FEATURE[p]!)),
  privileged: (v: V, p: Permission) => can(v.user.role, p) && (!PERMISSION_FEATURE[p] || v.tenant.features.has(PERMISSION_FEATURE[p]!)),
  hasFeature: (v: V, f: string) => v.tenant.features.has(f),
}));

const engage = await import("../src/server/actions/engage");

beforeAll(ready, DB_SETUP_TIMEOUT);

async function org(people: number) {
  const tenant = await addTenant(db, { plan: "enterprise_hrm", settings: withDefaults({ defaultLocale: "en" }) });
  const [session] = await db.insert(t.liveSessions).values({ tenantId: tenant.id, title: "Phishing clinic", startsAt: new Date(Date.now() + 86_400_000), durationMin: 60, location: "Room 1", host: "Leyla", capacity: 1 }).returning();
  const as = async (): Promise<V> => {
    const user = await addUser(db, tenant.id);
    return { user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } };
  };
  const vs: V[] = [];
  for (let i = 0; i < people; i++) vs.push(await as());
  return { session, vs };
}

describe("toggleSessionAction", () => {
  it("fills the last seat once when two people register at the same time", async () => {
    const { session, vs } = await org(2);
    viewers.push(...vs);
    const results = await Promise.all([engage.toggleSessionAction(session.id, true), engage.toggleSessionAction(session.id, true)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: "full" });
    expect(await db.select().from(t.sessionRegistrations).where(eq(t.sessionRegistrations.sessionId, session.id))).toHaveLength(1);
  });

  it("lets the registered person leave, which frees the seat", async () => {
    const { session, vs } = await org(2);
    viewers.push(vs[0], vs[1], vs[0], vs[1]);
    expect(await engage.toggleSessionAction(session.id, true)).toEqual({ ok: true });
    expect(await engage.toggleSessionAction(session.id, true)).toEqual({ ok: false, error: "full" });
    expect(await engage.toggleSessionAction(session.id, false)).toEqual({ ok: true });
    expect(await engage.toggleSessionAction(session.id, true)).toEqual({ ok: true });
    expect((await db.select().from(t.sessionRegistrations).where(eq(t.sessionRegistrations.sessionId, session.id))).map((r) => r.userId)).toEqual([vs[1].user.id]);
  });
});
