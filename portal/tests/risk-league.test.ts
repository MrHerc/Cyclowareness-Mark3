import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import { computeTenantRisk, recomputeRisk, snapshotTenant, tenantKpis } from "../src/server/services/risk";
import { departmentLeague } from "../src/server/services/league";
import { DB_SETUP_TIMEOUT, addDepartment, addModule, addTenant, addUser, assignEveryone, testDb } from "./helpers/db";

const { db, ready } = testDb();
beforeAll(ready, DB_SETUP_TIMEOUT);

const NOW = new Date("2026-10-20T08:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

async function campaign(tenantId: string, at = ago(30)) {
  const [c] = await db.insert(t.campaigns).values({ tenantId, name: `C ${Math.random()}`, channel: "email", templateKey: "payslip", audience: "all", status: "running", launchedAt: at }).returning();
  return c;
}
let tokenSeq = 0;
async function recipient(campaignId: string, userId: string, o: Partial<typeof t.campaignRecipients.$inferInsert> = {}) {
  await db.insert(t.campaignRecipients).values({ campaignId, userId, token: `tok${++tokenSeq}`.padEnd(16, "x"), sentAt: ago(10), ...o });
}
async function completeLessons(userId: string, lessonIds: string[], at: Date) {
  await db.insert(t.lessonProgress).values(lessonIds.map((lessonId) => ({ userId, lessonId, completedAt: at, lastCompletedAt: at, attempts: 1 })));
}

describe("computeTenantRisk", () => {
  it("scores a person with no evidence on the neutral defaults for training and knowledge", async () => {
    const tenant = await addTenant(db);
    const quiet = await addUser(db, tenant.id);
    const evidence = await computeTenantRisk(db, tenant.id, NOW);
    expect(evidence.get(quiet.id)).toEqual({ score: 16, parts: { training: 8, overdue: 0, simulations: 0, openRisks: 0, knowledge: 8 } });
  });

  it("adds up training, overdue work, recent simulations, open risks and first-try answers", async () => {
    const tenant = await addTenant(db);
    const person = await addUser(db, tenant.id);
    const mod = await addModule(db, { lessons: 3 });
    await assignEveryone(db, tenant.id, mod.id, { dueKind: "fixed", dueDate: "2026-10-01", createdAt: ago(60) });
    await completeLessons(person.id, [mod.lessons[0].id], ago(5));
    const c = await campaign(tenant.id);
    await recipient(c.id, person.id, { clickedAt: ago(9) });
    // A click older than 90 days no longer counts.
    await recipient((await campaign(tenant.id, ago(130))).id, person.id, { sentAt: ago(120), clickedAt: ago(120) });
    await db.insert(t.behaviorRisks).values({ tenantId: tenant.id, userId: person.id, kind: "phishing_click", severity: "high", title: "x" });
    await db.insert(t.behaviorRisks).values({ tenantId: tenant.id, userId: person.id, kind: "policy", severity: "critical", title: "closed", status: "closed" });
    const answer = (o: Partial<typeof t.answers.$inferInsert>) => ({ tenantId: tenant.id, userId: person.id, lessonId: mod.lessons[0].id, sceneId: "q", correct: true, firstTry: true, at: ago(1), ...o });
    await db.insert(t.answers).values([answer({}), answer({}), answer({}), answer({}), answer({ correct: false, outcome: "risky" }), answer({ firstTry: false, correct: false })]);

    const b = (await computeTenantRisk(db, tenant.id, NOW)).get(person.id);
    // training round(2/3 × 30) = 20, overdue 5, simulations 12 + 2, open risks 14 (high), knowledge round(0.2 × 16) = 3.
    expect(b).toEqual({ score: 56, parts: { training: 20, overdue: 5, simulations: 14, openRisks: 14, knowledge: 3 } });
  });

  it("lowers the simulation part for reports, never below zero", async () => {
    const tenant = await addTenant(db);
    const person = await addUser(db, tenant.id);
    const c = await campaign(tenant.id);
    await recipient(c.id, person.id, { reportedAt: ago(9) });
    await recipient(c.id, person.id, { reportedAt: ago(9) });
    expect((await computeTenantRisk(db, tenant.id, NOW)).get(person.id)?.parts.simulations).toBe(0);
  });

  it("does not count an overdue module that was completed, nor a due date still ahead", async () => {
    const tenant = await addTenant(db);
    const done = await addUser(db, tenant.id);
    const mod = await addModule(db, { lessons: 1 });
    const later = await addModule(db, { lessons: 1 });
    await assignEveryone(db, tenant.id, mod.id, { dueKind: "fixed", dueDate: "2026-10-01", createdAt: ago(60) });
    await assignEveryone(db, tenant.id, later.id, { dueKind: "fixed", dueDate: "2026-12-01", createdAt: ago(60) });
    await completeLessons(done.id, [mod.lessons[0].id], ago(30));
    await db.insert(t.moduleProgress).values({ userId: done.id, moduleId: mod.id, status: "completed", percent: 100, completedAt: ago(30) });
    expect((await computeTenantRisk(db, tenant.id, NOW)).get(done.id)?.parts.overdue).toBe(0);
  });

  it("leaves out deleted people and can be narrowed to some people", async () => {
    const tenant = await addTenant(db);
    const a = await addUser(db, tenant.id);
    const b = await addUser(db, tenant.id);
    const gone = await addUser(db, tenant.id, { status: "deleted" });
    const all = await computeTenantRisk(db, tenant.id, NOW);
    expect([...all.keys()].sort()).toEqual([a.id, b.id].sort());
    expect(all.has(gone.id)).toBe(false);
    expect([...(await computeTenantRisk(db, tenant.id, NOW, [b.id])).keys()]).toEqual([b.id]);
    expect((await computeTenantRisk(db, (await addTenant(db)).id, NOW)).size).toBe(0);
  });

  it("stores the fresh score on the person (recomputeRisk)", async () => {
    const tenant = await addTenant(db);
    const person = await addUser(db, tenant.id, { riskScore: 50 });
    await db.insert(t.behaviorRisks).values({ tenantId: tenant.id, userId: person.id, kind: "breach", severity: "critical", title: "x" });
    await recomputeRisk(db, tenant.id, [person.id], NOW);
    const [row] = await db.select({ risk: t.users.riskScore }).from(t.users).where(eq(t.users.id, person.id));
    expect(row.risk).toBe(36);
  });
});

describe("tenantKpis and snapshotTenant", () => {
  it("averages risk over active people, and measures completion, clicks and reports of the last 90 days", async () => {
    const tenant = await addTenant(db);
    const other = await addTenant(db);
    const people = [];
    for (const risk of [20, 40, 60, 80]) people.push(await addUser(db, tenant.id, { riskScore: risk }));
    const operator = await addUser(db, tenant.id, { role: "super_admin", riskScore: 90 });
    await addUser(db, tenant.id, { status: "suspended", riskScore: 10 });
    const mod = await addModule(db, { lessons: 2 });
    await assignEveryone(db, tenant.id, mod.id);
    await completeLessons(people[0].id, mod.lessons.map((l) => l.id), ago(3));
    const c = await campaign(tenant.id);
    await recipient(c.id, people[0].id, { clickedAt: ago(9) });
    await recipient(c.id, people[1].id, { reportedAt: ago(9) });
    await recipient(c.id, people[2].id, { reportedAt: ago(9) });
    await recipient(c.id, people[3].id);
    await recipient((await campaign(tenant.id, ago(110))).id, people[3].id, { sentAt: ago(100), clickedAt: ago(100) });
    const outsider = await addUser(db, other.id);
    await recipient((await campaign(other.id)).id, outsider.id, { clickedAt: ago(9) });
    void operator;

    expect(await tenantKpis(db, tenant.id, NOW)).toEqual({ learners: 4, avgRisk: 50, completion: 25, reportRate: 50, clickRate: 25 });
  });

  it("answers zeros for an organisation without people", async () => {
    const tenant = await addTenant(db);
    expect(await tenantKpis(db, tenant.id, NOW)).toEqual({ learners: 0, avgRisk: 0, completion: 0, reportRate: 0, clickRate: 0 });
  });

  it("keeps one snapshot per organisation and Baku day, updated by a later run", async () => {
    const tenant = await addTenant(db);
    const person = await addUser(db, tenant.id, { riskScore: 40 });
    await snapshotTenant(db, tenant.id, NOW);
    await db.update(t.users).set({ riskScore: 60 }).where(eq(t.users.id, person.id));
    await snapshotTenant(db, tenant.id, new Date(NOW.getTime() + 60_000));
    const rows = await db.select().from(t.riskSnapshots).where(eq(t.riskSnapshots.tenantId, tenant.id));
    expect(rows).toMatchObject([{ day: "2026-10-20", avgRisk: 60 }]);
  });
});

describe("departmentLeague", () => {
  it("ranks departments by 60 % completion and 40 % reporting, with the trend against a week earlier", async () => {
    const tenant = await addTenant(db);
    const finance = await addDepartment(db, tenant.id, "Finance");
    const it_ = await addDepartment(db, tenant.id, "IT");
    const empty = await addDepartment(db, tenant.id, "Empty");
    const f1 = await addUser(db, tenant.id, { departmentId: finance.id });
    const f2 = await addUser(db, tenant.id, { departmentId: finance.id });
    const i1 = await addUser(db, tenant.id, { departmentId: it_.id });
    await addUser(db, tenant.id, { departmentId: empty.id, status: "suspended" });
    const mod = await addModule(db, { lessons: 2 });
    await assignEveryone(db, tenant.id, mod.id, { createdAt: ago(60) });
    const lessons = mod.lessons.map((l) => l.id);
    await completeLessons(f1.id, lessons, ago(10));
    await completeLessons(i1.id, lessons, ago(1));
    // After the cut-off: ignored.
    await completeLessons(f2.id, lessons, new Date(NOW.getTime() + DAY));
    const c = await campaign(tenant.id, ago(25));
    await recipient(c.id, f1.id, { sentAt: ago(20), reportedAt: ago(15) });
    await recipient(c.id, f2.id, { sentAt: ago(20) });
    await recipient(c.id, i1.id, { sentAt: ago(20) });

    const rows = await departmentLeague(db, tenant.id, NOW);
    expect(rows.map((r) => ({ name: r.name, learners: r.learners, completion: r.completion, reportRate: r.reportRate, points: r.points, place: r.place, toNext: r.toNext, trend: r.trend }))).toEqual([
      { name: "IT", learners: 1, completion: 100, reportRate: 0, points: 60, place: 1, toNext: null, trend: "up" },
      { name: "Finance", learners: 2, completion: 50, reportRate: 50, points: 50, place: 2, toNext: 10, trend: "down" },
    ]);
  });

  it("is empty for an organisation without departments", async () => {
    const tenant = await addTenant(db);
    await addUser(db, tenant.id);
    expect(await departmentLeague(db, tenant.id, NOW)).toEqual([]);
  });
});
