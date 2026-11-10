import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne, notExists, notInArray, or, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { departmentClosure } from "./assignments";
import { randomToken } from "./progress";
import { audit } from "./audit";
import { emitEvent } from "./events";
import { queueEmail } from "../mail";
import { sendSms, smsAvailable } from "../sms";
import { recomputeRisk } from "./risk";
import { appUrl, env } from "../env";
import { TEMPLATE_BY_KEY, clickRiskTitle, templateOnPlan, templateText, type CampaignTemplate } from "../../lib/campaigns/templates";
import { featuresFor, withDefaults } from "../../lib/tenant-defaults";
import { dayPlus } from "../../lib/time";
import { tenantTimeZone } from "./tenants";
import { createTranslator } from "next-intl";
import { dirOf, isLocale } from "../../i18n/config";
import { messagesFor } from "../../i18n/translator";

const DAY = 86_400_000;

export async function campaignAudience(db: DB, c: { tenantId: string; audience: "all" | "department"; departmentId: string | null }) {
  const users = await db
    .select({ id: t.users.id, email: t.users.email, phone: t.users.phone, name: t.users.name, locale: t.users.locale, departmentId: t.users.departmentId })
    .from(t.users)
    .where(and(eq(t.users.tenantId, c.tenantId), eq(t.users.status, "active"), ne(t.users.role, "super_admin")));
  if (c.audience === "all") return users;
  // A department audience whose department is gone reaches nobody (never the whole organisation).
  if (!c.departmentId) return [];
  const departments = await db.select({ id: t.departments.id, parentId: t.departments.parentId }).from(t.departments).where(eq(t.departments.tenantId, c.tenantId));
  const scope = departmentClosure(departments).get(c.departmentId) ?? new Set([c.departmentId]);
  return users.filter((u) => u.departmentId && scope.has(u.departmentId));
}

export type LaunchBlock = "mail" | "sms" | "voice" | "empty" | "plan" | "launched";

/** Whether a channel can deliver right now. Development simulates delivery and logs it. */
export async function launchBlocker(db: DB, tenantId: string, channel: CampaignTemplate["channel"], audienceSize: number): Promise<LaunchBlock | null> {
  if (audienceSize === 0) return "empty";
  const prod = env.isProd;
  if (channel === "email") {
    const [tenant] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, tenantId));
    if (prod && !(tenant && withDefaults(tenant.settings).email.enabled)) return "mail";
  }
  if (channel === "sms" && !smsAvailable()) return "sms";
  // No telephony adapter exists: a voice launch would record calls as sent that were never placed.
  if (channel === "voice") return "voice";
  return null;
}

function emailHtml(tpl: CampaignTemplate, locale: string, token: string): { subject: string; text: string; html: string; lang: string } {
  const link = `${appUrl()}/t/${token}`;
  const subject = templateText(tpl.subject, locale);
  const body = templateText(tpl.body, locale);
  const cta = tpl.cta ? templateText(tpl.cta, locale) : null;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const qr = tpl.qr ? `<p style="margin:18px 0"><img src="${appUrl()}/api/qr/${token}" width="180" height="180" alt="QR"></p>` : "";
  const attachment = tpl.attachment ? `<p style="margin:16px 0;padding:10px 14px;border:1px solid #ddd;border-radius:8px;display:inline-block">📎 <a href="${link}">${esc(templateText(tpl.attachment.name, locale))}</a> · ${esc(templateText(tpl.attachment.size, locale))}</p>` : "";
  const button = cta ? `<p style="margin:22px 0"><a href="${link}" style="background:#1f6feb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600">${esc(cta)}</a></p>` : "";
  const pixel = `<img src="${appUrl()}/api/t/${token}/open" width="1" height="1" alt="" style="display:block;border:0">`;
  // The language templateText fell back to, so mail clients read and spell-check the text in it.
  const lang = locale in tpl.body ? locale : "en";
  // Repeated on the content block: some mail clients drop the attributes of <html>.
  const dir = dirOf(lang);
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;font-family:Segoe UI,Arial,sans-serif;color:#222;background:#fff"><div dir="${dir}" style="max-width:600px;padding:24px${dir === "rtl" ? ";text-align:right" : ""}">${paragraphs}${attachment}${qr}${button}${pixel}</div></body></html>`;
  const text = `${body}\n\n${cta ? `${cta}: ` : ""}${link}`;
  return { subject, text, html, lang };
}

/** Creates recipients and queues the simulation (the job runner sends mail and SMS). Returns the number of people it goes to. */
export async function launchCampaign(db: DB, campaignId: string, actorId: string | null): Promise<{ ok: true; count: number } | { ok: false; reason: LaunchBlock }> {
  const [c] = await db.select().from(t.campaigns).where(eq(t.campaigns.id, campaignId));
  if (!c) return { ok: false, reason: "empty" };
  // A second Launch click (or the scheduler getting there first) is told so, not that the audience is empty.
  if (c.status !== "draft" && c.status !== "scheduled") return { ok: false, reason: "launched" };
  const tpl = TEMPLATE_BY_KEY.get(c.templateKey);
  if (!tpl) return { ok: false, reason: "empty" };
  // Checked at every launch, scheduled ones included: a downgrade or an operator override may have switched the channel off since saving.
  const [tenant] = await db.select({ plan: t.tenants.plan, features: t.tenants.features }).from(t.tenants).where(eq(t.tenants.id, c.tenantId));
  const audience = await campaignAudience(db, c);
  const block = !tenant || !templateOnPlan(tpl, featuresFor(tenant.plan, tenant.features)) ? "plan" : await launchBlocker(db, c.tenantId, tpl.channel, audience.length);
  if (block) {
    // A scheduled launch also records the missed time: the campaign goes back to draft without it.
    const missed = c.status === "scheduled" && c.scheduledAt ? { scheduledAt: c.scheduledAt.toISOString() } : {};
    await audit(db, { tenantId: c.tenantId, actorId, action: "campaign.launch_blocked", targetType: "campaign", targetId: c.id, meta: { reason: block, ...missed } });
    return { ok: false, reason: block };
  }
  const now = new Date();
  // Only the request that moves the campaign out of draft or scheduled sends it: a second click on
  // Launch, or the scheduler firing while someone launches by hand, must not send everyone a second copy.
  const [claimed] = await db
    .update(t.campaigns)
    .set({ status: "running", launchedAt: now })
    .where(and(eq(t.campaigns.id, c.id), inArray(t.campaigns.status, ["draft", "scheduled"])))
    .returning({ id: t.campaigns.id });
  if (!claimed) return { ok: false, reason: "launched" };
  let count = 0;
  for (const u of audience) {
    const token = randomToken(16);
    // An SMS recipient waits with an empty sentAt: sendQueuedSms (job runner) sends it and sets the time.
    const sms = tpl.channel === "sms";
    const [rec] = await db.insert(t.campaignRecipients).values({ campaignId: c.id, userId: u.id, token, sentAt: sms ? null : now }).returning({ id: t.campaignRecipients.id });
    if (!rec) continue;
    if (tpl.channel === "email") {
      const m = emailHtml(tpl, u.locale, token);
      // Display name is the template's; the address is the organisation's own sending domain.
      // Deferred: the job runner sends the batch, so Launch does not wait for one SMTP round-trip per person.
      await queueEmail(db, c.tenantId, { to: u.email, kind: "simulation", subject: m.subject, text: m.text, html: m.html, fromName: templateText(tpl.sender.name, u.locale), lang: m.lang }, { defer: true });
    } else if (sms && !u.phone) {
      continue;
    }
    count++;
  }
  await audit(db, { tenantId: c.tenantId, actorId, action: "campaign.launched", targetType: "campaign", targetId: c.id, meta: { recipients: count, channel: tpl.channel } });
  return { ok: true, count };
}

/** A recipient opened the simulated message (tracking pixel). Frozen once the campaign is cancelled, like clicks. */
export async function recordOpen(db: DB, token: string) {
  await db
    .update(t.campaignRecipients)
    .set({ openedAt: new Date() })
    .where(
      and(
        eq(t.campaignRecipients.token, token),
        isNull(t.campaignRecipients.openedAt),
        inArray(t.campaignRecipients.campaignId, db.select({ id: t.campaigns.id }).from(t.campaigns).where(ne(t.campaigns.status, "cancelled"))),
      ),
    );
}

/**
 * The recipient followed the link (or scanned the QR). Records the click once, opens a
 * "phishing click" risk tied to the template's training module and returns what to show.
 * Nothing is recorded once the campaign is cancelled; `cancelled` tells the page to skip the fake sign-in.
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
  const cancelled = row.c.status === "cancelled";
  const now = new Date();
  // The click is claimed by one conditional update, so two requests at the same moment (a double tap, a
  // browser retry) record one click, one risk and one event.
  const [claimed] =
    !row.r.clickedAt && !cancelled
      ? await db
          .update(t.campaignRecipients)
          .set({ clickedAt: now, openedAt: sql`coalesce(${t.campaignRecipients.openedAt}, ${now.toISOString()}::timestamptz)` })
          .where(and(eq(t.campaignRecipients.id, row.r.id), isNull(t.campaignRecipients.clickedAt)))
          .returning({ id: t.campaignRecipients.id })
      : [];
  if (claimed) {
    const [mod] = await db.select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.slug, tpl.moduleSlug), isNull(t.modules.tenantId)));
    await db.insert(t.behaviorRisks).values({
      tenantId: row.c.tenantId,
      userId: row.user.id,
      kind: "phishing_click",
      severity: "medium",
      title: clickRiskTitle(row.c.name),
      sourceRef: row.c.id,
      moduleId: mod?.id ?? null,
      dueDate: dayPlus(14, await tenantTimeZone(db, row.c.tenantId), now),
    });
    await emitEvent(db, row.c.tenantId, via === "qr" ? "qr.scanned" : "phishing.clicked", { campaign: row.c.name, userId: row.user.id });
    await recomputeRisk(db, row.c.tenantId, [row.user.id]);
  }
  return { recipientId: row.r.id, tenantId: row.c.tenantId, template: tpl, locale: row.user.locale, campaignName: row.c.name, submitted: !!row.r.submittedAt, cancelled };
}

/**
 * The recipient typed into the fake login form. Only the fact is stored, never the input; nothing once
 * the campaign is cancelled, and nothing without a recorded click (the form is only shown after the beacon).
 */
export async function recordSubmit(db: DB, token: string) {
  const [row] = await db
    .select({ r: t.campaignRecipients, c: t.campaigns })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .where(eq(t.campaignRecipients.token, token));
  if (!row || row.r.submittedAt || !row.r.clickedAt || row.c.status === "cancelled") return;
  // Claimed once, as the click is: a form sent twice raises the risk and emits the event once.
  const [claimed] = await db
    .update(t.campaignRecipients)
    .set({ submittedAt: new Date() })
    .where(and(eq(t.campaignRecipients.id, row.r.id), isNull(t.campaignRecipients.submittedAt)))
    .returning({ id: t.campaignRecipients.id });
  if (!claimed) return;
  await db
    .update(t.behaviorRisks)
    .set({ severity: "high" })
    .where(and(eq(t.behaviorRisks.userId, row.r.userId), eq(t.behaviorRisks.sourceRef, row.c.id), eq(t.behaviorRisks.status, "open")));
  await emitEvent(db, row.c.tenantId, "simulation.risky", { campaign: row.c.name, userId: row.r.userId, stage: "submitted" });
  await recomputeRisk(db, row.c.tenantId, [row.r.userId]);
}

/**
 * A scheduled campaign that cannot launch goes back to draft (the launch_blocked audit entry
 * written by launchCampaign keeps the reason and the missed time), so it is not retried every
 * minute; the past send time is cleared, as for any draft. Its creator and the campaign managers
 * get an in-app notice.
 */
async function returnToDraft(db: DB, campaignId: string, reason: LaunchBlock) {
  const [c] = await db
    .update(t.campaigns)
    .set({ status: "draft", scheduledAt: null })
    .where(and(eq(t.campaigns.id, campaignId), eq(t.campaigns.status, "scheduled")))
    .returning({ id: t.campaigns.id, tenantId: t.campaigns.tenantId, name: t.campaigns.name, createdBy: t.campaigns.createdBy });
  if (!c) return;
  const people = await db
    .select({ id: t.users.id, locale: t.users.locale, role: t.users.role })
    .from(t.users)
    .where(and(eq(t.users.tenantId, c.tenantId), eq(t.users.status, "active"), or(inArray(t.users.role, ["campaign_manager", "tenant_admin"]), c.createdBy ? eq(t.users.id, c.createdBy) : undefined)));
  // The creator and campaign managers; administrators only when nobody else would hear of it.
  const direct = people.filter((p) => p.id === c.createdBy || p.role === "campaign_manager");
  const targets = direct.length ? direct : people;
  if (!targets.length) return;
  // Each notice in its reader's language (admin.campaigns.blocked).
  const texts = new Map<string, { title: string; body: string }>();
  for (const lang of new Set(targets.map((p) => (isLocale(p.locale) ? p.locale : "en")))) {
    const tr = createTranslator({ ...(await messagesFor(lang)), namespace: "admin.campaigns.blocked" });
    texts.set(lang, { title: tr("title", { name: c.name }), body: tr(`reason.${reason}`) });
  }
  await db.insert(t.notifications).values(
    targets.map((p) => {
      const text = texts.get(isLocale(p.locale) ? p.locale : "en")!;
      return { tenantId: c.tenantId, userId: p.id, kind: "campaign", title: text.title, body: text.body, href: `/admin/campaigns/${c.id}` };
    }),
  );
}

/** Background: launch scheduled campaigns that are due and close campaigns after 14 days. */
/**
 * Ends a campaign by hand. One conditional update, so two administrators acting at the same moment
 * (one cancelling, one completing) leave exactly one end state, and a cancel never reopens a campaign.
 */
export async function setCampaignStatus(db: DB, tenantId: string, campaignId: string, status: "cancelled" | "completed"): Promise<boolean> {
  const rows = await db
    .update(t.campaigns)
    .set({ status, ...(status === "completed" ? { completedAt: new Date() } : {}) })
    .where(and(eq(t.campaigns.id, campaignId), eq(t.campaigns.tenantId, tenantId), notInArray(t.campaigns.status, ["completed", "cancelled"])))
    .returning({ id: t.campaigns.id });
  return rows.length > 0;
}

export async function campaignTick(db: DB) {
  const due = await db.select({ id: t.campaigns.id }).from(t.campaigns).where(and(eq(t.campaigns.status, "scheduled"), lte(t.campaigns.scheduledAt, new Date())));
  for (const c of due) {
    const res = await launchCampaign(db, c.id, null);
    if (!res.ok) await returnToDraft(db, c.id, res.reason);
  }
  await db
    .update(t.campaigns)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(t.campaigns.status, "running"), lte(t.campaigns.launchedAt, new Date(Date.now() - 14 * DAY))));
}

/** SMS simulations are attempted for a day after the launch (as long as mail is retried); later ones stay unsent. */
const SMS_SEND_WINDOW_MS = DAY;

/**
 * Background delivery of SMS simulations (called by the job runner): recipients of running SMS
 * campaigns whose sentAt is empty. Each message gets one attempt; one the gateway refuses is
 * recorded as sent like any attempted simulation. When the gateway is down (no answer, timeout,
 * refusing service) the rest wait for the next tick, so a dead gateway costs one timeout per tick
 * instead of one per recipient. The step stops after `limit` messages or `budgetMs`.
 */
export async function sendQueuedSms(db: DB, opts: { limit?: number; budgetMs?: number; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 200;
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  let handled = 0;
  while (handled < limit && Date.now() <= deadline) {
    const rows = await db
      .select({ id: t.campaignRecipients.id, token: t.campaignRecipients.token, phone: t.users.phone, locale: t.users.locale, templateKey: t.campaigns.templateKey })
      .from(t.campaignRecipients)
      .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
      .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
      .where(
        and(
          isNull(t.campaignRecipients.sentAt),
          eq(t.campaigns.status, "running"),
          eq(t.campaigns.channel, "sms"),
          gte(t.campaigns.launchedAt, new Date(now.getTime() - SMS_SEND_WINDOW_MS)),
          eq(t.users.status, "active"),
          isNotNull(t.users.phone),
          // A live drill's recipients are delivered by its playback (services/drill.ts); nothing is ever sent for them.
          notExists(db.select({ id: t.drillRuns.id }).from(t.drillRuns).where(eq(t.drillRuns.campaignId, t.campaigns.id))),
        ),
      )
      .orderBy(asc(t.campaigns.launchedAt), asc(t.campaignRecipients.id))
      .limit(Math.min(100, limit - handled));
    if (!rows.length) break;
    for (const r of rows) {
      if (handled >= limit || Date.now() > deadline) return handled;
      const tpl = TEMPLATE_BY_KEY.get(r.templateKey);
      const res = tpl && r.phone ? await sendSms(r.phone, `${templateText(tpl.body, r.locale)} ${appUrl()}/t/${r.token}`) : null;
      // The gateway takes no messages right now (or none is configured any more): all of them wait.
      if (res && !res.ok && res.error !== "failed") return handled;
      await db.update(t.campaignRecipients).set({ sentAt: new Date() }).where(and(eq(t.campaignRecipients.id, r.id), isNull(t.campaignRecipients.sentAt)));
      handled++;
    }
  }
  return handled;
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
