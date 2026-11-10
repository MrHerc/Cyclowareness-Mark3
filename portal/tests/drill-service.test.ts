import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { PgDatabase } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { ALL_FEATURES, defaultSettings } from "../src/lib/tenant-defaults";
import { advanceDrill, drillHistory, drillView, dueCount, skipDrill, startDrill } from "../src/server/services/drill";
import { sendQueuedSms } from "../src/server/services/campaigns";
import { submitThreatReport } from "../src/server/services/threats";
import { drillProgress } from "../src/lib/drill/plan";
import { runJobs } from "../src/server/jobs";

// Every drill plays the same plan: a seed from the campaign's random id would test another plan on each run, and a failure could not be replayed.
vi.mock("../src/lib/drill/plan", async (importOriginal) => {
  const plan = await importOriginal<typeof import("../src/lib/drill/plan")>();
  return { ...plan, planDrill: (...[people, tpl, opts]: Parameters<typeof plan.planDrill>) => plan.planDrill(people, tpl, { ...opts, seed: 20261105 }) };
});

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
let tenantId = "";
let adminId = "";
let plainTenantId = "";

const RISKS = [72, 64, 58, 51, 47, 44, 39, 35, 31, 28, 25, 22];

/** An organisation with the drill switched on: an administrator and the twelve RISKS learners in one department. */
async function seedOrg(slug: string) {
  const [tenant] = await db
    .insert(t.tenants)
    .values({ slug, name: "Demo Org", plan: "enterprise_hrm", branding: { primary: "#4f46e5", accent: "#ff7a1a" }, settings: defaultSettings("en"), features: { live_drill: true } })
    .returning();
  const [dept] = await db.insert(t.departments).values({ tenantId: tenant.id, name: "Finance", nameKey: "finance" }).returning();
  const [admin] = await db.insert(t.users).values({ tenantId: tenant.id, email: `admin@${slug}.test`, name: "Ada Admin", role: "tenant_admin", locale: "en", riskScore: 20 }).returning();
  await db.insert(t.users).values(RISKS.map((risk, i) => ({ tenantId: tenant.id, email: `p${i}@${slug}.test`, name: `Person ${i} Test`, role: "learner" as const, locale: i % 3 === 0 ? "az" : "en", riskScore: risk, departmentId: dept.id })));
  return { tenantId: tenant.id, adminId: admin.id };
}

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  ({ tenantId, adminId } = await seedOrg("demo"));
  const [plain] = await db.insert(t.tenants).values({ slug: "real", name: "Real Org", plan: "enterprise_hrm", branding: { primary: "#4f46e5", accent: "#ff7a1a" }, settings: defaultSettings("en") }).returning();
  plainTenantId = plain.id;
  const [mod] = await db
    .insert(t.modules)
    .values({ slug: "phishing-email", category: "email", audiences: ["all"], title: { en: "Phishing email", az: "FiÅŸinq mÉ™ktubu" }, subtitle: { en: "" }, minutes: 6, xp: 40, difficulty: "Easy" })
    .returning();
  await db.insert(t.lessons).values([
    { moduleId: mod.id, key: "phishing-email-1", title: { en: "One" }, minutes: 3, position: 1 },
    { moduleId: mod.id, key: "phishing-email-2", title: { en: "Two" }, minutes: 3, position: 2 },
  ]);
}, 180_000);

describe("live drill", () => {
  it("is refused without the seeded feature, which the operator console cannot switch on, and for an unknown or voice template", async () => {
    const base = { actorId: adminId, audience: "all" as const, departmentId: null, speed: "quick" as const, campaignName: "Drill" };
    expect(ALL_FEATURES).not.toContain("live_drill");
    expect(await startDrill(db, { ...base, tenantId: plainTenantId, templateKey: "payslip" })).toEqual({ ok: false, reason: "feature" });
    expect(await startDrill(db, { ...base, tenantId, templateKey: "tech-support-call" })).toEqual({ ok: false, reason: "template" });
    expect(await startDrill(db, { ...base, tenantId, templateKey: "nope" })).toEqual({ ok: false, reason: "template" });
  });

  it("plays a whole drill through the real services and closes risks by training", async () => {
    // Its own organisation: the counts below are organisation-wide, so no other test's drill may be in them.
    const { tenantId, adminId } = await seedOrg("whole-drill");
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "payslip", audience: "all", departmentId: null, speed: "quick", campaignName: "Live drill: payslip" });
    if (!started.ok) throw new Error(started.reason);
    // The person running the drill watches it: everyone else is in the audience.
    expect(started.recipients).toBe(RISKS.length);
    const [run0] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    expect(run0.appliedUntil).toBe(0);
    expect(run0.baseline.avgRisk).toBe(Math.round(RISKS.reduce((a, b) => a + b, 0) / RISKS.length));
    const [campaign0] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, run0.campaignId));
    expect(campaign0.status).toBe("running");

    // Halfway: exactly the events due by then are applied, not all, and the drill is still running.
    const half = await advanceDrill(db, tenantId, started.id, new Date(run0.startedAt.getTime() + run0.durationMs / 2));
    expect(half!.appliedUntil).toBeGreaterThan(0);
    expect(half!.appliedUntil).toBe(dueCount(run0.events, run0.durationMs / 2));
    expect(half!.appliedUntil).toBeLessThan(run0.events.length);
    expect(half!.finishedAt).toBeNull();

    // Two dashboards polling at once never apply an event twice.
    const end = new Date(run0.startedAt.getTime() + run0.durationMs + 10);
    await Promise.all([advanceDrill(db, tenantId, started.id, end), advanceDrill(db, tenantId, started.id, end)]);
    const run = (await advanceDrill(db, tenantId, started.id, end))!;
    expect(run.appliedUntil).toBe(run.events.length);
    expect(run.finishedAt).not.toBeNull();

    const expected = drillProgress(run.events, run.events.length, [...new Set(run.events.map((e) => e.recipientId))]).totals;
    const recipients = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, run.campaignId));
    expect(recipients.filter((r) => r.sentAt).length).toBe(expected.delivered);
    expect(recipients.filter((r) => r.clickedAt).length).toBe(expected.clicked);
    expect(recipients.filter((r) => r.submittedAt).length).toBe(expected.submitted);
    expect(recipients.filter((r) => r.reportedAt).length).toBe(expected.reported);
    expect(expected.clicked).toBeGreaterThan(0);
    expect(expected.reported).toBeGreaterThan(0);
    expect(expected.trained).toBeGreaterThan(0);

    // Every report became a triaged threat report matched to the simulation (one per report, no duplicates).
    const reports = await db.select().from(t.threatReports).where(eq(t.threatReports.tenantId, tenantId));
    expect(reports.length).toBe(expected.reported);
    expect(reports.every((r) => r.status === "triaged" && r.campaignRecipientId)).toBe(true);

    // Each click opened a risk tied to the module; the trained clickers' risks are closed, with a certificate.
    const risks = await db.select().from(t.behaviorRisks).where(and(eq(t.behaviorRisks.tenantId, tenantId), eq(t.behaviorRisks.kind, "phishing_click")));
    expect(risks.length).toBe(expected.clicked);
    expect(risks.filter((r) => r.status === "closed").length).toBe(expected.trained);
    const certs = await db.select().from(t.certificates).where(eq(t.certificates.tenantId, tenantId));
    expect(certs.length).toBe(expected.trained);

    const [campaign] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, run.campaignId));
    expect(campaign.status).toBe("completed");
    const finished = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenantId), eq(t.auditLog.action, "drill.finished")));
    expect(finished).toHaveLength(1);

    const view = (await drillView(db, run, "en", end))!;
    expect(view.status).toBe("finished");
    expect(view.totals).toEqual(expected);
    expect(view.people).toHaveLength(RISKS.length);
    expect(view.people.every((p) => p.outcome !== "pending")).toBe(true);
    expect(view.feed.length).toBeGreaterThan(0);
    expect(view.template.moduleTitle).toBe("Phishing email");
    expect(view.risk.before).toBe(run0.baseline.avgRisk);
    // The risk curve starts at the baseline and has a point per applied batch; the peak is its highest point.
    expect(run.riskTrail[0]).toEqual({ sim: 0, risk: run0.baseline.avgRisk });
    expect(run.riskTrail.length).toBeGreaterThanOrEqual(3);
    // One point per change of the average, in simulated order.
    for (let i = 1; i < run.riskTrail.length; i++) {
      expect(run.riskTrail[i].risk).not.toBe(run.riskTrail[i - 1].risk);
      expect(run.riskTrail[i].sim).toBeGreaterThanOrEqual(run.riskTrail[i - 1].sim);
    }
    expect(view.risk.peak).toBe(Math.max(...run.riskTrail.map((p) => p.risk), view.risk.now));
    expect(view.risk.peak).toBeGreaterThanOrEqual(view.risk.before);

    const history = await drillHistory(db, tenantId, "en");
    expect(history[0]).toMatchObject({ id: run.id, finished: true, audience: RISKS.length, totals: expected });
  }, 120_000);

  it("does not report twice when a step is replayed after a crash", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "keynote", audience: "all", departmentId: null, speed: "quick", campaignName: "Replay" });
    if (!started.ok) throw new Error(started.reason);
    const done = (await skipDrill(db, tenantId, started.id))!;
    // A skip is one batch, but the curve still has a point for each change on the way.
    expect(done.riskTrail.length).toBeGreaterThan(2);
    const reportAt = done.events.findIndex((e) => e.kind === "report");
    expect(reportAt).toBeGreaterThanOrEqual(0);
    const count = async () => (await db.select().from(t.threatReports).where(eq(t.threatReports.tenantId, tenantId))).length;
    const before = await count();
    // As if the request had died after the report and before recording it: the steps from there run again
    // (the campaign is still running then; only finishDrill completes it).
    await db.update(t.drillRuns).set({ appliedUntil: reportAt, finishedAt: null, leaseUntil: null }).where(eq(t.drillRuns.id, done.id));
    await db.update(t.campaigns).set({ status: "running", completedAt: null }).where(eq(t.campaigns.id, done.campaignId));
    const again = (await advanceDrill(db, tenantId, done.id))!;
    expect(again.appliedUntil).toBe(again.events.length);
    expect(await count()).toBe(before);
  }, 120_000);

  it("awards no second XP or certificate when a training step is replayed after a crash", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "payslip", audience: "all", departmentId: null, speed: "quick", campaignName: "Train replay" });
    if (!started.ok) throw new Error(started.reason);
    const done = (await skipDrill(db, tenantId, started.id))!;
    const trainAt = done.events.findIndex((e) => e.kind === "train");
    expect(trainAt).toBeGreaterThanOrEqual(0);
    const counts = async () => ({
      certificates: (await db.select().from(t.certificates).where(eq(t.certificates.tenantId, tenantId))).length,
      xp: (await db.select().from(t.xpEvents).where(eq(t.xpEvents.tenantId, tenantId))).length,
    });
    const before = await counts();
    await db.update(t.drillRuns).set({ appliedUntil: trainAt, finishedAt: null, leaseUntil: null }).where(eq(t.drillRuns.id, done.id));
    await db.update(t.campaigns).set({ status: "running", completedAt: null }).where(eq(t.campaigns.id, done.campaignId));
    const again = (await advanceDrill(db, tenantId, done.id))!;
    expect(again.appliedUntil).toBe(again.events.length);
    expect(await counts()).toEqual(before);
  }, 120_000);

  it("files one report when two lease holders apply the same report step (a takeover after a stalled request)", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "keynote", audience: "all", departmentId: null, speed: "quick", campaignName: "Takeover" });
    if (!started.ok) throw new Error(started.reason);
    const done = (await skipDrill(db, tenantId, started.id))!;
    const reportAt = done.events.findIndex((e) => e.kind === "report");
    expect(reportAt).toBeGreaterThanOrEqual(0);
    const { recipientId } = done.events[reportAt];
    // Back to just before the report step, as if it had never been applied.
    await db.delete(t.threatReports).where(eq(t.threatReports.campaignRecipientId, recipientId));
    await db.update(t.campaignRecipients).set({ reportedAt: null }).where(eq(t.campaignRecipients.id, recipientId));
    await db.update(t.drillRuns).set({ appliedUntil: reportAt, finishedAt: null, leaseUntil: null }).where(eq(t.drillRuns.id, done.id));
    await db.update(t.campaigns).set({ status: "running", completedAt: null }).where(eq(t.campaigns.id, done.campaignId));
    // The second request polls after the first one's lease (20 s) has run out, so both claim the drill and apply the same step.
    const now = Date.now();
    await Promise.all([advanceDrill(db, tenantId, done.id, new Date(now)), advanceDrill(db, tenantId, done.id, new Date(now + 21_000))]);
    expect(await db.select().from(t.threatReports).where(eq(t.threatReports.campaignRecipientId, recipientId))).toHaveLength(1);
    const [run] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, done.id));
    expect(run.appliedUntil).toBe(run.events.length);
  }, 120_000);

  it("is played to its end by the job runner when no dashboard polls it", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "invoice", audience: "all", departmentId: null, speed: "quick", campaignName: "Unwatched" });
    if (!started.ok) throw new Error(started.reason);
    const [run0] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    const out = await runJobs(db, new Date(run0.startedAt.getTime() + run0.durationMs + 10));
    expect(out.drills).toBeGreaterThanOrEqual(1);
    const [run] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    expect(run.appliedUntil).toBe(run.events.length);
    expect(run.finishedAt).not.toBeNull();
    const [campaign] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, run.campaignId));
    expect(campaign.status).toBe("completed");
  }, 120_000);

  it("matches a report to the exact tracking link when two drills use the same lure", async () => {
    const a = await startDrill(db, { tenantId, actorId: adminId, templateKey: "fine", audience: "all", departmentId: null, speed: "quick", campaignName: "A" });
    const b = await startDrill(db, { tenantId, actorId: adminId, templateKey: "fine", audience: "all", departmentId: null, speed: "quick", campaignName: "B" });
    if (!a.ok || !b.ok) throw new Error("not started");
    // Both delivered: B's recipients carry the newer delivery time.
    const runA = (await skipDrill(db, tenantId, a.id))!;
    const runB = (await skipDrill(db, tenantId, b.id))!;
    const recA = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, runA.campaignId));
    // Who reports in a drill is random (seeded by the campaign id), so the test makes one person a non-reporter in both.
    const person = recA[0];
    await db.update(t.campaignRecipients).set({ reportedAt: null }).where(and(inArray(t.campaignRecipients.campaignId, [runA.campaignId, runB.campaignId]), eq(t.campaignRecipients.userId, person.userId)));
    await submitThreatReport(db, { tenantId, userId: person.userId, channel: "email", subject: "Unpaid fine", url: `http://localhost:3000/t/${person.token}` });
    const [afterA] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.id, person.id));
    const [afterB] = await db.select().from(t.campaignRecipients).where(and(eq(t.campaignRecipients.campaignId, runB.campaignId), eq(t.campaignRecipients.userId, person.userId)));
    expect(afterA.reportedAt).not.toBeNull();
    expect(afterB.reportedAt).toBeNull();
  }, 120_000);

  it("never sends a real text message for an SMS drill", async () => {
    // People with phones, so the SMS lure has an audience and the queued-SMS job would otherwise pick them up.
    const people = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.tenantId, tenantId), eq(t.users.role, "learner")));
    for (const [i, p] of people.slice(0, 4).entries()) await db.update(t.users).set({ phone: `+99450000020${i}` }).where(eq(t.users.id, p.id));
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "bank-sms", audience: "all", departmentId: null, speed: "quick", campaignName: "SMS drill" });
    if (!started.ok) throw new Error(started.reason);
    expect(started.recipients).toBe(4);
    expect(await sendQueuedSms(db, { budgetMs: 5_000 })).toBe(0);
    const [run] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    const unsent = await db.select().from(t.campaignRecipients).where(and(eq(t.campaignRecipients.campaignId, run.campaignId), isNull(t.campaignRecipients.sentAt)));
    expect(unsent).toHaveLength(4);
    await skipDrill(db, tenantId, started.id);
  }, 120_000);

  it("leaves no campaign or recipients behind when the drill row cannot be written", async () => {
    const people = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.tenantId, tenantId), eq(t.users.role, "learner")));
    for (const [i, p] of people.slice(0, 4).entries()) await db.update(t.users).set({ phone: `+99450000030${i}` }).where(eq(t.users.id, p.id));
    const campaigns = async () => (await db.select({ id: t.campaigns.id }).from(t.campaigns).where(eq(t.campaigns.tenantId, tenantId))).length;
    const recipients = async () => (await db.select({ id: t.campaignRecipients.id }).from(t.campaignRecipients).innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId)).where(eq(t.campaigns.tenantId, tenantId))).length;
    const before = { campaigns: await campaigns(), recipients: await recipients() };
    const insert = PgDatabase.prototype.insert;
    const failing = vi.spyOn(PgDatabase.prototype, "insert").mockImplementation(function (this: PgDatabase<never>, table: Parameters<typeof insert>[0]) {
      if (table === t.drillRuns) throw new Error("drill_runs insert failed");
      return insert.call(this, table);
    } as typeof insert);
    try {
      await expect(startDrill(db, { tenantId, actorId: adminId, templateKey: "bank-sms", audience: "all", departmentId: null, speed: "quick", campaignName: "Broken" })).rejects.toThrow("drill_runs insert failed");
    } finally {
      failing.mockRestore();
    }
    // Without its drill row a running SMS campaign would be an ordinary one, and the job runner would text the audience.
    expect({ campaigns: await campaigns(), recipients: await recipients() }).toEqual(before);
    expect(await sendQueuedSms(db, { budgetMs: 5_000 })).toBe(0);
  }, 120_000);

  it("ends where it is when its campaign is cancelled", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "payslip", audience: "all", departmentId: null, speed: "quick", campaignName: "Cancelled" });
    if (!started.ok) throw new Error(started.reason);
    const [run0] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    const half = await advanceDrill(db, tenantId, started.id, new Date(run0.startedAt.getTime() + run0.durationMs / 3));
    await db.update(t.campaigns).set({ status: "cancelled" }).where(eq(t.campaigns.id, run0.campaignId));
    // The next poll, still mid-drill, finds the campaign cancelled.
    const stopped = (await advanceDrill(db, tenantId, started.id, new Date(run0.startedAt.getTime() + run0.durationMs / 2)))!;
    expect(stopped.finishedAt).not.toBeNull();
    expect(stopped.appliedUntil).toBe(half!.appliedUntil);
    const view = (await drillView(db, stopped, "en"))!;
    expect(view.cancelled).toBe(true);
    expect(view.status).toBe("finished");
    expect(view.simNow).toBeLessThan(view.simMinutes);
  }, 120_000);

  it("ends where it is when its campaign is completed, without a drill.finished entry", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "payslip", audience: "all", departmentId: null, speed: "quick", campaignName: "Completed" });
    if (!started.ok) throw new Error(started.reason);
    const [run0] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    const half = await advanceDrill(db, tenantId, started.id, new Date(run0.startedAt.getTime() + run0.durationMs / 3));
    const finishedBefore = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenantId), eq(t.auditLog.action, "drill.finished")));
    // Completed by hand on the campaign page, or by the 14-day campaign tick, while nobody polled the dashboard.
    await db.update(t.campaigns).set({ status: "completed", completedAt: new Date() }).where(eq(t.campaigns.id, run0.campaignId));
    const stopped = (await advanceDrill(db, tenantId, started.id, new Date(run0.startedAt.getTime() + run0.durationMs * 2)))!;
    expect(stopped.finishedAt).not.toBeNull();
    expect(stopped.appliedUntil).toBe(half!.appliedUntil);
    const finishedAfter = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenantId), eq(t.auditLog.action, "drill.finished")));
    expect(finishedAfter).toHaveLength(finishedBefore.length);
    const view = (await drillView(db, stopped, "en"))!;
    expect(view.status).toBe("finished");
    expect(view.cancelled).toBe(false);
  }, 120_000);

  it("skips to the end on demand and ignores another organisation's drill id", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "invoice", audience: "all", departmentId: null, speed: "standard", campaignName: "Skip" });
    if (!started.ok) throw new Error(started.reason);
    expect(await advanceDrill(db, plainTenantId, started.id)).toBeNull();
    expect(await skipDrill(db, plainTenantId, started.id)).toBeNull();
    const done = await skipDrill(db, tenantId, started.id);
    expect(done!.finishedAt).not.toBeNull();
    expect(done!.appliedUntil).toBe(done!.events.length);
  }, 120_000);
});
