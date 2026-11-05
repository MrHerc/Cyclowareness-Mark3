import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { defaultSettings } from "../src/lib/tenant-defaults";
import { advanceDrill, drillHistory, drillView, skipDrill, startDrill } from "../src/server/services/drill";
import { sendQueuedSms } from "../src/server/services/campaigns";
import { submitThreatReport } from "../src/server/services/threats";
import { drillProgress } from "../src/lib/drill/plan";

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
let tenantId = "";
let adminId = "";
let plainTenantId = "";

const RISKS = [72, 64, 58, 51, 47, 44, 39, 35, 31, 28, 25, 22];

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const settings = defaultSettings("en");
  const [tenant] = await db
    .insert(t.tenants)
    .values({ slug: "demo", name: "Demo Org", plan: "enterprise_hrm", branding: { primary: "#4f46e5", accent: "#ff7a1a" }, settings, features: { live_drill: true } })
    .returning();
  tenantId = tenant.id;
  const [plain] = await db.insert(t.tenants).values({ slug: "real", name: "Real Org", plan: "enterprise_hrm", branding: { primary: "#4f46e5", accent: "#ff7a1a" }, settings }).returning();
  plainTenantId = plain.id;
  const [dept] = await db.insert(t.departments).values({ tenantId, name: "Finance", nameKey: "finance" }).returning();
  const [admin] = await db.insert(t.users).values({ tenantId, email: "admin@demo.test", name: "Ada Admin", role: "tenant_admin", locale: "en", riskScore: 20 }).returning();
  adminId = admin.id;
  await db.insert(t.users).values(RISKS.map((risk, i) => ({ tenantId, email: `p${i}@demo.test`, name: `Person ${i} Test`, role: "learner" as const, locale: i % 3 === 0 ? "az" : "en", riskScore: risk, departmentId: dept.id })));
  const [mod] = await db
    .insert(t.modules)
    .values({ slug: "phishing-email", category: "email", audiences: ["all"], title: { en: "Phishing email", az: "Fişinq məktubu" }, subtitle: { en: "" }, minutes: 6, xp: 40, difficulty: "Easy" })
    .returning();
  await db.insert(t.lessons).values([
    { moduleId: mod.id, key: "phishing-email-1", title: { en: "One" }, minutes: 3, position: 1 },
    { moduleId: mod.id, key: "phishing-email-2", title: { en: "Two" }, minutes: 3, position: 2 },
  ]);
}, 180_000);

describe("live drill", () => {
  it("is refused without the operator feature and for an unknown or voice template", async () => {
    const base = { actorId: adminId, audience: "all" as const, departmentId: null, speed: "quick" as const, campaignName: "Drill" };
    expect(await startDrill(db, { ...base, tenantId: plainTenantId, templateKey: "payslip" })).toEqual({ ok: false, reason: "feature" });
    expect(await startDrill(db, { ...base, tenantId, templateKey: "tech-support-call" })).toEqual({ ok: false, reason: "template" });
    expect(await startDrill(db, { ...base, tenantId, templateKey: "nope" })).toEqual({ ok: false, reason: "template" });
  });

  it("plays a whole drill through the real services and closes risks by training", async () => {
    const started = await startDrill(db, { tenantId, actorId: adminId, templateKey: "payslip", audience: "all", departmentId: null, speed: "quick", campaignName: "Live drill: payslip" });
    if (!started.ok) throw new Error(started.reason);
    // The person running the drill watches it: everyone else is in the audience.
    expect(started.recipients).toBe(RISKS.length);
    const [run0] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, started.id));
    expect(run0.appliedUntil).toBe(0);
    expect(run0.baseline.avgRisk).toBe(Math.round(RISKS.reduce((a, b) => a + b, 0) / RISKS.length));
    const [campaign0] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, run0.campaignId));
    expect(campaign0.status).toBe("running");

    // Halfway: some events are applied, not all, and the drill is still running.
    const half = await advanceDrill(db, tenantId, started.id, new Date(run0.startedAt.getTime() + run0.durationMs / 2));
    expect(half!.appliedUntil).toBeGreaterThan(0);
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
    // As if the request had died after the report and before recording it: the steps from there run again.
    await db.update(t.drillRuns).set({ appliedUntil: reportAt, finishedAt: null, leaseUntil: null }).where(eq(t.drillRuns.id, done.id));
    const again = (await advanceDrill(db, tenantId, done.id))!;
    expect(again.appliedUntil).toBe(again.events.length);
    expect(await count()).toBe(before);
  }, 120_000);

  it("matches a report to the exact tracking link when two drills use the same lure", async () => {
    const a = await startDrill(db, { tenantId, actorId: adminId, templateKey: "fine", audience: "all", departmentId: null, speed: "quick", campaignName: "A" });
    const b = await startDrill(db, { tenantId, actorId: adminId, templateKey: "fine", audience: "all", departmentId: null, speed: "quick", campaignName: "B" });
    if (!a.ok || !b.ok) throw new Error("not started");
    // Both delivered: B's recipients carry the newer delivery time.
    const runA = (await skipDrill(db, tenantId, a.id))!;
    const runB = (await skipDrill(db, tenantId, b.id))!;
    const recA = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, runA.campaignId));
    const recB = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, runB.campaignId));
    const person = recA.find((r) => !r.reportedAt && recB.some((x) => x.userId === r.userId && !x.reportedAt));
    // With 12 people and about a third reporting in each drill, someone reported in neither.
    if (!person) throw new Error("no person left who reported in neither drill");
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
