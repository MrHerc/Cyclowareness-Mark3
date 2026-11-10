import { and, eq, gte, inArray, isNull, lte, ne, notExists } from "drizzle-orm";
import { createTranslator } from "next-intl";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import type { TenantSettings } from "../db/schema";
import type { LessonDraft } from "../ai";
import { audit } from "./audit";
import { launchBlocker } from "./campaigns";
import { notifyUsers } from "./notify";
import { studioScenes } from "../../lib/content/studio";
import type { Scene } from "../../lib/content/types";
import { TEMPLATES, TEMPLATE_BY_KEY, templateOnPlan, templateText, type CampaignTemplate, type L10n } from "../../lib/campaigns/templates";
import { TEACHABLE_DAYS, TEACHABLE_PREFIX, featuresFor } from "../../lib/tenant-defaults";
import { dayPlus, zonedTime } from "../../lib/time";
import { LOCALES, isLocale, pick } from "../../i18n/config";
import { messagesFor } from "../../i18n/translator";

/**
 * Teachable-moment loop: a click in a simulation → a 90-second lesson about that message (assigned within the
 * hour, due in 7 days) → a one-person re-simulation of the same channel at the next difficulty, 14 days after the
 * lesson (21 after the assignment when it is not done). Run hourly per organisation by the job runner.
 */

const DAY = 86_400_000;
const LEVELS = ["Easy", "Medium", "Hard"] as const;
/** Voice has no telephony adapter and a USB drop is a physical kit: neither can be re-sent to one person automatically. */
const RESIM_CHANNELS: ReadonlySet<CampaignTemplate["channel"]> = new Set(["email", "sms"]);
/** The micro-lesson's single lesson. */
export const TEACHABLE_LESSON = "lesson-1";

/** The micro-lesson of a template in one language, built from the template's own texts (no AI). */
export async function microLesson(tpl: CampaignTemplate, locale: string): Promise<{ title: string; subtitle: string; scenes: Scene[] }> {
  const tr = createTranslator({ ...(await messagesFor(locale)), namespace: "learner.teachable" });
  const text = (v: L10n) => templateText(v, locale);
  const flags = tpl.redFlags.map(text);
  // The template's own lure: its button, else its attachment.
  const lure = tpl.cta ? text(tpl.cta) : tpl.attachment ? text(tpl.attachment.name) : null;
  const draft: LessonDraft = {
    title: tr("title", { name: text(tpl.name) }),
    subtitle: tr("subtitle"),
    intro: tr("intro"),
    points: flags,
    question: {
      prompt: tr("question", { lure: text(tpl.channel === "email" ? tpl.subject : tpl.name) }),
      options: [
        { label: lure ?? tr("optionOpen"), correct: false, feedback: tr("optionLureFeedback") },
        { label: tr("optionReport"), correct: true, feedback: tr("optionReportFeedback") },
        { label: tr("optionReply"), correct: false, feedback: tr("optionReplyFeedback") },
      ],
    },
    recap: [tr("recapPause"), tr("recapReport")],
    ...(tpl.channel === "email" && lure
      ? { hotspot: { prompt: tr("hotspotPrompt"), from: tpl.sender.address, subject: text(tpl.subject), body: `${text(tpl.body)}\n${lure}`, targets: [{ text: lure, label: tr("spotLabel"), explain: tr("spotExplain") }] } }
      : {
          swipe: {
            prompt: tr("swipePrompt"),
            cards: [
              { from: text(tpl.sender.name), text: text(tpl.body), verdict: "threat" as const, explain: flags[0] },
              { from: tr("safeFrom"), text: tr("safeText"), verdict: "safe" as const, explain: tr("safeExplain") },
            ],
          },
        }),
  };
  const scenes = studioScenes(draft);
  if (!scenes) throw new Error(`teachable lesson of ${tpl.key} (${locale}) does not build`);
  return { title: draft.title, subtitle: draft.subtitle, scenes };
}

/** The organisation's hidden micro-lesson module of a template, with a text in each of `locales` (added when missing). */
async function microModule(db: DB, tenantId: string, tpl: CampaignTemplate, locales: string[]): Promise<{ id: string; slug: string; title: Record<string, string> }> {
  const slug = `${TEACHABLE_PREFIX}${tpl.key}`;
  let [mod] = await db.select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title }).from(t.modules).where(and(eq(t.modules.slug, slug), eq(t.modules.tenantId, tenantId)));
  if (!mod) {
    const texts = await Promise.all(LOCALES.map(async (l) => [l, await microLesson(tpl, l)] as const));
    const title = Object.fromEntries(texts.map(([l, x]) => [l, x.title]));
    const [library] = await db.select({ category: t.modules.category }).from(t.modules).where(and(eq(t.modules.slug, tpl.moduleSlug), isNull(t.modules.tenantId)));
    [mod] = await db
      .insert(t.modules)
      .values({
        tenantId,
        slug,
        category: library?.category ?? "email",
        // No audience: getCatalog shows it only to the people it is assigned to.
        audiences: [],
        title,
        subtitle: Object.fromEntries(texts.map(([l, x]) => [l, x.subtitle])),
        minutes: 2,
        xp: 20,
        difficulty: tpl.difficulty,
        // "library": generated, never edited in Studio (whose list shows the organisation's custom and AI modules).
        origin: "library",
        status: "published",
        sortOrder: 2000,
      })
      .returning({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title });
    await db.insert(t.lessons).values({ moduleId: mod.id, key: TEACHABLE_LESSON, title, minutes: 2, position: 0 });
  }
  const [lesson] = await db.select({ id: t.lessons.id }).from(t.lessons).where(and(eq(t.lessons.moduleId, mod.id), eq(t.lessons.key, TEACHABLE_LESSON)));
  const have = new Set((await db.select({ locale: t.lessonContents.locale }).from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id))).map((r) => r.locale));
  for (const l of new Set(locales.filter((x) => isLocale(x) && !have.has(x)))) {
    await db.insert(t.lessonContents).values({ lessonId: lesson.id, locale: l, scenes: (await microLesson(tpl, l)).scenes }).onConflictDoNothing();
  }
  return mod;
}

/** The re-simulation's template: the same channel at the next difficulty, else the closest harder or equal one; null when none is on the plan. */
export function resimTemplate(tpl: CampaignTemplate, features: ReadonlySet<string>): CampaignTemplate | null {
  const level = LEVELS.indexOf(tpl.difficulty);
  const options = TEMPLATES.filter((x) => x.channel === tpl.channel && templateOnPlan(x, features)).sort((a, b) => LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty));
  const others = options.filter((x) => x.key !== tpl.key);
  return others.find((x) => LEVELS.indexOf(x.difficulty) === Math.min(level + 1, 2)) ?? others.find((x) => LEVELS.indexOf(x.difficulty) >= level) ?? options.find((x) => x.key === tpl.key) ?? null;
}

/** When a loop's re-simulation is due: 10:00 in the organisation's zone (working hours, as a real attack lands) on the day it falls on. */
export function resimAt(loop: { assignedAt: Date; completedAt: Date | null }, timeZone: string): Date {
  const day = loop.completedAt ? dayPlus(TEACHABLE_DAYS.resim, timeZone, loop.completedAt) : dayPlus(TEACHABLE_DAYS.fallback, timeZone, loop.assignedAt);
  return zonedTime(day, "10:00:00", timeZone);
}

export const canResim = (templateKey: string) => {
  const tpl = TEMPLATE_BY_KEY.get(templateKey);
  return !!tpl && RESIM_CHANNELS.has(tpl.channel);
};

/** The hourly step: new loops for the last day's clicks, re-simulations that are due, and their results. Returns the loops started. */
export async function teachableTick(db: DB, tenant: { id: string; settings: TenantSettings }, now: Date): Promise<number> {
  // Switched off, nothing new starts and no re-simulation is scheduled, but the result of one already sent is still recorded.
  const on = tenant.settings.learning.teachable;
  const tz = tenant.settings.timeZone;
  let started = 0;

  // 1. Clicks (a submit always follows one) without a loop. A live drill only plays the attack, so it starts none;
  // a re-simulation measures the loop it belongs to, so a click in it starts none either (the loop ends there).
  const clicks = !on ? [] : await db
    .select({ recipientId: t.campaignRecipients.id, userId: t.users.id, locale: t.users.locale, campaignId: t.campaigns.id, templateKey: t.campaigns.templateKey })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .where(
      and(
        eq(t.campaigns.tenantId, tenant.id),
        eq(t.users.tenantId, tenant.id),
        eq(t.users.status, "active"),
        ne(t.campaigns.audience, "person"),
        gte(t.campaignRecipients.clickedAt, new Date(now.getTime() - DAY)),
        lte(t.campaignRecipients.clickedAt, now),
        notExists(db.select({ id: t.teachableLoops.id }).from(t.teachableLoops).where(eq(t.teachableLoops.sourceRecipientId, t.campaignRecipients.id))),
        notExists(db.select({ id: t.drillRuns.id }).from(t.drillRuns).where(eq(t.drillRuns.campaignId, t.campaigns.id))),
      ),
    );
  for (const c of clicks) {
    const tpl = TEMPLATE_BY_KEY.get(c.templateKey);
    if (!tpl) continue;
    // One transaction per click: the loop row is the claim later ticks skip, so it never stands without its module, lesson and assignment.
    const created = await db.transaction(async (tx) => {
      const mod = await microModule(tx, tenant.id, tpl, [...tenant.settings.locales, c.locale]);
      const [loop] = await tx
        .insert(t.teachableLoops)
        .values({ tenantId: tenant.id, userId: c.userId, sourceCampaignId: c.campaignId, sourceRecipientId: c.recipientId, microModuleId: mod.id, assignedAt: now })
        .onConflictDoNothing()
        .returning({ id: t.teachableLoops.id });
      if (!loop) return false;
      const due = dayPlus(TEACHABLE_DAYS.lesson, tz, now);
      const [assignment] = await tx
        .insert(t.assignments)
        .values({ tenantId: tenant.id, moduleId: mod.id, scope: "user", userId: c.userId, dueKind: "fixed", dueDate: due, reason: "teachable" })
        .returning({ id: t.assignments.id });
      // A person who already took this lesson in an earlier loop takes it again: otherwise the new assignment counts as done at once.
      await tx
        .update(t.moduleProgress)
        .set({ status: "in_progress", completedAt: null })
        .where(and(eq(t.moduleProgress.userId, c.userId), eq(t.moduleProgress.moduleId, mod.id), eq(t.moduleProgress.status, "completed")));
      // The click's risk now asks for this lesson: finishing it closes the risk (progress.ts completeLesson).
      await tx
        .update(t.behaviorRisks)
        .set({ moduleId: mod.id, dueDate: due })
        .where(and(eq(t.behaviorRisks.tenantId, tenant.id), eq(t.behaviorRisks.userId, c.userId), eq(t.behaviorRisks.sourceRef, c.campaignId), eq(t.behaviorRisks.kind, "phishing_click"), eq(t.behaviorRisks.status, "open")));
      const link = `/learn/${mod.slug}`;
      await notifyUsers(tx, tenant.id, [c.userId], "assignment", { module: (l) => pick(mod.title, l), dueDate: due, link }, { href: link }, { defer: true });
      await audit(tx, { tenantId: tenant.id, actorId: null, action: "assignment.created", targetType: "assignment", targetId: assignment.id, meta: { teachable: true, campaign: c.campaignId, template: tpl.key } });
      return true;
    });
    if (created) started++;
  }

  // 2. Re-simulations that are due, only while the organisation can send on that channel (otherwise the loop waits).
  const waiting = !on ? [] : await db
    .select({ loop: t.teachableLoops, templateKey: t.campaigns.templateKey, person: t.users.name, active: t.users.status })
    .from(t.teachableLoops)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.teachableLoops.sourceCampaignId))
    .innerJoin(t.users, eq(t.users.id, t.teachableLoops.userId))
    .where(and(eq(t.teachableLoops.tenantId, tenant.id), inArray(t.teachableLoops.status, ["assigned", "completed"]), isNull(t.teachableLoops.resimCampaignId)));
  const due = waiting.filter((w) => now >= resimAt(w.loop, tz));
  if (due.length) {
    const [org] = await db.select({ plan: t.tenants.plan, features: t.tenants.features }).from(t.tenants).where(eq(t.tenants.id, tenant.id));
    const features = featuresFor(org.plan, org.features);
    const tr = createTranslator({ ...(await messagesFor(tenant.settings.defaultLocale)), namespace: "admin.campaigns.loop" });
    for (const { loop, templateKey, person, active } of due) {
      const tpl = TEMPLATE_BY_KEY.get(templateKey);
      if (!tpl || !canResim(templateKey)) {
        await db.update(t.teachableLoops).set({ status: "closed" }).where(eq(t.teachableLoops.id, loop.id));
        continue;
      }
      const next = resimTemplate(tpl, features);
      if (active !== "active" || !next || (await launchBlocker(db, tenant.id, next.channel, 1))) continue;
      const name = tr("campaignName", { template: templateText(next.name, tenant.settings.defaultLocale), person });
      // Scheduled now: the next tick's campaignTick launches it through launchCampaign, the normal sending path.
      // Campaign and loop together, so a failure between them can never leave a second re-simulation to the next tick.
      await db.transaction(async (tx) => {
        const [campaign] = await tx
          .insert(t.campaigns)
          .values({ tenantId: tenant.id, name, channel: next.channel, templateKey: next.key, audience: "person", userId: loop.userId, status: "scheduled", scheduledAt: now })
          .returning({ id: t.campaigns.id });
        await tx.update(t.teachableLoops).set({ resimCampaignId: campaign.id, status: "resim" }).where(eq(t.teachableLoops.id, loop.id));
        await audit(tx, { tenantId: tenant.id, actorId: null, action: "campaign.created", targetType: "campaign", targetId: campaign.id, meta: { name, template: next.key, teachable: true } });
      });
    }
  }

  // 3. Results of the re-simulations sent: a click (or a submitted form) fails it, no click until the campaign ends passes it.
  const sent = await db
    .select({ id: t.teachableLoops.id, result: t.teachableLoops.resimResult, campaign: t.campaigns.status, r: { clickedAt: t.campaignRecipients.clickedAt, submittedAt: t.campaignRecipients.submittedAt, reportedAt: t.campaignRecipients.reportedAt } })
    .from(t.teachableLoops)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.teachableLoops.resimCampaignId))
    .leftJoin(t.campaignRecipients, and(eq(t.campaignRecipients.campaignId, t.teachableLoops.resimCampaignId), eq(t.campaignRecipients.userId, t.teachableLoops.userId)))
    .where(and(eq(t.teachableLoops.tenantId, tenant.id), eq(t.teachableLoops.status, "resim")));
  for (const s of sent) {
    const ended = s.campaign === "completed" || s.campaign === "cancelled";
    const result = s.r?.submittedAt ? "submitted" : s.r?.clickedAt ? "clicked" : s.r?.reportedAt ? "reported" : s.campaign === "completed" ? "passed" : null;
    if (result !== s.result || ended) await db.update(t.teachableLoops).set({ resimResult: result, status: ended ? "closed" : "resim" }).where(eq(t.teachableLoops.id, s.id));
  }
  return started;
}
