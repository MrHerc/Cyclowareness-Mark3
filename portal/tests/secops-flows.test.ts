import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { withDefaults } from "../src/lib/tenant-defaults";
import { TEMPLATE_BY_KEY } from "../src/lib/campaigns/templates";
import { riskTitle } from "../src/lib/risk-title";
import { bakuDayPlus } from "../src/lib/time";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

vi.mock("../src/server/env", () => ({ env: { isProd: false }, appUrl: () => "https://portal.example" }));

const { db, ready } = testDb();
const { submitThreatReport, insertNumbered } = await import("../src/server/services/threats");
const { advanceLoop, assignIncidentTraining, closeLoop, createIncident, createLoop, moduleScores, targetTraining } = await import("../src/server/services/secops");

beforeAll(ready, DB_SETUP_TIMEOUT);

const integrations = withDefaults({
  defaultLocale: "en",
  integrations: { webhookEnabled: true, webhookUrl: "https://siem.example/hook", webhookEvents: ["threat.reported", "simulation.reported", "incident.created"], syslogEnabled: false },
});
const events = async (tenantId: string) => (await db.select().from(t.webhookDeliveries).where(eq(t.webhookDeliveries.tenantId, tenantId))).map((d) => d.payload as { event: string; data: Record<string, unknown> });

let tok = 0;
async function simulation(tenantId: string, userId: string, o: { status?: (typeof t.CAMPAIGN_STATUS)[number]; sentAt?: Date; templateKey?: string } = {}) {
  const [c] = await db.insert(t.campaigns).values({ tenantId, name: "Payslip test", channel: "email", templateKey: o.templateKey ?? "payslip", audience: "all", status: o.status ?? "running", launchedAt: new Date() }).returning();
  const token = `simtoken${++tok}`.padEnd(26, "a");
  const [r] = await db.insert(t.campaignRecipients).values({ campaignId: c.id, userId, token, sentAt: o.sentAt ?? new Date(Date.now() - 86_400_000) }).returning();
  return { campaign: c, recipient: r, token };
}

describe("submitThreatReport", () => {
  it("files a real report for the analysts, in each analyst's language, with the report bonus", async () => {
    const tenant = await addTenant(db, { plan: "professional", settings: integrations });
    const reporter = await addUser(db, tenant.id);
    const analystEn = await addUser(db, tenant.id, { role: "analyst", locale: "en" });
    const analystAz = await addUser(db, tenant.id, { role: "analyst", locale: "az" });
    await addUser(db, tenant.id, { role: "analyst", status: "suspended" });
    const res = await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "email", subject: "Urgent: verify your mailbox", url: "https://evil.example/login", ip: "10.1.1.1" });
    expect(res).toEqual({ number: 100, simulation: false, xp: 5 });
    const [report] = await db.select().from(t.threatReports).where(eq(t.threatReports.tenantId, tenant.id));
    expect(report).toMatchObject({ number: 100, status: "new", severity: null, campaignRecipientId: null, reporterId: reporter.id });
    const notes = await db.select().from(t.notifications).where(eq(t.notifications.tenantId, tenant.id));
    expect(notes.map((n) => [n.userId, n.title]).sort()).toEqual(
      [
        [analystEn.id, "New threat report TR-100"],
        [analystAz.id, "Yeni təhdid bildirişi TR-100"],
      ].sort(),
    );
    expect(notes[0]).toMatchObject({ kind: "threat", body: "Urgent: verify your mailbox", href: "/admin/threats" });
    const [log] = await db.select().from(t.auditLog).where(eq(t.auditLog.tenantId, tenant.id));
    expect(log).toMatchObject({ action: "threat.reported", targetId: "100", ip: "10.1.1.1", meta: { channel: "email", simulation: false } });
    expect(await events(tenant.id)).toMatchObject([{ event: "threat.reported", data: { number: 100, simulation: false } }]);
    const [u] = await db.select({ xp: t.users.xp }).from(t.users).where(eq(t.users.id, reporter.id));
    expect(u.xp).toBe(5);
  });

  it("matches a report of our own simulation by its tracking link and counts it as reported", async () => {
    const tenant = await addTenant(db, { plan: "professional", settings: integrations });
    const reporter = await addUser(db, tenant.id);
    const analyst = await addUser(db, tenant.id, { role: "analyst" });
    const { recipient, token } = await simulation(tenant.id, reporter.id);
    const res = await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "link", subject: "odd link", url: `https://portal.example/t/${token}` });
    expect(res).toMatchObject({ simulation: true, xp: 5 });
    const [report] = await db.select().from(t.threatReports).where(eq(t.threatReports.tenantId, tenant.id));
    expect(report).toMatchObject({ status: "triaged", severity: "low", campaignRecipientId: recipient.id });
    const [r] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.id, recipient.id));
    expect(r.reportedAt).toBeInstanceOf(Date);
    // Analysts are not paged for a simulation.
    expect(await db.select().from(t.notifications).where(eq(t.notifications.userId, analyst.id))).toEqual([]);
    expect((await events(tenant.id)).map((e) => e.event)).toEqual(["simulation.reported"]);
  });

  it("matches by the template subject, in any of its languages", async () => {
    const tenant = await addTenant(db);
    const reporter = await addUser(db, tenant.id);
    await simulation(tenant.id, reporter.id);
    const subject = TEMPLATE_BY_KEY.get("payslip")!.subject;
    expect((await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "email", subject: `Fwd: ${subject.ru}` })).simulation).toBe(true);
  });

  it("keeps the first report time of a simulation reported twice", async () => {
    const tenant = await addTenant(db);
    const reporter = await addUser(db, tenant.id);
    const { recipient, token } = await simulation(tenant.id, reporter.id);
    await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "link", subject: "x", url: `/t/${token}` });
    const [first] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.id, recipient.id));
    await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "link", subject: "x", url: `/t/${token}` });
    const [second] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.id, recipient.id));
    expect(second.reportedAt).toEqual(first.reportedAt);
  });

  it("does not match old, draft or someone else's simulations, nor very short subjects", async () => {
    const tenant = await addTenant(db);
    const reporter = await addUser(db, tenant.id);
    const colleague = await addUser(db, tenant.id);
    const old = await simulation(tenant.id, reporter.id, { sentAt: new Date(Date.now() - 40 * 86_400_000) });
    const draft = await simulation(tenant.id, reporter.id, { status: "draft" });
    const theirs = await simulation(tenant.id, colleague.id);
    for (const s of [old, draft, theirs]) {
      expect((await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "link", subject: "x", url: `/t/${s.token}` })).simulation).toBe(false);
    }
    await simulation(tenant.id, reporter.id);
    expect((await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "email", subject: "Fwd:" })).simulation).toBe(false);
  });

  it("caps the report bonus per Baku day", async () => {
    const tenant = await addTenant(db);
    const reporter = await addUser(db, tenant.id);
    const xp = [];
    for (let i = 0; i < 7; i++) xp.push((await submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "sms", subject: `Suspicious ${i}` })).xp);
    expect(xp).toEqual([5, 5, 5, 5, 5, 0, 0]);
  });

  it("keeps the daily bonus cap when reports arrive at the same time", async () => {
    const tenant = await addTenant(db);
    const reporter = await addUser(db, tenant.id);
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "other", subject: `Report ${i}` })));
    expect(results.filter((r) => r.xp > 0)).toHaveLength(5);
    expect(await db.select().from(t.xpEvents).where(and(eq(t.xpEvents.userId, reporter.id), eq(t.xpEvents.reason, "report")))).toHaveLength(5);
  });

  it("gives simultaneous reports distinct numbers", async () => {
    const tenant = await addTenant(db);
    const reporter = await addUser(db, tenant.id);
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => submitThreatReport(db, { tenantId: tenant.id, userId: reporter.id, channel: "other", subject: `Report ${i}` })));
    expect(results.map((r) => r.number).sort()).toEqual([100, 101, 102, 103, 104]);
  });
});

describe("insertNumbered", () => {
  it("retries only on a duplicate number and rethrows other errors", async () => {
    const tenant = await addTenant(db);
    const insert = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { code: "23502" });
    });
    await expect(insertNumbered(db, t.supportTickets, tenant.id, 1000, insert)).rejects.toThrow("boom");
    expect(insert).toHaveBeenCalledTimes(1);
    let calls = 0;
    const flaky = vi.fn(async (n: number) => {
      if (++calls < 3) throw Object.assign(new Error("duplicate"), { code: "23505" });
      return n;
    });
    expect(await insertNumbered(db, t.supportTickets, tenant.id, 1000, flaky)).toEqual({ number: 1000, row: 1000 });
    expect(flaky).toHaveBeenCalledTimes(3);
  });
});

describe("closed loops", () => {
  const stages = async (loopId: string) => (await db.select().from(t.loopEvents).where(eq(t.loopEvents.loopId, loopId))).sort((a, b) => a.at.getTime() - b.at.getTime());

  it("opens at analysis with the intake recorded by the system", async () => {
    const tenant = await addTenant(db);
    const analyst = await addUser(db, tenant.id, { role: "analyst" });
    const id = await createLoop(db, { tenantId: tenant.id, title: "x".repeat(400), sourceType: "report", sourceId: "TR-100", actorId: analyst.id });
    const [loop] = await db.select().from(t.loops).where(eq(t.loops.id, id));
    expect(loop).toMatchObject({ stage: "analysis", verdict: "pending", closedAt: null });
    expect(loop.title).toHaveLength(300);
    expect((await stages(id)).map((e) => [e.stage, e.actorId])).toEqual([
      ["intake", null],
      ["analysis", analyst.id],
    ]);
  });

  it("moves only forward, recording every stage passed and the note on the last one", async () => {
    const tenant = await addTenant(db);
    const analyst = await addUser(db, tenant.id, { role: "analyst" });
    const id = await createLoop(db, { tenantId: tenant.id, title: "Loop", sourceType: "sandbox", actorId: analyst.id });
    expect(await advanceLoop(db, { tenantId: tenant.id, loopId: id, to: "approval", actorId: analyst.id, note: "Looks real", verdict: "malicious" })).toBe(true);
    const [loop] = await db.select().from(t.loops).where(eq(t.loops.id, id));
    expect(loop).toMatchObject({ stage: "approval", verdict: "malicious" });
    expect((await stages(id)).map((e) => [e.stage, e.note])).toEqual([
      ["intake", null],
      ["analysis", null],
      ["conversion", null],
      ["approval", "Looks real"],
    ]);
    expect(await advanceLoop(db, { tenantId: tenant.id, loopId: id, to: "analysis", actorId: analyst.id })).toBe(false);
    expect(await advanceLoop(db, { tenantId: tenant.id, loopId: id, to: "approval", actorId: analyst.id })).toBe(false);
    expect(await advanceLoop(db, { tenantId: (await addTenant(db)).id, loopId: id, to: "training", actorId: analyst.id })).toBe(false);
    const logs = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenant.id), eq(t.auditLog.action, "loop.advanced")));
    expect(logs).toHaveLength(1);
  });

  it("closes at the feedback stage once, and then refuses to move", async () => {
    const tenant = await addTenant(db);
    const analyst = await addUser(db, tenant.id, { role: "analyst" });
    const id = await createLoop(db, { tenantId: tenant.id, title: "Loop", sourceType: "intel", actorId: analyst.id });
    expect(await closeLoop(db, { tenantId: tenant.id, loopId: id, actorId: analyst.id, note: "Done" })).toBe(true);
    const [loop] = await db.select().from(t.loops).where(eq(t.loops.id, id));
    expect(loop.stage).toBe("feedback");
    expect(loop.closedAt).toBeInstanceOf(Date);
    expect((await stages(id)).at(-1)).toMatchObject({ stage: "feedback", note: "Done" });
    expect(await closeLoop(db, { tenantId: tenant.id, loopId: id, actorId: analyst.id })).toBe(false);
    expect(await advanceLoop(db, { tenantId: tenant.id, loopId: id, to: "feedback", actorId: analyst.id })).toBe(false);
  });
});

describe("incidents and their auto-training", () => {
  async function scene(o: { confidential?: boolean; dueDate?: string | null } = {}) {
    const tenant = await addTenant(db, { plan: "enterprise_hrm", settings: integrations });
    const analyst = await addUser(db, tenant.id, { role: "analyst" });
    const a = await addUser(db, tenant.id, { locale: "az" });
    const b = await addUser(db, tenant.id);
    const mod = await addModule(db, { title: { en: "Invoice fraud", az: "Faktura fırıldağı" } });
    const [sandbox] = await db
      .insert(t.sandboxAnalyses)
      .values({ tenantId: tenant.id, number: 1, kind: "file", objectName: "invoice.pdf.exe", verdict: "malicious", score: 90, findings: [], iocs: [], mitre: [] })
      .returning();
    const incident = await createIncident(db, {
      tenantId: tenant.id,
      actorId: analyst.id,
      title: "Fake invoices to Finance",
      severity: "high",
      source: "sandbox",
      sandboxId: sandbox.id,
      confidential: o.confidential,
      iocs: [{ type: "domain", value: "evil.example" }],
      trainingModuleId: mod.id,
      dueDate: o.dueDate === undefined ? "2099-01-31" : o.dueDate,
      targetUserIds: [a.id, b.id],
    });
    return { tenant, analyst, a, b, mod, sandbox, incident };
  }

  it("numbers incidents from 20, links the sandbox analysis and keeps confidential details inside", async () => {
    const open = await scene();
    expect(open.incident.number).toBe(20);
    const [sb] = await db.select().from(t.sandboxAnalyses).where(eq(t.sandboxAnalyses.id, open.sandbox.id));
    expect(sb.incidentId).toBe(open.incident.id);
    expect((await events(open.tenant.id)).find((e) => e.event === "incident.created")?.data).toMatchObject({ number: "IR-20", title: "Fake invoices to Finance", iocs: [{ value: "evil.example" }] });
    const secret = await scene({ confidential: true });
    const data = (await events(secret.tenant.id)).find((e) => e.event === "incident.created")?.data;
    expect(data).toEqual({ number: "IR-20", severity: "high", confidential: true });
  });

  it("gives the target people the module once, with the incident's due date, a notice and a linked loop moved to training", async () => {
    const { tenant, analyst, a, b, mod, incident } = await scene();
    const loopId = await createLoop(db, { tenantId: tenant.id, title: "From TR-100", sourceType: "report", actorId: analyst.id, incidentId: incident.id, stage: "targeting" });
    expect(await assignIncidentTraining(db, { tenantId: tenant.id, incidentId: incident.id, actorId: analyst.id })).toBe(2);
    const risks = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.tenantId, tenant.id));
    expect(risks).toHaveLength(2);
    expect(risks[0]).toMatchObject({ kind: "incident", severity: "high", sourceRef: "IR-20", moduleId: mod.id, dueDate: "2099-01-31", title: "IR-20: Fake invoices to Finance", status: "open" });
    const notes = await db.select().from(t.notifications).where(eq(t.notifications.tenantId, tenant.id));
    expect(notes.find((n) => n.userId === a.id)).toMatchObject({ kind: "assignment", title: "Faktura fırıldağı", href: `/learn/${mod.slug}` });
    const mail = await db.select().from(t.outbox).where(eq(t.outbox.tenantId, tenant.id));
    expect(mail.map((m) => m.status)).toEqual(["queued", "queued"]);
    const [loop] = await db.select().from(t.loops).where(eq(t.loops.id, loopId));
    expect(loop).toMatchObject({ stage: "training", trainedCount: 2 });
    const [inc] = await db.select().from(t.incidents).where(eq(t.incidents.id, incident.id));
    expect(inc.autoTrainingAt).toBeInstanceOf(Date);
    const scores = await db.select({ id: t.users.id, risk: t.users.riskScore }).from(t.users).where(eq(t.users.tenantId, tenant.id));
    expect(scores.find((s) => s.id === b.id)?.risk).not.toBe(50);

    // Running it again assigns nobody twice; a person added later gets it alone.
    expect(await assignIncidentTraining(db, { tenantId: tenant.id, incidentId: incident.id, actorId: analyst.id })).toBe(0);
    const c = await addUser(db, tenant.id);
    await db.update(t.incidents).set({ targetUserIds: [a.id, b.id, c.id] }).where(eq(t.incidents.id, incident.id));
    expect(await assignIncidentTraining(db, { tenantId: tenant.id, incidentId: incident.id, actorId: analyst.id })).toBe(1);
    const [after] = await db.select().from(t.loops).where(eq(t.loops.id, loopId));
    expect(after.trainedCount).toBe(3);
  });

  it("shows only the incident number to the people trained for a confidential incident, and moves a past due date out", async () => {
    const { tenant, analyst, incident } = await scene({ confidential: true, dueDate: "2020-01-01" });
    await assignIncidentTraining(db, { tenantId: tenant.id, incidentId: incident.id, actorId: analyst.id });
    const risks = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.tenantId, tenant.id));
    expect(risks.map((r) => r.title)).toEqual(["IR-20", "IR-20"]);
    expect(risks[0].dueDate).toBe(bakuDayPlus(7));
  });

  it("does nothing for an incident without a module or people, or of another organisation", async () => {
    const { tenant, analyst, incident } = await scene();
    expect(await assignIncidentTraining(db, { tenantId: (await addTenant(db)).id, incidentId: incident.id, actorId: analyst.id })).toBe(0);
    await db.update(t.incidents).set({ trainingModuleId: null }).where(eq(t.incidents.id, incident.id));
    expect(await assignIncidentTraining(db, { tenantId: tenant.id, incidentId: incident.id, actorId: analyst.id })).toBe(0);
  });
});

describe("targetTraining", () => {
  it("skips inactive people, people who completed the module and people already targeted from the same source", async () => {
    const tenant = await addTenant(db);
    const mod = await addModule(db);
    const fresh = await addUser(db, tenant.id);
    const done = await addUser(db, tenant.id);
    const suspended = await addUser(db, tenant.id, { status: "suspended" });
    const already = await addUser(db, tenant.id);
    const outsider = await addUser(db, (await addTenant(db)).id);
    await db.insert(t.moduleProgress).values({ userId: done.id, moduleId: mod.id, status: "completed", percent: 100 });
    await db.insert(t.behaviorRisks).values({ tenantId: tenant.id, userId: already.id, kind: "incident", severity: "low", title: "x", sourceRef: "MAT-1" });
    const targets = await targetTraining(db, {
      tenantId: tenant.id,
      userIds: [fresh.id, done.id, suspended.id, already.id, outsider.id],
      moduleId: mod.id,
      severity: "medium",
      kind: "incident",
      title: (locale) => (locale === "az" ? "Yeni təlim" : locale === "ru" ? "Новое обучение" : "New training"),
      sourceRef: "MAT-1",
    });
    expect(targets).toEqual([fresh.id]);
    const [risk] = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, fresh.id));
    // A system title is stored in every interface language.
    expect([riskTitle(risk.title, "az"), riskTitle(risk.title, "ru"), riskTitle(risk.title, "de")]).toEqual(["Yeni təlim", "Новое обучение", "New training"]);
    expect(risk.dueDate).toBe(bakuDayPlus(7));
  });

  it("does nothing for an unknown module or nobody to train", async () => {
    const tenant = await addTenant(db);
    const person = await addUser(db, tenant.id);
    const base = { tenantId: tenant.id, severity: "low" as const, kind: "incident" as const, title: "x", sourceRef: "S" };
    expect(await targetTraining(db, { ...base, userIds: [], moduleId: (await addModule(db)).id })).toEqual([]);
    expect(await targetTraining(db, { ...base, userIds: [person.id], moduleId: "00000000-0000-4000-8000-000000000000" })).toEqual([]);
  });
});

describe("moduleScores", () => {
  it("is each person's first-try accuracy in one module", async () => {
    const tenant = await addTenant(db);
    const a = await addUser(db, tenant.id);
    const b = await addUser(db, tenant.id);
    const mod = await addModule(db);
    const other = await addModule(db);
    const ans = (userId: string, lessonId: string, correct: boolean, firstTry = true) => ({ tenantId: tenant.id, userId, lessonId, sceneId: "q", correct, firstTry });
    await db.insert(t.answers).values([
      ans(a.id, mod.lessons[0].id, true),
      ans(a.id, mod.lessons[1].id, true),
      ans(a.id, mod.lessons[2].id, false),
      ans(a.id, mod.lessons[2].id, true, false),
      ans(a.id, other.lessons[0].id, false),
      ans(b.id, mod.lessons[0].id, false),
    ]);
    const scores = await moduleScores(db, mod.id, [a.id, b.id]);
    expect(Object.fromEntries(scores)).toEqual({ [a.id]: 67, [b.id]: 0 });
    expect((await moduleScores(db, mod.id, [])).size).toBe(0);
  });
});
