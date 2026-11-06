import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import { runJobs } from "../src/server/jobs";
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
        audit: (await db.select({ a: t.auditLog.action }).from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id))).map((r) => r.a).filter((a) => a === "old" || a === "recent").sort(),
        answers: (await db.select({ s: t.answers.sceneId }).from(t.answers).where(eq(t.answers.tenantId, tenant.id))).map((r) => r.s).sort(),
        risks: (await db.select({ title: t.behaviorRisks.title }).from(t.behaviorRisks).where(eq(t.behaviorRisks.tenantId, tenant.id))).map((r) => r.title).sort(),
        progress: (await db.select().from(t.lessonProgress).where(eq(t.lessonProgress.userId, user.id))).length,
      });
      return rows;
    };
    const everything = { audit: ["old", "recent"], answers: ["old", "recent"], risks: ["closed lately", "closed long ago", "still open"], progress: 1 };
    const auditOnly = await org({ auditMonths: 1, learningMonths: 0 });
    const learningOnly = await org({ auditMonths: 0, learningMonths: 12 });
    const keeps = await org({ auditMonths: 0, learningMonths: 0 });
    globalThis.__jobsCleanupDay = undefined;
    await runJobs(db, now);
    expect(await auditOnly()).toEqual({ ...everything, audit: ["recent"] });
    expect(await learningOnly()).toEqual({ ...everything, answers: ["recent"], risks: ["closed lately", "still open"] });
    expect(await keeps()).toEqual(everything);
  }, 60_000);
});
