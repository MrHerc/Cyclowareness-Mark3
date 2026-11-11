import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { withDefaults } from "../src/lib/tenant-defaults";
import { DB_SETUP_TIMEOUT, addDepartment, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
beforeAll(ready, DB_SETUP_TIMEOUT);

// Runs once, between managerAlerts' read of the people and its notices: a deletion committed in that window.
let deleteDuringTick: (() => Promise<void>) | null = null;
vi.mock("../src/server/services/assignments", async (original) => {
  const m = await original<typeof import("../src/server/services/assignments")>();
  return {
    ...m,
    resolveAssignments: async (...a: Parameters<typeof m.resolveAssignments>) => {
      const run = deleteDuringTick;
      deleteDuringTick = null;
      await run?.();
      return m.resolveAssignments(...a);
    },
  };
});

const { managerAlerts } = await import("../src/server/jobs");

describe("manager alerts", () => {
  it("name no person deleted after the tick read the team", async () => {
    const now = new Date();
    const org = await addTenant(db);
    const dept = await addDepartment(db, org.id, "Sales");
    const head = await addUser(db, org.id, { departmentId: dept.id });
    await db.update(t.departments).set({ headUserId: head.id }).where(eq(t.departments.id, dept.id));
    const gone = await addUser(db, org.id, { departmentId: dept.id, name: "Kamran Clicker" });
    const stays = await addUser(db, org.id, { departmentId: dept.id, name: "Still Here" });
    // Two clicks each in the last 30 days: the default alert threshold.
    const [c] = await db.insert(t.campaigns).values({ tenantId: org.id, name: "C", channel: "email", templateKey: "payslip", audience: "all", status: "running", launchedAt: now }).returning();
    for (const u of [gone, stays, gone, stays]) await db.insert(t.campaignRecipients).values({ campaignId: c.id, userId: u.id, token: crypto.randomUUID(), sentAt: now, clickedAt: now });
    deleteDuringTick = async () => {
      await db.update(t.users).set({ name: "—", status: "deleted" }).where(eq(t.users.id, gone.id));
    };

    expect(await managerAlerts(db, { id: org.id, name: org.name, settings: withDefaults(org.settings), branding: { primary: "#4f46e5" } }, now)).toBe(1);
    expect(deleteDuringTick).toBeNull();
    const notices = await db.select({ title: t.notifications.title }).from(t.notifications).where(and(eq(t.notifications.userId, head.id), eq(t.notifications.kind, "manager")));
    expect(notices.map((n) => n.title)).toEqual(["Still Here"]);
  }, 60_000);
});
