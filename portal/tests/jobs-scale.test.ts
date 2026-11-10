import { and, count, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { runJobs } from "../src/server/jobs";
import { dayKey } from "../src/lib/domain/gamification";
import { resolveAssignments } from "../src/server/services/assignments";
import { computeTenantRisk, INLINE_RECOMPUTE_MAX, recomputeChanged, recomputeRisk } from "../src/server/services/risk";
import { DB_SETUP_TIMEOUT, addDepartment, addModule, addTenant, addUser, assignEveryone, testDb } from "./helpers/db";

const { db, ready } = testDb();
beforeAll(ready, DB_SETUP_TIMEOUT);

const NOW = new Date("2026-11-09T10:00:00Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** `n` people in one INSERT, each with a stored score the recompute has to overwrite. */
async function people(tenantId: string, n: number) {
  return db
    .insert(t.users)
    .values(Array.from({ length: n }, (_, i) => ({ tenantId, email: `p${i}-${tenantId}@test.example`, name: `P ${i}`, locale: "en", riskScore: 99 })))
    .returning({ id: t.users.id });
}

const scores = async (tenantId: string) => new Map((await db.select({ id: t.users.id, s: t.users.riskScore }).from(t.users).where(eq(t.users.tenantId, tenantId))).map((u) => [u.id, u.s]));

describe("recomputeRisk at scale", () => {
  it("writes 1,200 scores in one UPDATE per 500 people, equal to the per-person evidence", async () => {
    const tenant = await addTenant(db);
    const users = await people(tenant.id, 1_200);
    const mod = await addModule(db, { lessons: 3 });
    await assignEveryone(db, tenant.id, mod.id, { dueKind: "fixed", dueDate: "2026-10-01", createdAt: new Date(NOW.getTime() - 60 * DAY) });
    // Evidence that differs from person to person: training done, simulation clicks and open risks.
    await db.insert(t.lessonProgress).values(users.filter((_, i) => i % 4).map((u, i) => ({ userId: u.id, lessonId: mod.lessons[i % 3].id, completedAt: NOW })));
    const [c] = await db.insert(t.campaigns).values({ tenantId: tenant.id, name: "C", channel: "email", templateKey: "payslip", audience: "all", status: "running", launchedAt: NOW }).returning();
    await db.insert(t.campaignRecipients).values(users.filter((_, i) => i % 3 === 0).map((u, i) => ({ campaignId: c.id, userId: u.id, token: `tok-${i}`.padEnd(16, "x"), sentAt: NOW, clickedAt: i % 2 ? NOW : null })));
    await db.insert(t.behaviorRisks).values(users.filter((_, i) => i % 5 === 0).map((u) => ({ tenantId: tenant.id, userId: u.id, kind: "phishing_click" as const, severity: "high" as const, title: "x" })));

    const expected = await computeTenantRisk(db, tenant.id, NOW);
    expect(new Set([...expected.values()].map((b) => b.score)).size).toBeGreaterThan(3);
    const execute = vi.spyOn(db, "execute");
    try {
      await recomputeRisk(db, tenant.id, undefined, NOW);
      expect(execute).toHaveBeenCalledTimes(3);
    } finally {
      execute.mockRestore();
    }
    const stored = await scores(tenant.id);
    expect(stored.size).toBe(1_200);
    for (const [id, b] of expected) expect(stored.get(id)).toBe(b.score);
  }, 120_000);
});

describe("assignment changes", () => {
  it("rescore only the people whose assigned modules or due days moved", async () => {
    const tenant = await addTenant(db);
    const sales = await addDepartment(db, tenant.id, "Sales");
    const it_ = await addDepartment(db, tenant.id, "IT");
    const a = await addUser(db, tenant.id, { departmentId: sales.id, riskScore: 99 });
    const b = await addUser(db, tenant.id, { departmentId: sales.id, riskScore: 99 });
    const other = await addUser(db, tenant.id, { departmentId: it_.id, riskScore: 99 });
    const mod = await addModule(db, { lessons: 2 });
    const [assignment] = await db.insert(t.assignments).values({ tenantId: tenant.id, moduleId: mod.id, scope: "department", departmentId: sales.id, dueKind: "none" }).returning();

    const before = await resolveAssignments(db, tenant.id);
    await db.delete(t.assignments).where(eq(t.assignments.id, assignment.id));
    expect(await recomputeChanged(db, tenant.id, before, NOW)).toBe("inline");
    const stored = await scores(tenant.id);
    expect(stored.get(a.id)).not.toBe(99);
    expect(stored.get(b.id)).not.toBe(99);
    expect(stored.get(other.id)).toBe(99);
  });

  it(`leave more than ${INLINE_RECOMPUTE_MAX} people to the next job tick, which rescores the whole organisation once`, async () => {
    const tenant = await addTenant(db);
    await people(tenant.id, INLINE_RECOMPUTE_MAX + 1);
    const mod = await addModule(db, { lessons: 1 });
    const before = await resolveAssignments(db, tenant.id);
    await assignEveryone(db, tenant.id, mod.id);
    expect(await recomputeChanged(db, tenant.id, before, NOW)).toBe("deferred");
    expect([...(await scores(tenant.id)).values()].every((s) => s === 99)).toBe(true);

    // Today's daily snapshot is done, so only the deferred rescoring can move the scores.
    await db.insert(t.riskSnapshots).values({ tenantId: tenant.id, day: "2026-11-09", avgRisk: 0, completion: 0, reportRate: 0, clickRate: 0 });
    const out = await runJobs(db, NOW);
    expect(out[`risk:${tenant.id}`]).toBe(1);
    expect([...(await scores(tenant.id)).values()].some((s) => s === 99)).toBe(false);
    expect(await db.select().from(t.jobRuns).where(eq(t.jobRuns.job, "risk"))).toEqual([]);
    expect(`risk:${tenant.id}` in (await runJobs(db, new Date(NOW.getTime() + 60_000)))).toBe(false);
  }, 120_000);
});

describe("hourly jobs", () => {
  const ran = (out: Record<string, number>, tenantId: string) => ["reminders", "managers", "refreshers", "teachable"].filter((job) => `${job}:${tenantId}` in out);

  it("run once an hour per organisation, counted from the start of the tick, even one that overran", async () => {
    const tenant = await addTenant(db);
    const start = new Date("2026-11-12T09:00:00Z");
    // The first tick takes ten minutes on the wall clock.
    let clock = Date.now();
    const spy = vi.spyOn(Date, "now").mockImplementation(() => (clock += 60_000));
    try {
      expect(ran(await runJobs(db, start), tenant.id)).toEqual(["reminders", "managers", "refreshers", "teachable"]);
    } finally {
      spy.mockRestore();
    }
    const runs = await db.select().from(t.jobRuns).where(eq(t.jobRuns.tenantId, tenant.id));
    expect(runs.map((r) => r.ranAt)).toEqual([start, start, start, start]);

    expect(ran(await runJobs(db, new Date(start.getTime() + 59 * 60_000)), tenant.id)).toEqual([]);
    expect(ran(await runJobs(db, new Date(start.getTime() + HOUR)), tenant.id)).toEqual(["reminders", "managers", "refreshers", "teachable"]);
    expect(ran(await runJobs(db, new Date(start.getTime() + HOUR + 60_000)), tenant.id)).toEqual([]);
  }, 120_000);

  it("a failing ledger write is that step's failure: the tick goes on and the job runs again next tick", async () => {
    const tenant = await addTenant(db);
    const start = new Date("2026-11-13T09:00:00Z");
    const insert = db.insert.bind(db);
    const spy = vi.spyOn(db, "insert").mockImplementation(((table: Parameters<typeof db.insert>[0]) => {
      if (table === t.jobRuns) throw new Error("tenant deleted");
      return insert(table);
    }) as typeof db.insert);
    let out: Record<string, number>;
    try {
      out = await runJobs(db, start);
    } finally {
      spy.mockRestore();
    }
    expect(out[`reminders:${tenant.id}`]).toBe(-1);
    expect(out[`reports:${tenant.id}`]).not.toBe(-1);
    expect(out.tick).toBe(1);
    expect(await db.select().from(t.jobRuns).where(eq(t.jobRuns.tenantId, tenant.id))).toEqual([]);
    expect(ran(await runJobs(db, new Date(start.getTime() + 60_000)), tenant.id)).toEqual(["reminders", "managers", "refreshers", "teachable"]);
  }, 120_000);
});

describe("indexes", () => {
  it("cover the lookups that grow with clicks and campaigns", async () => {
    const { rows } = await db.execute<{ indexname: string }>(sql`select indexname from pg_indexes where schemaname = 'public'`);
    expect(rows.map((r) => r.indexname)).toEqual(
      expect.arrayContaining(["recipients_clicked_idx", "campaigns_user_idx", "drill_runs_campaign_idx", "teachable_loops_source_campaign_idx", "teachable_loops_resim_campaign_idx"]),
    );
  });
});

// Last in the file: the hourly-job tests above would otherwise rescore these 17,000 people on every new day they tick.
describe("daily risk snapshot at scale", () => {
  it("records 17,000 people, more than one INSERT of values can bind (4 each, 65,535 at most), and is done for the day", async () => {
    const tenant = await addTenant(db);
    await db.execute(sql`insert into users (tenant_id, email, name, locale, risk_score) select ${tenant.id}, 'snap' || g || '@test.example', 'Snap ' || g, 'en', 99 from generate_series(1, 17000) g`);
    const day = dayKey(NOW, tenant.settings.timeZone);
    const out = await runJobs(db, NOW);
    expect(out[`snapshot:${tenant.id}`]).toBe(1);
    const [snapshots] = await db.select({ n: count() }).from(t.userRiskSnapshots).where(and(eq(t.userRiskSnapshots.tenantId, tenant.id), eq(t.userRiskSnapshots.day, day)));
    expect(snapshots.n).toBe(17_000);
    expect(await db.select({ day: t.riskSnapshots.day }).from(t.riskSnapshots).where(eq(t.riskSnapshots.tenantId, tenant.id))).toEqual([{ day }]);
    // A minute later the day is recorded: no second whole-organisation rescoring.
    await db.update(t.users).set({ riskScore: 99 }).where(eq(t.users.tenantId, tenant.id));
    expect((await runJobs(db, new Date(NOW.getTime() + 60_000)))[`snapshot:${tenant.id}`]).toBe(0);
    expect([...(await scores(tenant.id)).values()].every((s) => s === 99)).toBe(true);
  }, 240_000);
});
