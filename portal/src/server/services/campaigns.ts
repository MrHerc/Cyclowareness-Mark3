import { and, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { departmentClosure } from "./assignments";
import { randomToken } from "./progress";
import { audit } from "./audit";
import { emitEvent } from "./events";
import { queueEmail } from "../mail";
import { sendSms, smsAvailable } from "../sms";
import { recomputeRisk } from "./risk";
import { TEMPLATE_BY_KEY, templateText, type CampaignTemplate } from "../../lib/campaigns/templates";

const APP_URL = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DAY = 86_400_000;

export async function campaignAudience(db: DB, c: { tenantId: string; audience: "all" | "department"; departmentId: string | null }) {
  const users = await db
    .select({ id: t.users.id, email: t.users.email, phone: t.users.phone, name: t.users.name, locale: t.users.locale, departmentId: t.users.departmentId })
    .from(t.users)
    .where(and(eq(t.users.tenantId, c.tenantId), eq(t.users.status, "active"), ne(t.users.role, "super_admin")));
  if (c.audience === "all" || !c.departmentId) return users;
  const departments = await db.select({ id: t.departments.id, parentId: t.departments.parentId }).from(t.departments).where(eq(t.departments.tenantId, c.tenantId));
  const scope = departmentClosure(departments).get(c.departmentId) ?? new Set([c.departmentId]);
  return users.filter((u) => u.departmentId && scope.has(u.departmentId));
}

export type LaunchBlock = "mail" | "sms" | "voice" | "empty";

/** Whether a channel can deliver right now. Development simulates delivery and logs it. */
export async function launchBlocker(db: DB, tenantId: string, channel: CampaignTemplate["channel"], audienceSize: number): Promise<LaunchBlock | null> {
  if (audienceSize === 0) return "empty";
  const prod = process.env.NODE_ENV === "production";
  if (channel === "email") {
    const [tenant] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenantId));
    if (prod && !tenant?.settings.email.enabled) return "mail";
  }
  if (channel === "sms" && !smsAvailable()) return "sms";
  if (channel === "voice" && prod && !process.env.VOICE_PROVIDER) return "voice";
  return null;
}

function emailHtml(tpl: CampaignTemplate, locale: string, token: string): { subject: string; text: string; html: string } {
  const link = `${APP_URL()}/t/${token}`;
  const subject = templateText(tpl.subject, locale);
  const body = templateText(tpl.body, locale);
  const cta = tpl.cta ? templateText(tpl.cta, locale) : null;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const qr = tpl.qr ? `<p style="margin:18px 0"><img src="${APP_URL()}/api/qr/${token}" width="180" height="180" alt="QR"></p>` : "";
  const attachment = tpl.attachment ? `<p style="margin:16px 0;padding:10px 14px;border:1px solid #ddd;border-radius:8px;display:inline-block">📎 <a href="${link}">${esc(tpl.attachment.name)}</a> · ${tpl.attachment.size}</p>` : "";
  const button = cta ? `<p style="margin:22px 0"><a href="${link}" style="background:#1f6feb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600">${esc(cta)}</a></p>` : "";
  const pixel = `<img src="${APP_URL()}/api/t/${token}/open" width="1" height="1" alt="" style="display:block;border:0">`;
  const html = `<!doctype html><html><body style="margin:0;font-family:Segoe UI,Arial,sans-serif;color:#222;background:#fff"><div style="max-width:600px;padding:24px">${paragraphs}${attachment}${qr}${button}${pixel}</div></body></html>`;
  const text = `${body}\n\n${cta ? `${cta}: ` : ""}${link}`;
  return { subject, text, html };
}

/** Creates recipients and delivers the simulation. Returns the number of people reached. */
export async function launchCampaign(db: DB, campaignId: string, actorId: string | null): Promise<{ ok: true; count: number } | { ok: false; reason: LaunchBlock }> {
  const [c] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, campaignId));
  if (!c || (c.status !== "draft" && c.status !== "scheduled")) return { ok: false, reason: "empty" };
  const tpl = TEMPLATE_BY_KEY.get(c.templateKey);
  if (!tpl) return { ok: false, reason: "empty" };
  const audience = await campaignAudience(db, c);
  const block = await launchBlocker(db, c.tenantId, tpl.channel, audience.length);
  if (block) {
    await audit(db, { tenantId: c.tenantId, actorId, action: "campaign.launch_blocked", targetType: "campaign", targetId: c.id, meta: { reason: block } });
    return { ok: false, reason: block };
  }
  const now = new Date();
  await db.update(t.campaigns).set({ status: "running", launchedAt: now }).where(eq(t.campaigns.id, c.id));
  let count = 0;
  for (const u of audience) {
    const token = randomToken(16);
    const [rec] = await db.insert(t.campaignRecipients).values({ campaignId: c.id, userId: u.id, token, sentAt: now }).returning({ id: t.campaignRecipients.id });
    if (!rec) continue;
    if (tpl.channel === "email") {
      const m = emailHtml(tpl, u.locale, token);
      // Display name is the template's; the address is the organisation's own sending domain.
      // Deferred: the job runner sends the batch, so Launch does not wait for one SMTP round-trip per person.
      await queueEmail(db, c.tenantId, { to: u.email, kind: "simulation", subject: m.subject, text: m.text, html: m.html, fromName: templateText(tpl.sender.name, u.locale) }, { defer: true });
    } else if (tpl.channel === "sms" && u.phone) {
      await sendSms(u.phone, `${templateText(tpl.body, u.locale)} ${APP_URL()}/t/${token}`);
    }
    count++;
  }
  await audit(db, { tenantId: c.tenantId, actorId, action: "campaign.launched", targetType: "campaign", targetId: c.id, meta: { recipients: count, channel: tpl.channel } });
  return { ok: true, count };
}

function clickTitle(name: string, locale: string): string {
  if (locale === "en") return `You opened the link in the “${name}” phishing simulation.`;
  if (locale === "ru") return `Вы открыли ссылку в фишинговой симуляции «${name}».`;
  return `«${name}» fişinq simulyasiyasındakı keçidi açmısınız.`;
}

/** A recipient opened the simulated message (tracking pixel). */
export async function recordOpen(db: DB, token: string) {
  await db.update(t.campaignRecipients).set({ openedAt: new Date() }).where(and(eq(t.campaignRecipients.token, token), isNull(t.campaignRecipients.openedAt)));
}

/**
 * The recipient followed the link (or scanned the QR). Records the click once, opens a
 * "phishing click" risk tied to the template's training module and returns what to show.
 */
export async function recordClick(db: DB, token: string, via: "link" | "qr") {
  const [row] = await db
    .select({ r: t.campaignRecipients, c: t.campaigns, user: { id: t.users.id, locale: t.users.locale, name: t.users.name } })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .where(eq(t.campaignRecipients.token, token));
  if (!row) return null;
  const tpl = TEMPLATE_BY_KEY.get(row.c.templateKey);
  if (!tpl) return null;
  const first = !row.r.clickedAt;
  if (first && row.c.status !== "cancelled") {
    const now = new Date();
    await db.update(t.campaignRecipients).set({ clickedAt: now, openedAt: row.r.openedAt ?? now }).where(eq(t.campaignRecipients.id, row.r.id));
    const [mod] = await db.select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.slug, tpl.moduleSlug), isNull(t.modules.tenantId)));
    await db.insert(t.behaviorRisks).values({
      tenantId: row.c.tenantId,
      userId: row.user.id,
      kind: "phishing_click",
      severity: "medium",
      title: clickTitle(row.c.name, row.user.locale),
      sourceRef: row.c.id,
      moduleId: mod?.id ?? null,
      dueDate: new Date(now.getTime() + 14 * DAY).toISOString().slice(0, 10),
    });
    await emitEvent(db, row.c.tenantId, via === "qr" ? "qr.scanned" : "phishing.clicked", { campaign: row.c.name, userId: row.user.id });
    await recomputeRisk(db, row.c.tenantId, [row.user.id]);
  }
  return { recipientId: row.r.id, tenantId: row.c.tenantId, template: tpl, locale: row.user.locale, campaignName: row.c.name, submitted: !!row.r.submittedAt };
}

/** The recipient typed into the fake login form. Only the fact is stored, never the input. */
export async function recordSubmit(db: DB, token: string) {
  const [row] = await db
    .select({ r: t.campaignRecipients, c: t.campaigns })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .where(eq(t.campaignRecipients.token, token));
  if (!row || row.r.submittedAt) return;
  await db.update(t.campaignRecipients).set({ submittedAt: new Date() }).where(eq(t.campaignRecipients.id, row.r.id));
  await db
    .update(t.behaviorRisks)
    .set({ severity: "high" })
    .where(and(eq(t.behaviorRisks.userId, row.r.userId), eq(t.behaviorRisks.sourceRef, row.c.id), eq(t.behaviorRisks.status, "open")));
  await emitEvent(db, row.c.tenantId, "simulation.risky", { campaign: row.c.name, userId: row.r.userId, stage: "submitted" });
  await recomputeRisk(db, row.c.tenantId, [row.r.userId]);
}

/** Background: launch scheduled campaigns that are due and close campaigns after 14 days. */
export async function campaignTick(db: DB) {
  const due = await db.select({ id: t.campaigns.id }).from(t.campaigns).where(and(eq(t.campaigns.status, "scheduled"), lte(t.campaigns.scheduledAt, new Date())));
  for (const c of due) await launchCampaign(db, c.id, null);
  await db
    .update(t.campaigns)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(t.campaigns.status, "running"), lte(t.campaigns.launchedAt, new Date(Date.now() - 14 * DAY))));
}

export async function campaignStats(db: DB, ids: string[]) {
  if (!ids.length) return new Map<string, { sent: number; opened: number; clicked: number; submitted: number; reported: number }>();
  const rows = await db
    .select({
      id: t.campaignRecipients.campaignId,
      sent: sql<number>`count(${t.campaignRecipients.sentAt})`,
      opened: sql<number>`count(${t.campaignRecipients.openedAt})`,
      clicked: sql<number>`count(${t.campaignRecipients.clickedAt})`,
      submitted: sql<number>`count(${t.campaignRecipients.submittedAt})`,
      reported: sql<number>`count(${t.campaignRecipients.reportedAt})`,
    })
    .from(t.campaignRecipients)
    .where(inArray(t.campaignRecipients.campaignId, ids))
    .groupBy(t.campaignRecipients.campaignId);
  return new Map(rows.map((r) => [r.id, { sent: Number(r.sent), opened: Number(r.opened), clicked: Number(r.clicked), submitted: Number(r.submitted), reported: Number(r.reported) }]));
}
