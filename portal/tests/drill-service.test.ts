import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { defaultSettings } from "../src/lib/tenant-defaults";
import { advanceDrill, drillHistory, drillView, skipDrill, startDrill } from "../src/server/services/drill";
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

    const history = await drillHistory(db, tenantId, "en");
    expect(history[0]).toMatchObject({ id: run.id, finished: true, audience: RISKS.length, totals: expected });
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
