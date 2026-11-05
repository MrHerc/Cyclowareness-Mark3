import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { withDefaults } from "../src/lib/tenant-defaults";
import { TEMPLATE_BY_KEY } from "../src/lib/campaigns/templates";
import { riskTitle } from "../src/lib/risk-title";
import { DB_SETUP_TIMEOUT, addDepartment, addModule, addTenant, addUser, testDb } from "./helpers/db";

const env = { isProd: false, VOICE_PROVIDER: undefined as string | undefined };
vi.mock("../src/server/env", () => ({ env, appUrl: () => "https://portal.example" }));
let smsOn = true;
vi.mock("../src/server/sms", () => ({ smsAvailable: () => smsOn, sendSms: vi.fn(async () => ({ ok: true, simulated: true })) }));

const { db, ready } = testDb();
const c = await import("../src/server/services/campaigns");

let trainingModuleId = "";
beforeAll(async () => {
  await ready();
  // The payslip template trains with the library's phishing-email module.
  trainingModuleId = (await addModule(db, { slug: TEMPLATE_BY_KEY.get("payslip")!.moduleSlug })).id;
}, DB_SETUP_TIMEOUT);

beforeEach(() => {
  env.isProd = false;
  env.VOICE_PROVIDER = undefined;
  smsOn = true;
});

const settings = (o: Partial<t.TenantSettings> = {}) =>
  withDefaults({
    defaultLocale: "en",
    integrations: { webhookEnabled: true, webhookUrl: "https://siem.example/hook", webhookEvents: ["phishing.clicked", "qr.scanned", "simulation.risky"], syslogEnabled: false },
    ...o,
  });

async function org(o: { plan?: t.Plan; people?: number; locales?: string[] } = {}) {
  const tenant = await addTenant(db, { plan: o.plan ?? "enterprise_hrm", settings: settings() });
  const people = [];
  for (let i = 0; i < (o.people ?? 3); i++) people.push(await addUser(db, tenant.id, { locale: o.locales?.[i] ?? "en", phone: `+99450${String(Math.random()).slice(2, 9)}` }));
  return { tenant, people };
}

async function draft(tenantId: string, o: Partial<typeof t.campaigns.$inferInsert> = {}) {
  const [row] = await db.insert(t.campaigns).values({ tenantId, name: "Payslip", channel: "email", templateKey: "payslip", audience: "all", status: "draft", ...o }).returning();
  return row;
}
const recipients = (campaignId: string) => db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, campaignId));
const campaignRow = async (id: string) => (await db.select().from(t.campaigns).where(eq(t.campaigns.id, id)))[0];
const events = async (tenantId: string) => (await db.select().from(t.webhookDeliveries).where(eq(t.webhookDeliveries.tenantId, tenantId))).map((d) => (d.payload as { event: string }).event);

describe("campaignAudience", () => {
  it("reaches active people, never the platform operator, and a department with its sub-departments", async () => {
    const tenant = await addTenant(db);
    const finance = await addDepartment(db, tenant.id, "Finance");
    const payroll = await addDepartment(db, tenant.id, "Payroll", finance.id);
    const it_ = await addDepartment(db, tenant.id, "IT");
    const f = await addUser(db, tenant.id, { departmentId: finance.id });
    const p = await addUser(db, tenant.id, { departmentId: payroll.id });
    const i = await addUser(db, tenant.id, { departmentId: it_.id });
    await addUser(db, tenant.id, { role: "super_admin" });
    await addUser(db, tenant.id, { status: "suspended" });
    await addUser(db, tenant.id, { status: "invited" });
    const ids = async (audience: "all" | "department", departmentId: string | null) => (await c.campaignAudience(db, { tenantId: tenant.id, audience, departmentId })).map((u) => u.id).sort();
    expect(await ids("all", null)).toEqual([f.id, p.id, i.id].sort());
    expect(await ids("department", finance.id)).toEqual([f.id, p.id].sort());
    expect(await ids("department", payroll.id)).toEqual([p.id]);
    // A department audience whose department was deleted reaches nobody.
    expect(await ids("department", null)).toEqual([]);
  });
});

describe("launchBlocker", () => {
  it("names what keeps a channel from delivering", async () => {
    const tenant = await addTenant(db, { settings: settings() });
    expect(await c.launchBlocker(db, tenant.id, "email", 0)).toBe("empty");
    expect(await c.launchBlocker(db, tenant.id, "email", 3)).toBeNull();
    env.isProd = true;
    expect(await c.launchBlocker(db, tenant.id, "email", 3)).toBe("mail");
    expect(await c.launchBlocker(db, tenant.id, "voice", 3)).toBe("voice");
    env.VOICE_PROVIDER = "twilio";
    expect(await c.launchBlocker(db, tenant.id, "voice", 3)).toBeNull();
    const mailing = await addTenant(db, { settings: settings({ email: { enabled: true, host: "smtp.example" } }) });
    expect(await c.launchBlocker(db, mailing.id, "email", 3)).toBeNull();
    smsOn = false;
    expect(await c.launchBlocker(db, tenant.id, "sms", 3)).toBe("sms");
  });
});

describe("launchCampaign", () => {
  it("creates one recipient per person and queues the simulation in each person's language", async () => {
    const { tenant, people } = await org({ locales: ["en", "ru", "ar"] });
    const campaign = await draft(tenant.id);
    expect(await c.launchCampaign(db, campaign.id, null)).toEqual({ ok: true, count: 3 });
    expect(await campaignRow(campaign.id)).toMatchObject({ status: "running", launchedAt: expect.any(Date) });
    const rows = await recipients(campaign.id);
    expect(rows.map((r) => r.userId).sort()).toEqual(people.map((p) => p.id).sort());
    expect(new Set(rows.map((r) => r.token)).size).toBe(3);
    expect(rows.every((r) => r.sentAt instanceof Date)).toBe(true);

    const mail = await db.select().from(t.outbox).where(eq(t.outbox.tenantId, tenant.id));
    expect(mail).toHaveLength(3);
    expect(mail.every((m) => m.kind === "simulation" && m.status === "queued")).toBe(true);
    const tpl = TEMPLATE_BY_KEY.get("payslip")!;
    const ru = mail.find((m) => m.to === people[1].email)!;
    const token = rows.find((r) => r.userId === people[1].id)!.token;
    expect(ru.subject).toBe(tpl.subject.ru);
    expect(ru.text).toContain(`https://portal.example/t/${token}`);
    expect(ru.html).toContain(`https://portal.example/api/t/${token}/open`);
    expect(ru.html).toContain('lang="ru" dir="ltr"');
    expect(mail.find((m) => m.to === people[2].email)!.html).toContain('lang="ar" dir="rtl"');
    const [log] = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenant.id), eq(t.auditLog.action, "campaign.launched")));
    expect(log.meta).toEqual({ recipients: 3, channel: "email" });
  });

  it("escapes the template's text in the HTML of the message", async () => {
    const { tenant } = await org({ people: 1 });
    const campaign = await draft(tenant.id, { templateKey: "invoice" });
    await c.launchCampaign(db, campaign.id, null);
    const [mail] = await db.select().from(t.outbox).where(eq(t.outbox.tenantId, tenant.id));
    expect(mail.html).not.toMatch(/<script/i);
    expect(mail.html.startsWith("<!doctype html>")).toBe(true);
  });

  it("does not relaunch a running, completed or cancelled campaign", async () => {
    const { tenant } = await org({ people: 1 });
    for (const status of ["running", "completed", "cancelled"] as const) {
      const campaign = await draft(tenant.id, { status });
      expect(await c.launchCampaign(db, campaign.id, null)).toEqual({ ok: false, reason: "empty" });
      expect(await recipients(campaign.id)).toEqual([]);
    }
  });

  it("is blocked by the plan for SMS on Essentials, and records why", async () => {
    const { tenant } = await org({ plan: "essentials", people: 1 });
    const campaign = await draft(tenant.id, { channel: "sms", templateKey: "parcel-sms" });
    expect(await c.launchCampaign(db, campaign.id, null)).toEqual({ ok: false, reason: "plan" });
    expect((await campaignRow(campaign.id)).status).toBe("draft");
    const [log] = await db.select().from(t.auditLog).where(and(eq(t.auditLog.tenantId, tenant.id), eq(t.auditLog.action, "campaign.launch_blocked")));
    expect(log.meta).toEqual({ reason: "plan" });
  });

  it("sends the simulation once when Launch is pressed twice at the same time", async () => {
    const { tenant } = await org({ people: 3 });
    const campaign = await draft(tenant.id);
    const results = await Promise.all([c.launchCampaign(db, campaign.id, null), c.launchCampaign(db, campaign.id, null)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await recipients(campaign.id)).toHaveLength(3);
    expect(await db.select().from(t.outbox).where(eq(t.outbox.tenantId, tenant.id))).toHaveLength(3);
  });
});

describe("campaignTick", () => {
  it("launches due campaigns, returns blocked ones to draft with a notice, and closes campaigns after 14 days", async () => {
    const tenant = await addTenant(db, { plan: "enterprise_hrm", settings: settings() });
    const manager = await addUser(db, tenant.id, { role: "campaign_manager", locale: "az" });
    const creator = await addUser(db, tenant.id, { role: "learner" });
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    const gone = await addDepartment(db, tenant.id, "Empty");
    const due = await draft(tenant.id, { status: "scheduled", scheduledAt: new Date(Date.now() - 60_000) });
    const future = await draft(tenant.id, { status: "scheduled", scheduledAt: new Date(Date.now() + 3_600_000) });
    const blocked = await draft(tenant.id, { status: "scheduled", scheduledAt: new Date(Date.now() - 60_000), audience: "department", departmentId: gone.id, createdBy: creator.id, name: "Q4" });
    const old = await draft(tenant.id, { status: "running", launchedAt: new Date(Date.now() - 15 * 86_400_000) });
    const recent = await draft(tenant.id, { status: "running", launchedAt: new Date(Date.now() - 2 * 86_400_000) });

    await c.campaignTick(db);

    expect((await campaignRow(due.id)).status).toBe("running");
    expect((await campaignRow(future.id)).status).toBe("scheduled");
    expect(await campaignRow(blocked.id)).toMatchObject({ status: "draft", scheduledAt: null });
    expect(await campaignRow(old.id)).toMatchObject({ status: "completed", completedAt: expect.any(Date) });
    expect((await campaignRow(recent.id)).status).toBe("running");

    const notes = await db.select().from(t.notifications).where(eq(t.notifications.tenantId, tenant.id));
    // The creator and the campaign managers hear of it, in their own language; administrators only when nobody else would.
    expect(notes.map((n) => n.userId).sort()).toEqual([manager.id, creator.id].sort());
    expect(notes.find((n) => n.userId === manager.id)).toMatchObject({ kind: "campaign", title: "«Q4» kampaniyası planlaşdırılmış vaxtda başlamadı və qaralamalara qaytarıldı.", body: "Auditoriyada aktiv əməkdaş yoxdur.", href: `/admin/campaigns/${blocked.id}` });
    expect(notes.some((n) => n.userId === admin.id)).toBe(false);
    const [log] = await db.select().from(t.auditLog).where(and(eq(t.auditLog.targetId, blocked.id), eq(t.auditLog.action, "campaign.launch_blocked")));
    expect(log.meta).toMatchObject({ reason: "empty", scheduledAt: expect.any(String) });

    // A second tick changes nothing.
    await c.campaignTick(db);
    expect(await db.select().from(t.notifications).where(eq(t.notifications.tenantId, tenant.id))).toHaveLength(2);
  });

  it("tells the administrators when nobody else would hear of a blocked launch", async () => {
    const tenant = await addTenant(db, { settings: settings() });
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    const gone = await addDepartment(db, tenant.id, "Empty");
    await draft(tenant.id, { status: "scheduled", scheduledAt: new Date(Date.now() - 60_000), audience: "department", departmentId: gone.id });
    await c.campaignTick(db);
    expect((await db.select().from(t.notifications).where(eq(t.notifications.tenantId, tenant.id))).map((n) => n.userId)).toEqual([admin.id]);
  });
});

describe("tracking", () => {
  async function launched() {
    const { tenant, people } = await org({ people: 1 });
    const campaign = await draft(tenant.id, { name: "Payslip Oct" });
    await c.launchCampaign(db, campaign.id, null);
    const [r] = await recipients(campaign.id);
    return { tenant, person: people[0], campaign, r };
  }
  const risksOf = (userId: string) => db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, userId));

  it("records an open once", async () => {
    const { r } = await launched();
    await c.recordOpen(db, r.token);
    const [first] = await recipients(r.campaignId);
    await c.recordOpen(db, r.token);
    const [second] = await recipients(r.campaignId);
    expect(first.openedAt).toBeInstanceOf(Date);
    expect(second.openedAt).toEqual(first.openedAt);
  });

  it("records a click once: the open, a risk tied to the training module, the event and the new score", async () => {
    const { tenant, person, campaign, r } = await launched();
    const res = await c.recordClick(db, r.token, "link");
    expect(res).toMatchObject({ recipientId: r.id, tenantId: tenant.id, campaignName: "Payslip Oct", submitted: false, cancelled: false, locale: "en" });
    const [row] = await recipients(campaign.id);
    expect(row.clickedAt).toBeInstanceOf(Date);
    expect(row.openedAt).toEqual(row.clickedAt);
    const risks = await risksOf(person.id);
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ kind: "phishing_click", severity: "medium", sourceRef: campaign.id, moduleId: trainingModuleId, status: "open" });
    expect(riskTitle(risks[0].title, "en")).toBe("You opened the link in the “Payslip Oct” phishing simulation.");
    expect(await events(tenant.id)).toEqual(["phishing.clicked"]);
    const [u] = await db.select({ risk: t.users.riskScore }).from(t.users).where(eq(t.users.id, person.id));
    expect(u.risk).not.toBe(50);
    await c.recordClick(db, r.token, "link");
    expect(await risksOf(person.id)).toHaveLength(1);
  });

  it("records a click once when the link is opened twice at the same time", async () => {
    const { tenant, person, r } = await launched();
    await Promise.all([c.recordClick(db, r.token, "link"), c.recordClick(db, r.token, "qr")]);
    expect(await risksOf(person.id)).toHaveLength(1);
    expect(await events(tenant.id)).toHaveLength(1);
  });

  it("raises the risk to high on the fake sign-in, once", async () => {
    const { tenant, person, r } = await launched();
    await c.recordClick(db, r.token, "link");
    await Promise.all([c.recordSubmit(db, r.token), c.recordSubmit(db, r.token)]);
    await c.recordSubmit(db, r.token);
    const [row] = await recipients(r.campaignId);
    expect(row.submittedAt).toBeInstanceOf(Date);
    expect((await risksOf(person.id))[0].severity).toBe("high");
    expect((await events(tenant.id)).filter((e) => e === "simulation.risky")).toHaveLength(1);
  });

  it("knows nothing of an unknown token", async () => {
    expect(await c.recordClick(db, "unknowntoken0000000000", "link")).toBeNull();
    await expect(c.recordSubmit(db, "unknowntoken0000000000")).resolves.toBeUndefined();
  });
});

describe("campaignStats", () => {
  it("counts the funnel per campaign", async () => {
    const { tenant, people } = await org({ people: 3 });
    const campaign = await draft(tenant.id);
    await c.launchCampaign(db, campaign.id, null);
    const rows = await recipients(campaign.id);
    await c.recordOpen(db, rows[0].token);
    await c.recordClick(db, rows[1].token, "link");
    await c.recordSubmit(db, rows[1].token);
    await db.update(t.campaignRecipients).set({ reportedAt: new Date() }).where(eq(t.campaignRecipients.id, rows[2].id));
    const stats = await c.campaignStats(db, [campaign.id]);
    expect(stats.get(campaign.id)).toEqual({ sent: 3, opened: 2, clicked: 1, submitted: 1, reported: 1 });
    expect((await c.campaignStats(db, [])).size).toBe(0);
    void people;
  });
});
