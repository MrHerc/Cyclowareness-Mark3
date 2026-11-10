import { and, count, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { featuresFor, reportAddress, withDefaults } from "../src/lib/tenant-defaults";
import type { Scene } from "../src/lib/content/types";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";
import { localeParityErrors } from "../src/lib/content/locale-parity";
import { markTargets, studioDraft } from "../src/lib/content/studio";
import { schemaCheck } from "../src/server/ai-verify";
import { TEMPLATE_BY_KEY } from "../src/lib/campaigns/templates";
import { riskTitle } from "../src/lib/risk-title";
import { bakuDayPlus } from "../src/lib/time";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

/** The model the Studio translations call: it prefixes every line with the target language, or fails for `fail`. */
const ai = vi.hoisted(() => ({ key: undefined as string | undefined, fail: "", calls: [] as string[], viewer: null as unknown, during: null as null | (() => Promise<unknown>) }));
vi.mock("../src/server/env", () => ({
  env: {
    isProd: false,
    ANTHROPIC_MODEL: "test-model",
    get ANTHROPIC_API_KEY() {
      return ai.key;
    },
  },
  appUrl: () => "https://portal.example",
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: (req: { system: string; messages: { content: string }[] }) => ({
        finalMessage: async () => {
          const to = /\(([a-z]{2})\)\./.exec(req.system)![1];
          ai.calls.push(to);
          await ai.during?.();
          const content = req.messages[0].content;
          const lines = JSON.parse(content.slice(content.indexOf("\n") + 1)) as string[];
          return to === ai.fail ? { stop_reason: "end_turn", content: [] } : { stop_reason: "tool_use", content: [{ type: "tool_use", input: { lines: lines.map((l) => `${to}: ${l}`) } }] };
        },
      }),
    };
  },
}));
// The inbound route, the settings and Studio actions reach the database through db(); the administrator is a plain object.
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => ai.viewer, allowed: () => true, hasFeature: () => true }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en", getTranslations: async () => (key: string) => key }));

const { db, ready } = testDb();
const { submitThreatReport, insertNumbered } = await import("../src/server/services/threats");
const { advanceLoop, assignIncidentTraining, closeLoop, createIncident, createLoop, moduleScores, targetTraining } = await import("../src/server/services/secops");
const { rotateInboundSecretAction, saveIntegrationsAction } = await import("../src/server/actions/settings");
const inbound = await import("../src/app/api/inbound/[tenant]/route");
const { rateLimit } = await import("../src/server/rate-limit");
const { sha256Hex } = await import("../src/server/crypto");
const { randomToken } = await import("../src/server/services/progress");
const { saveStudioLessonAction, setModuleStatusAction, updateStudioLessonAction } = await import("../src/server/actions/secops");

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

  it("targets 8,200 people, more than one INSERT of behaviour risks can bind (8 each, 65,535 at most)", async () => {
    const tenant = await addTenant(db);
    const mod = await addModule(db);
    const people = await db.execute<{ id: string }>(sql`insert into users (tenant_id, email, name, locale) select ${tenant.id}, 'target' || g || '@test.example', 'Target ' || g, 'en' from generate_series(1, 8200) g returning id`);
    const userIds = people.rows.map((r) => r.id);
    const targets = await targetTraining(db, { tenantId: tenant.id, userIds, moduleId: mod.id, severity: "medium", kind: "path", title: "Refresher", sourceRef: "REFRESH-2026-11" });
    expect(targets).toHaveLength(8_200);
    const [risks] = await db.select({ n: count() }).from(t.behaviorRisks).where(and(eq(t.behaviorRisks.tenantId, tenant.id), eq(t.behaviorRisks.sourceRef, "REFRESH-2026-11")));
    expect(risks.n).toBe(8_200);
  }, 300_000);
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

describe("inbound report address (/api/inbound/[tenant])", () => {
  const post = (slug: string, body: unknown, authorization?: string) =>
    inbound.POST(
      new Request(`https://portal.example/api/inbound/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      { params: Promise.resolve({ tenant: slug }) },
    );
  /** An organisation whose administrator created the inbound secret in Settings → Integrations. */
  async function inboundOrg() {
    const tenant = await addTenant(db, { settings: integrations });
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    ai.viewer = { user: { id: admin.id }, tenant: { id: tenant.id } };
    const { secret } = await rotateInboundSecretAction();
    return { tenant, auth: `Bearer ${secret}` };
  }
  const reports = (tenantId: string) => db.select().from(t.threatReports).where(eq(t.threatReports.tenantId, tenantId));

  it("keeps only the hash of a new inbound secret and audits the rotation", async () => {
    const { tenant, auth } = await inboundOrg();
    const secret = auth.slice("Bearer ".length);
    const [{ settings }] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenant.id));
    expect(withDefaults(settings).integrations.inboundSecretHash).toBe(sha256Hex(secret));
    expect(JSON.stringify(settings)).not.toContain(secret);
    expect(await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenant.id), eq(t.auditLog.action, "settings.inbound_secret")))).toHaveLength(1);
  });

  it("files a forwarded simulation mail as a matched report of the person who forwarded it", async () => {
    const { tenant, auth } = await inboundOrg();
    // Saving the form keeps the secret (it has no field) and stores the address the learners see.
    const form = { webhookEnabled: false, webhookEvents: [], syslogEnabled: false, syslogTransport: "tls" as const, syslogFormat: "cef" as const };
    expect(await saveIntegrationsAction({ ...form, inboundAddress: "report@bank.example" })).toEqual({ ok: true });
    const [{ settings }] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenant.id));
    expect(reportAddress({ features: new Set(["integrations"]), settings: withDefaults(settings) })).toBe("report@bank.example");
    expect(reportAddress({ features: new Set(), settings: withDefaults(settings) })).toBeUndefined();
    // An address typed before the secret exists is not shown: the endpoint would refuse every forwarded mail.
    const noSecret = withDefaults(settings);
    expect(reportAddress({ features: new Set(["integrations"]), settings: { ...noSecret, integrations: { ...noSecret.integrations, inboundSecretHash: undefined } } })).toBeUndefined();

    const reporter = await addUser(db, tenant.id, { email: `aysel${++tok}@bank.example`, riskScore: 99 });
    const { recipient } = await simulation(tenant.id, reporter.id);
    const token = randomToken(16);
    await db.update(t.campaignRecipients).set({ token }).where(eq(t.campaignRecipients.id, recipient.id));
    const res = await post(
      tenant.slug,
      {
        from: `Aysel <${reporter.email.toUpperCase()}>`,
        to: "report@bank.example",
        subject: "Fwd: Your payslip is ready",
        text: `---------- Forwarded message ----------\nOpen <https://portal.example/t/${token}> to see it.\nhttps://portal.example/t/${randomToken(16)}`,
      },
      auth,
    );
    expect(res.status).toBe(202);
    const [report] = await reports(tenant.id);
    expect(report).toMatchObject({ reporterId: reporter.id, channel: "email", status: "triaged", campaignRecipientId: recipient.id, subject: "Fwd: Your payslip is ready", url: `https://portal.example/t/${token}` });
    const [r] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.id, recipient.id));
    expect(r.reportedAt).toBeInstanceOf(Date);
    const logs = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenant.id), eq(t.auditLog.action, "threat.reported")));
    expect(logs).toMatchObject([{ actorId: reporter.id, meta: { channel: "email", simulation: true } }]);
    const [u] = await db.select({ xp: t.users.xp, risk: t.users.riskScore }).from(t.users).where(eq(t.users.id, reporter.id));
    expect(u.xp).toBe(5);
    expect(u.risk).not.toBe(99);
  });

  it("skips a foreign /t/ link and finds the simulation link inside a percent-encoded Safe Links wrapper", async () => {
    const { tenant, auth } = await inboundOrg();
    const reporter = await addUser(db, tenant.id);
    const { recipient } = await simulation(tenant.id, reporter.id);
    const token = randomToken(16);
    await db.update(t.campaignRecipients).set({ token }).where(eq(t.campaignRecipients.id, recipient.id));
    const wrapped = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(`https://portal.example/t/${token}`)}&data=05`;
    const text = `Sent via https://short.example/t/abcdefghijklmnop (50% off)\n---------- Forwarded message ----------\nOpen ${wrapped}`;
    expect((await post(tenant.slug, { from: reporter.email, subject: "Fwd: something else", text }, auth)).status).toBe(202);
    const [report] = await reports(tenant.id);
    expect(report).toMatchObject({ reporterId: reporter.id, campaignRecipientId: recipient.id, url: `https://portal.example/t/${token}` });
  });

  it("ignores unknown and suspended senders with the same answer, filing nothing", async () => {
    const { tenant, auth } = await inboundOrg();
    const suspended = await addUser(db, tenant.id, { status: "suspended" });
    const other = await addUser(db, (await addTenant(db)).id);
    for (const from of ["stranger@evil.example", suspended.email, other.email]) {
      expect((await post(tenant.slug, { from, subject: "Invoice", text: "Pay now" }, auth)).status).toBe(202);
    }
    expect(await reports(tenant.id)).toEqual([]);
    expect(await db.select().from(t.xpEvents).where(eq(t.xpEvents.tenantId, tenant.id))).toEqual([]);
  });

  it("refuses a wrong, missing or another organisation's secret, a plan without integrations and a malformed body", async () => {
    const a = await inboundOrg();
    const b = await inboundOrg();
    const person = await addUser(db, a.tenant.id);
    const mail = { from: person.email, subject: "Invoice", text: "Pay now" };
    expect((await post(a.tenant.slug, mail, "Bearer inb_wrong")).status).toBe(401);
    expect((await post(a.tenant.slug, mail)).status).toBe(401);
    expect((await post(a.tenant.slug, mail, b.auth)).status).toBe(401);
    expect((await post("no-such-org", mail, a.auth)).status).toBe(401);
    await db.update(t.tenants).set({ plan: "essentials" }).where(eq(t.tenants.id, a.tenant.id));
    expect((await post(a.tenant.slug, mail, a.auth)).status).toBe(401);
    await db.update(t.tenants).set({ plan: "professional" }).where(eq(t.tenants.id, a.tenant.id));
    expect((await post(a.tenant.slug, "{not json", a.auth)).status).toBe(400);
    expect((await post(a.tenant.slug, { subject: "no sender" }, a.auth)).status).toBe(400);
    expect(await reports(a.tenant.id)).toEqual([]);
  });

  it("files nothing for a person over the report form's own limit, with the same answer", async () => {
    const { tenant, auth } = await inboundOrg();
    const person = await addUser(db, tenant.id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T10:30:00Z"));
    try {
      // The route's window: 20 reports per person and hour, shared with the web form.
      for (let i = 0; i < 20; i++) await rateLimit(`threat-report:${person.id}`, 20, 3_600_000);
      expect((await post(tenant.slug, { from: person.email, subject: "Invoice", text: "Pay now" }, auth)).status).toBe(202);
    } finally {
      vi.useRealTimers();
    }
    expect(await reports(tenant.id)).toEqual([]);
    const [u] = await db.select({ xp: t.users.xp }).from(t.users).where(eq(t.users.id, person.id));
    expect(u.xp).toBe(person.xp);
  });

  it("refuses a flood per organisation", async () => {
    const { tenant, auth } = await inboundOrg();
    const person = await addUser(db, tenant.id);
    // Pinned clock: a minute boundary between filling the window and the post would open a fresh one.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T10:00:30Z"));
    try {
      // The route's window: 120 messages per organisation and minute.
      for (let i = 0; i < 120; i++) await rateLimit(`inbound:${tenant.id}`, 120, 60_000);
      const res = await post(tenant.slug, { from: person.email, subject: "Invoice", text: "Pay now" }, auth);
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("60");
    } finally {
      vi.useRealTimers();
    }
    expect(await reports(tenant.id)).toEqual([]);
  });

  it("answers quickly for a forwarded mail with a large embedded image and refuses a declared oversize body unread", async () => {
    const { tenant, auth } = await inboundOrg();
    const person = await addUser(db, tenant.id);
    // A base64 data URI is a long run with "/" and no spaces: the tracking-link search must stay linear on it.
    const image = Array.from({ length: 600_000 }, (_, i) => "AB/c+9xY"[i % 8]).join("");
    const started = Date.now();
    const res = await post(tenant.slug, { from: person.email, subject: "Fwd: Invoice", text: "Pay now", html: `<img src="data:image/png;base64,${image}">` }, auth);
    expect(res.status).toBe(202);
    expect(Date.now() - started).toBeLessThan(2000);
    const [report] = await reports(tenant.id);
    expect(report).toMatchObject({ reporterId: person.id, url: null });

    const big = inbound.POST(
      new Request(`https://portal.example/api/inbound/${tenant.slug}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: auth, "content-length": "2000000" },
        body: "{}",
      }),
      { params: Promise.resolve({ tenant: tenant.slug }) },
    );
    expect((await big).status).toBe(413);

    // A body without a declared length is read up to the limit, not buffered whole.
    const chunk = new TextEncoder().encode(" ".repeat(256_000));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 8) c.enqueue(chunk);
        else c.close();
      },
    });
    const streamed = await inbound.POST(
      new Request(`https://portal.example/api/inbound/${tenant.slug}`, { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: stream, duplex: "half" } as RequestInit),
      { params: Promise.resolve({ tenant: tenant.slug }) },
    );
    expect(streamed.status).toBe(413);
    expect(sent).toBeLessThan(8);
  });
});

describe("Studio lessons", () => {
  const LESSON = {
    locale: "en" as const,
    title: "Courier SMS",
    subtitle: "Spot a fake parcel text.",
    category: "email" as const,
    difficulty: "Easy" as const,
    minutes: 3,
    intro: "A text about a parcel arrives on your phone.",
    points: ["Check who sent it.", "Open the courier's app yourself."],
    question: { prompt: "What do you do first?", options: [{ label: "Open the app myself", correct: true, feedback: "Right." }, { label: "Tap the link", correct: false, feedback: "That is the trap." }] },
    recap: ["Check the sender.", "Use the official app."],
    ai: false,
  };
  const SWIPE = {
    prompt: "Sort these messages.",
    cards: [
      { from: "Parcel", text: "Pay 1 AZN at parcel-fee.example", verdict: "threat" as const, explain: "A fee link from an unknown sender." },
      { from: "Bank", text: "Your statement is ready in the app.", verdict: "safe" as const, explain: "No link, the app you know." },
    ],
  };
  const HOTSPOT = {
    prompt: "Find the two signs.",
    from: "support@pay-portal.example",
    subject: "Account locked",
    body: "Dear customer,\nVerify within 1 hour at pay-portal.example/login or lose access.",
    targets: [
      { text: "within 1 hour", label: "Pressure", explain: "Urgency stops you from checking." },
      { text: "pay-portal.example/login", label: "Odd link", explain: "Not your bank's address." },
    ],
  };
  type Viewer = import("../src/server/auth/viewer").Viewer;

  async function studio(locales: string[]) {
    const tenant = await addTenant(db, { plan: "professional", settings: withDefaults({ defaultLocale: "en", locales }) });
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    ai.viewer = { sessionId: "s", twoFactorVerified: true, user: admin, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } } as Viewer;
    return tenant;
  }
  async function lessonOf(tenantId: string, slug: string) {
    const [mod] = await db.select().from(t.modules).where(and(eq(t.modules.tenantId, tenantId), eq(t.modules.slug, slug)));
    const [lesson] = await db.select().from(t.lessons).where(eq(t.lessons.moduleId, mod.id));
    const rows = await db.select().from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
    const scenes = (locale: string) => rows.find((r) => r.locale === locale)?.scenes as Scene[] | undefined;
    return { mod, lesson, locales: rows.map((r) => r.locale).sort(), scenes };
  }
  const ids = (scenes: Scene[]) => JSON.stringify(scenes, (k, v: unknown) => (typeof v === "string" && k !== "id" && k !== "type" && k !== "spot" ? "" : v));

  it("authors swipe and hotspot exercises as valid scenes of the lesson format, and refuses broken ones", async () => {
    const tenant = await studio(["en"]);
    const res = await saveStudioLessonAction({ ...LESSON, swipe: SWIPE, hotspot: HOTSPOT });
    expect(res.ok).toBe(true);
    const { scenes } = await lessonOf(tenant.id, res.slug!);
    const en = scenes("en")!;
    expect(en.map((s) => s.id)).toEqual(["intro", "steps", "swipe", "hotspot", "check", "recap"]);
    const lesson = { formatVersion: 1 as const, id: "lesson-1", title: LESSON.title, minutes: LESSON.minutes, scenes: en };
    expect(lessonFileSchema.safeParse(lesson).success).toBe(true);
    expect(lessonIntegrityErrors(lessonFileSchema.parse(lesson))).toEqual([]);
    // The AI trainer's checks too: every spot is marked in the e-mail, the swipe has a threat.
    expect(schemaCheck({ title: LESSON.title, subtitle: LESSON.subtitle, lessons: [lesson] }).issues).toEqual([]);
    expect(en[3]).toMatchObject({
      type: "hotspot",
      minToFind: 2,
      artifact: { kind: "email", from: { address: HOTSPOT.from }, body: [[{ text: "Dear customer," }], [{ text: "Verify " }, { text: "within 1 hour", spot: "s1" }, { text: " at " }, { text: "pay-portal.example/login", spot: "s2" }, { text: " or lose access." }]] },
    });
    expect(en[2]).toMatchObject({ type: "swipe", cards: [{ id: "c1", verdict: "threat", artifact: { kind: "sms" } }, { id: "c2", verdict: "safe" }] });
    // The Studio form reads it back as it was written.
    const { title, subtitle, intro, points, question, recap } = LESSON;
    expect(studioDraft(en, subtitle)).toEqual({ title, subtitle, intro, points, question, recap, swipe: SWIPE, hotspot: HOTSPOT });
    // A lesson that only shares the ids is not the form's: saving it would drop the scene or field the form has no place for.
    expect(studioDraft([...en, { ...en[1], id: "more" }], subtitle)).toBeNull();
    expect(studioDraft(en.map((s) => (s.type === "recap" ? { ...s, mood: "happy" } : s)), subtitle)).toBeNull();

    const safeOnly = { ...SWIPE, cards: SWIPE.cards.map((c) => ({ ...c, verdict: "safe" as const })) };
    expect(await saveStudioLessonAction({ ...LESSON, swipe: safeOnly })).toEqual({ ok: false, error: "invalid" });
    const missing = { ...HOTSPOT, targets: [{ ...HOTSPOT.targets[0], text: "within 2 hours" }] };
    expect(await saveStudioLessonAction({ ...LESSON, hotspot: missing })).toEqual({ ok: false, error: "invalid" });
  });

  it("edits a saved lesson in place: the same scene ids, a published module stays published and is translated again", async () => {
    const tenant = await studio(["en", "ru"]);
    ai.key = undefined;
    const { slug } = await saveStudioLessonAction(LESSON);
    const before = await lessonOf(tenant.id, slug!);
    expect(await setModuleStatusAction(before.mod.id, "published")).toEqual({ ok: true, offline: true, untranslated: ["ru"] });
    const learner = await addUser(db, tenant.id);
    await db.insert(t.answers).values({ tenantId: tenant.id, userId: learner.id, lessonId: before.lesson.id, sceneId: "check", correct: true, firstTry: true });

    ai.key = "test-key";
    const edited = { ...LESSON, title: "Courier texts", points: ["Check who sent it.", "Open the app yourself.", "Report the text."], recap: ["Check.", "Report."], hotspot: HOTSPOT };
    expect(await updateStudioLessonAction(before.mod.id, edited)).toEqual({ ok: true, translated: ["ru"] });
    const after = await lessonOf(tenant.id, slug!);
    expect(after.mod).toMatchObject({ status: "published", title: { en: "Courier texts", ru: "ru: Courier texts" } });
    expect(after.lesson.id).toBe(before.lesson.id);
    const en = after.scenes("en")!;
    expect(en.map((s) => s.id)).toEqual(["intro", "steps", "hotspot", "check", "recap"]);
    expect(ids(en.filter((s) => s.id !== "hotspot" && s.id !== "steps"))).toBe(ids(before.scenes("en")!.filter((s) => s.id !== "steps")));
    expect(en[1]).toMatchObject({ beats: [{ id: "b1" }, { id: "b2" }, { id: "b3", say: "Report the text." }] });
    // The translation is of the new text, and the answers stay.
    expect(after.scenes("ru")![0]).toMatchObject({ id: "intro", title: "ru: Courier texts" });
    expect(await db.select().from(t.answers).where(eq(t.answers.lessonId, before.lesson.id))).toHaveLength(1);
    const [log] = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenant.id), eq(t.auditLog.action, "module.updated")));
    expect(log).toMatchObject({ targetId: before.mod.id, meta: { title: "Courier texts", translated: ["ru"] } });

    // A change of settings only keeps the translations, even with no key to make them again.
    ai.key = undefined;
    expect(await updateStudioLessonAction(before.mod.id, { ...edited, minutes: 5 })).toEqual({ ok: true });
    const kept = await lessonOf(tenant.id, slug!);
    expect(kept.locales).toEqual(["en", "ru"]);
    expect(kept.mod).toMatchObject({ minutes: 5, title: { en: "Courier texts", ru: "ru: Courier texts" } });

    // A draft keeps no stale translation, and an AI training's lessons are not the form's to rewrite.
    await setModuleStatusAction(before.mod.id, "draft");
    expect(await updateStudioLessonAction(before.mod.id, LESSON)).toEqual({ ok: true });
    expect((await lessonOf(tenant.id, slug!)).locales).toEqual(["en"]);
    const training = await addModule(db, { tenantId: tenant.id, origin: "ai", status: "draft", lessons: 1 });
    expect(await updateStudioLessonAction(training.id, LESSON)).toEqual({ ok: false, error: "invalid" });
  });

  it("translates on publish into each of the organisation's languages the lesson lacks, and says which it could not", async () => {
    const tenant = await studio(["en", "ru", "az"]);
    ai.key = undefined;
    const { slug } = await saveStudioLessonAction({ ...LESSON, swipe: SWIPE, hotspot: HOTSPOT });
    const { mod } = await lessonOf(tenant.id, slug!);
    // Without a key the module is published in its own language, and the author is told so.
    expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, offline: true, untranslated: ["ru", "az"] });
    expect((await lessonOf(tenant.id, slug!)).locales).toEqual(["en"]);

    ai.key = "test-key";
    ai.fail = "az";
    ai.calls = [];
    await setModuleStatusAction(mod.id, "draft");
    expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, translated: ["ru"], untranslated: ["az"] });
    const after = await lessonOf(tenant.id, slug!);
    expect(after.locales).toEqual(["en", "ru"]);
    expect(after.mod).toMatchObject({ status: "published", title: { en: LESSON.title, ru: `ru: ${LESSON.title}` }, subtitle: { ru: `ru: ${LESSON.subtitle}` } });
    const en = after.scenes("en")!;
    const ru = after.scenes("ru")!;
    // Same ids, answers, spots and addresses; only the text is the model's.
    expect(localeParityErrors(en, ru)).toEqual([]);
    expect(ids(ru)).toBe(ids(en));
    expect(ru[3]).toMatchObject({ artifact: { from: { address: HOTSPOT.from } }, spots: [{ id: "s1", label: "ru: Pressure" }, { id: "s2" }] });
    // The spaces between spans are the source's: the player joins spans with nothing between them.
    expect((ru[3] as { artifact: { body: { text: string }[][] } }).artifact.body[1].map((x) => x.text)).toEqual(["ru: Verify ", "ru: within 1 hour", " ru: at ", "ru: pay-portal.example/login", " ru: or lose access."]);
    // The lesson heading the player and syllabus show is translated with the module.
    expect(after.lesson.title).toEqual({ en: LESSON.title, ru: `ru: ${LESSON.title}` });

    ai.fail = "";
    ai.calls = [];
    await setModuleStatusAction(mod.id, "draft");
    expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, translated: ["az"] });
    expect(ai.calls).toEqual(["az"]);
    expect((await lessonOf(tenant.id, slug!)).locales).toEqual(["az", "en", "ru"]);
  });

  it("translates from the language the lesson was written in, whatever keys its translated title has", async () => {
    const tenant = await studio(["ru", "az", "en"]);
    ai.key = "test-key";
    ai.fail = "en";
    const { slug } = await saveStudioLessonAction({ ...LESSON, locale: "ru" });
    const { mod } = await lessonOf(tenant.id, slug!);
    expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, translated: ["az"], untranslated: ["en"] });
    // The title now has an "az" key ahead of the source's "ru"; the English text is still made from the Russian one.
    ai.fail = "";
    await setModuleStatusAction(mod.id, "draft");
    expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, translated: ["en"] });
    const after = await lessonOf(tenant.id, slug!);
    expect(after.scenes("en")![0]).toMatchObject({ title: `en: ${LESSON.title}` });
    expect(after.lesson.title).toEqual({ ru: LESSON.title, az: `az: ${LESSON.title}`, en: `en: ${LESSON.title}` });
    // Editing again starts from the Russian source too, and the form's check is the server's.
    expect(await updateStudioLessonAction(mod.id, { ...LESSON, locale: "ru", title: "Курьер" })).toEqual({ ok: true, translated: ["az", "en"] });
    expect((await lessonOf(tenant.id, slug!)).lesson.title).toEqual({ ru: "Курьер", az: "az: Курьер", en: "en: Курьер" });
  });

  it("reports a language whose text cannot be stored as untranslated, so the publish still ends", async () => {
    const tenant = await studio(["en", "ru"]);
    ai.key = "test-key";
    const { slug } = await saveStudioLessonAction(LESSON);
    const { mod } = await lessonOf(tenant.id, slug!);
    // The module is deleted while the model answers.
    ai.during = () => db.delete(t.modules).where(eq(t.modules.id, mod.id));
    try {
      expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, translated: [], untranslated: ["ru"] });
    } finally {
      ai.during = null;
    }
  });

  it("stops translating at the organisation's daily AI cap and says which languages were left out", async () => {
    const tenant = await studio(["en", "ru", "az"]);
    ai.key = "test-key";
    ai.fail = "";
    ai.calls = [];
    const { slug } = await saveStudioLessonAction(LESSON);
    const { mod } = await lessonOf(tenant.id, slug!);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
    try {
      for (let i = 0; i < 200; i++) await rateLimit(`ai-translate-day:t:${tenant.id}`, 200, 24 * 60 * 60_000);
      expect(await setModuleStatusAction(mod.id, "published")).toEqual({ ok: true, translated: [], untranslated: ["ru", "az"] });
    } finally {
      vi.useRealTimers();
    }
    expect(ai.calls).toEqual([]);
    expect((await lessonOf(tenant.id, slug!)).locales).toEqual(["en"]);
  });

  it("places hotspot signs by one rule for the form and the server: on one line, without overlap", () => {
    const body = "Verify within 1 hour\nat pay-portal.example/login";
    expect(markTargets(body, [{ text: "within 1 hour" }, { text: "pay-portal.example/login" }])).not.toBeNull();
    expect(markTargets(body, [{ text: "1 hour\nat" }])).toBeNull();
    expect(markTargets(body, [{ text: "pay-portal.example" }, { text: "pay-portal.example/login" }])).toBeNull();
    expect(markTargets(body, [{ text: "within" }, { text: "within" }])).toBeNull();
  });
});
