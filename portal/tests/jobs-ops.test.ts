import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { monthsBefore, runJobs } from "../src/server/jobs";
import { defaultSettings } from "../src/lib/tenant-defaults";
import { addModule, addTenant, addUser, DB_SETUP_TIMEOUT, testDb } from "./helpers/db";

const { db, ready } = testDb();
const DAY = 86_400_000;
let tenantId = "";

beforeAll(async () => {
  await ready();
  tenantId = (await addTenant(db)).id;
}, DB_SETUP_TIMEOUT);

const demo = (name: string, createdAt: Date) => ({ name, email: `${name}@test.example`, organisation: "Org", country: "AZ", employees: "50-200", locale: "en", consentVersion: "2026-01-01", createdAt });
const answer = (id: string, createdAt: Date) => ({ id, tenantId, lessonId: crypto.randomUUID(), question: "q", answer: "a", model: "m", createdAt });

describe("job runner tick", () => {
  it("records its heartbeat at the end of every tick", async () => {
    const first = new Date("2026-11-05T10:00:00Z");
    const out = await runJobs(db, first);
    expect(out.tick).toBe(1);
    const second = new Date(first.getTime() + 60_000);
    await runJobs(db, second);
    const rows = await db.select().from(t.jobTicks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ job: "tick", ranAt: second });
    expect(rows[0].durationMs).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("deletes demo requests after 24 months and cached tutor answers after a year", async () => {
    const now = new Date("2026-11-06T10:00:00Z");
    await db.insert(t.demoRequests).values([demo("old", new Date(now.getTime() - 731 * DAY)), demo("recent", new Date(now.getTime() - 700 * DAY))]);
    await db.insert(t.tutorCache).values([answer("old", new Date(now.getTime() - 366 * DAY)), answer("recent", new Date(now.getTime() - 300 * DAY))]);
    globalThis.__jobsCleanupDay = undefined;
    await runJobs(db, now);
    expect((await db.select({ name: t.demoRequests.name }).from(t.demoRequests)).map((r) => r.name)).toEqual(["recent"]);
    expect((await db.select({ id: t.tutorCache.id }).from(t.tutorCache)).map((r) => r.id)).toEqual(["recent"]);
  }, 60_000);

  it("applies each organisation's retention to its own rows only and never deletes evidence", async () => {
    const now = new Date("2026-11-07T10:00:00Z");
    const old = new Date(now.getTime() - 400 * DAY);
    const recent = new Date(now.getTime() - 10 * DAY);
    const mod = await addModule(db, { lessons: 1 });
    const org = async (retention: t.TenantSettings["retention"]) => {
      const tenant = await addTenant(db, { settings: { ...defaultSettings("en"), retention } });
      const user = await addUser(db, tenant.id);
      await db.insert(t.auditLog).values([
        { tenantId: tenant.id, action: "old", at: old },
        { tenantId: tenant.id, action: "recent", at: recent },
        // The entries that explain a gap in the history outlive the retention they describe.
        { tenantId: tenant.id, action: "settings.retention", at: old, meta: retention },
        { tenantId: tenant.id, action: "retention.purged", at: old, meta: { seeded: true } },
      ]);
      const answer = { tenantId: tenant.id, userId: user.id, lessonId: mod.lessons[0].id, sceneId: "q1", correct: true, firstTry: true };
      await db.insert(t.answers).values([
        { ...answer, sceneId: "old", at: old },
        { ...answer, sceneId: "recent", at: recent },
      ]);
      const risk = { tenantId: tenant.id, userId: user.id, kind: "phishing_click" as const, severity: "high" as const, createdAt: old };
      await db.insert(t.behaviorRisks).values([
        { ...risk, title: "closed long ago", status: "closed", closedAt: old },
        { ...risk, title: "closed lately", status: "closed", closedAt: recent },
        { ...risk, title: "still open" },
      ]);
      await db.insert(t.lessonProgress).values({ userId: user.id, lessonId: mod.lessons[0].id, completedAt: old });
      const rows = async () => ({
        audit: (await db.select({ a: t.auditLog.action, at: t.auditLog.at }).from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id))).filter((r) => r.at.getTime() !== now.getTime()).map((r) => r.a).sort(),
        answers: (await db.select({ s: t.answers.sceneId }).from(t.answers).where(eq(t.answers.tenantId, tenant.id))).map((r) => r.s).sort(),
        risks: (await db.select({ title: t.behaviorRisks.title }).from(t.behaviorRisks).where(eq(t.behaviorRisks.tenantId, tenant.id))).map((r) => r.title).sort(),
        progress: (await db.select().from(t.lessonProgress).where(eq(t.lessonProgress.userId, user.id))).length,
      });
      return rows;
    };
    const everything = { audit: ["old", "recent", "retention.purged", "settings.retention"], answers: ["old", "recent"], risks: ["closed lately", "closed long ago", "still open"], progress: 1 };
    const auditOnly = await org({ auditMonths: 12, learningMonths: 0 });
    const learningOnly = await org({ auditMonths: 0, learningMonths: 12 });
    const keeps = await org({ auditMonths: 0, learningMonths: 0 });
    globalThis.__jobsCleanupDay = undefined;
    await runJobs(db, now);
    expect(await auditOnly()).toEqual({ ...everything, audit: ["recent", "retention.purged", "settings.retention"] });
    expect(await learningOnly()).toEqual({ ...everything, answers: ["recent"], risks: ["closed lately", "still open"] });
    expect(await keeps()).toEqual(everything);
    const purges = await db
      .select({ tenantId: t.auditLog.tenantId, meta: t.auditLog.meta })
      .from(t.auditLog)
      .where(and(eq(t.auditLog.action, "retention.purged"), eq(t.auditLog.at, now)));
    expect(purges).toHaveLength(2);
    expect(purges.map((p) => p.meta)).toEqual(
      expect.arrayContaining([
        { auditEntries: 1, answers: 0, risks: 0, auditBefore: "2025-11-07T10:00:00.000Z" },
        { auditEntries: 0, answers: 1, risks: 1, learningBefore: "2025-11-07T10:00:00.000Z" },
      ]),
    );
  }, 60_000);

  it("cuts off on the same day of the month, clamped to the last day of a shorter month", () => {
    const at = (iso: string) => new Date(iso).toISOString();
    expect(monthsBefore(new Date("2026-11-07T10:00:00Z"), 12).toISOString()).toBe(at("2025-11-07T10:00:00Z"));
    // setUTCMonth alone would roll these over into the next month (3 April, 1 June, 1 March).
    expect(monthsBefore(new Date("2026-03-31T10:00:00Z"), 1).toISOString()).toBe(at("2026-02-28T10:00:00Z"));
    expect(monthsBefore(new Date("2026-05-31T10:00:00Z"), 1).toISOString()).toBe(at("2026-04-30T10:00:00Z"));
    expect(monthsBefore(new Date("2028-02-29T10:00:00Z"), 12).toISOString()).toBe(at("2027-02-28T10:00:00Z"));
    expect(monthsBefore(new Date("2026-03-31T10:00:00Z"), 13).toISOString()).toBe(at("2025-02-28T10:00:00Z"));
    expect(monthsBefore(new Date("2026-01-15T00:00:00Z"), 2).toISOString()).toBe(at("2025-11-15T00:00:00Z"));
  });

  it("purges the audit log no earlier than 12 months even when a shorter value was stored before the floor existed", async () => {
    const now = new Date("2026-11-09T10:00:00Z");
    const tenant = await addTenant(db, { settings: { ...defaultSettings("en"), retention: { auditMonths: 1, learningMonths: 0 } } });
    await db.insert(t.auditLog).values([
      { tenantId: tenant.id, action: "two months", at: new Date(now.getTime() - 60 * DAY) },
      { tenantId: tenant.id, action: "old", at: new Date(now.getTime() - 400 * DAY) },
    ]);
    globalThis.__jobsCleanupDay = undefined;
    await runJobs(db, now);
    const rows = await db.select({ a: t.auditLog.action, meta: t.auditLog.meta }).from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id));
    expect(rows.map((r) => r.a).sort()).toEqual(["retention.purged", "two months"]);
    expect(rows.find((r) => r.a === "retention.purged")?.meta).toMatchObject({ auditEntries: 1, auditBefore: "2025-11-09T10:00:00.000Z" });
  }, 60_000);

  it("stops at the time budget, keeps the organisation's rows and leaves the day to the next tick", async () => {
    const now = new Date("2026-11-08T10:00:00Z");
    const tenant = await addTenant(db, { settings: { ...defaultSettings("en"), retention: { auditMonths: 1, learningMonths: 0 } } });
    await db.insert(t.auditLog).values({ tenantId: tenant.id, action: "old", at: new Date(now.getTime() - 400 * DAY) });
    // Every clock read lands past the 30-second budget set at the start of the clean-up.
    let clock = Date.now();
    const spy = vi.spyOn(Date, "now").mockImplementation(() => (clock += 31_000));
    globalThis.__jobsCleanupDay = undefined;
    try {
      await runJobs(db, now);
    } finally {
      spy.mockRestore();
    }
    expect(globalThis.__jobsCleanupDay).toBeUndefined();
    expect((await db.select({ a: t.auditLog.action }).from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id))).map((r) => r.a)).toContain("old");
  }, 60_000);
});
