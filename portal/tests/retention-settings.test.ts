import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { withDefaults } from "../src/lib/tenant-defaults";
import { addTenant, DB_SETUP_TIMEOUT, testDb } from "./helpers/db";

const { db, ready } = testDb();
const audit = vi.fn();
vi.mock("../src/server/services/audit", () => ({ audit }));
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
let viewer: { user: { id: string }; tenant: { id: string } } | null = null;
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => viewer, hasFeature: () => true }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("next/cache", () => ({ refresh: () => {} }));

const { saveRetentionAction } = await import("../src/server/actions/settings");

beforeAll(ready, DB_SETUP_TIMEOUT);

describe("saveRetentionAction", () => {
  it("keeps everything by default, stores valid months per organisation with an audit entry and refuses the rest", async () => {
    expect(withDefaults({}).retention).toEqual({ auditMonths: 0, learningMonths: 0 });
    const tenant = await addTenant(db);
    const other = await addTenant(db);
    viewer = { user: { id: "00000000-0000-4000-8000-000000000001" }, tenant: { id: tenant.id } };
    const stored = async (id: string) => withDefaults((await db.select({ s: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, id)))[0].s).retention;

    expect(await saveRetentionAction({ auditMonths: 121, learningMonths: 0 })).toEqual({ ok: false, field: "auditMonths" });
    expect(await saveRetentionAction({ auditMonths: 0, learningMonths: -1 })).toEqual({ ok: false, field: "learningMonths" });
    expect(await saveRetentionAction({ auditMonths: 1.5, learningMonths: 0 })).toEqual({ ok: false, field: "auditMonths" });
    // The audit log is the trace of the administrators' own actions: never purged before a year.
    expect(await saveRetentionAction({ auditMonths: 1, learningMonths: 0 })).toEqual({ ok: false, field: "auditMonths" });
    expect(await saveRetentionAction({ auditMonths: 11, learningMonths: 1 })).toEqual({ ok: false, field: "auditMonths" });
    expect(await stored(tenant.id)).toEqual({ auditMonths: 0, learningMonths: 0 });
    expect(audit).not.toHaveBeenCalled();

    expect(await saveRetentionAction({ auditMonths: 12, learningMonths: 1 })).toEqual({ ok: true });
    expect(await stored(tenant.id)).toEqual({ auditMonths: 12, learningMonths: 1 });
    expect(await saveRetentionAction({ auditMonths: 24, learningMonths: 120 })).toEqual({ ok: true });
    expect(await stored(tenant.id)).toEqual({ auditMonths: 24, learningMonths: 120 });
    expect(await stored(other.id)).toEqual({ auditMonths: 0, learningMonths: 0 });
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: tenant.id, action: "settings.retention", meta: { auditMonths: 24, learningMonths: 120 } }));
  });
});
