/**
 * Live drill (operator feature `live_drill`): a phishing simulation whose audience's behaviour is
 * planned up front (src/lib/drill/plan.ts) and played back in compressed time through the same
 * services real recipients go through: the tracking pixel and link (recordOpen, recordClick), the
 * fake sign-in (recordSubmit), the Report button (submitThreatReport), the training the click assigned
 * (completeLesson, attestModule) and the risk score (recomputeRisk). Nothing is sent: no mail, no SMS.
 *
 * There is no timer: whoever polls the drill (the dashboard, once a second) applies the events that are
 * due. One request at a time does so, under a lease row lock, so two open dashboards never apply the
 * same event twice; each applied event is recorded before the next one starts.
 */
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { campaignAudience } from "./campaigns";
import { recordClick, recordOpen, recordSubmit } from "./campaigns";
import { randomToken, attestModule, completeLesson } from "./progress";
import { recomputeRisk, snapshotTenant } from "./risk";
import { submitThreatReport } from "./threats";
import { audit } from "./audit";
import { emitEvent } from "./events";
import { appUrl } from "../env";
import { TEMPLATE_BY_KEY, templateOnPlan, templateText, type CampaignTemplate } from "../../lib/campaigns/templates";
import { DEFAULT_ATTESTATION, featuresFor, withDefaults } from "../../lib/tenant-defaults";
import { pick } from "../../i18n/config";
import { DRILL_SIM_MINUTES, DRILL_SPEEDS, INDUSTRY_BASELINE_CLICK, drillProgress, msToSim, planDrill, seedFrom, type DrillEvent, type DrillKind, type DrillOutcome, type DrillSpeed, type DrillTotals } from "../../lib/drill/plan";

/**
 * Templates a drill can play: the ones whose recipients open, click and report (email and SMS). The first is
 * the default: a medium lure with a fake sign-in page shows every step of the funnel in a demo.
 */
export const DRILL_TEMPLATE_KEYS = ["mfa-qr", "payslip", "invoice", "bank-details", "keynote", "fine", "bank-sms", "parcel-sms"] as const;

export function drillTemplates(features: ReadonlySet<string>): CampaignTemplate[] {
  return DRILL_TEMPLATE_KEYS.map((k) => TEMPLATE_BY_KEY.get(k)).filter((x): x is CampaignTemplate => !!x && (x.channel === "email" || x.channel === "sms") && templateOnPlan(x, features));
}

/** How long one applying request may hold the drill before another may take over (a crashed request). */
const LEASE_MS = 20_000;

export type StartDrillInput = {
  tenantId: string;
  actorId: string;
  templateKey: string;
  audience: "all" | "department";
  departmentId: string | null;
  speed: DrillSpeed;
  /** The campaign's name, in the language of the person starting it. */
  campaignName: string;
};

export type StartDrillResult = { ok: true; id: string; recipients: number } | { ok: false; reason: "template" | "empty" | "feature" };

/**
 * Creates the campaign (running, its recipients not yet delivered) and the drill that plays it. The
 * person starting the drill is left out of the audience: they are watching it.
 */
export async function startDrill(db: DB, p: StartDrillInput): Promise<StartDrillResult> {
  const [tenant] = await db.select({ plan: t.tenants.plan, features: t.tenants.features }).from(t.tenants).where(eq(t.tenants.id, p.tenantId));
  if (!tenant) return { ok: false, reason: "feature" };
  const features = featuresFor(tenant.plan, tenant.features);
  if (!features.has("live_drill") || !features.has("campaigns")) return { ok: false, reason: "feature" };
  const tpl = drillTemplates(features).find((x) => x.key === p.templateKey);
  if (!tpl) return { ok: false, reason: "template" };
  const everyone = await campaignAudience(db, { tenantId: p.tenantId, audience: p.audience, departmentId: p.audience === "department" ? p.departmentId : null });
  const audience = everyone.filter((u) => u.id !== p.actorId && (tpl.channel !== "sms" || !!u.phone));
  if (!audience.length) return { ok: false, reason: "empty" };

  const now = new Date();
  const durationMs = DRILL_SPEEDS[p.speed];
  const [campaign] = await db
    .insert(t.campaigns)
    .values({
      tenantId: p.tenantId,
      name: p.campaignName.slice(0, 160),
      channel: tpl.channel,
      templateKey: tpl.key,
      audience: p.audience,
      departmentId: p.audience === "department" ? p.departmentId : null,
      status: "running",
      launchedAt: now,
      createdBy: p.actorId,
    })
    .returning({ id: t.campaigns.id });
  const recipients = await db
    .insert(t.campaignRecipients)
    .values(audience.map((u) => ({ campaignId: campaign.id, userId: u.id, token: randomToken(16), sentAt: null })))
    .returning({ id: t.campaignRecipients.id, userId: t.campaignRecipients.userId });
  const scores = await db.select({ id: t.users.id, risk: t.users.riskScore }).from(t.users).where(inArray(t.users.id, audience.map((u) => u.id)));
  const riskOf = new Map(scores.map((s) => [s.id, s.risk]));
  const people = recipients.map((r) => ({ userId: r.userId, recipientId: r.id, risk: riskOf.get(r.userId) ?? 50 }));
  const events = planDrill(people, tpl, { seed: seedFrom(campaign.id), durationMs, simMinutes: DRILL_SIM_MINUTES });
  const avgRisk = Math.round(people.reduce((s, x) => s + x.risk, 0) / people.length);
  const [run] = await db
    .insert(t.drillRuns)
    .values({
      tenantId: p.tenantId,
      campaignId: campaign.id,
      templateKey: tpl.key,
      durationMs,
      simMinutes: DRILL_SIM_MINUTES,
      events,
      baseline: { avgRisk, scores: Object.fromEntries(people.map((x) => [x.userId, x.risk])) },
      riskTrail: [{ sim: 0, risk: avgRisk }],
      startedAt: now,
      createdBy: p.actorId,
    })
    .returning({ id: t.drillRuns.id });
  await audit(db, { tenantId: p.tenantId, actorId: p.actorId, action: "drill.started", targetType: "campaign", targetId: campaign.id, meta: { template: tpl.key, recipients: recipients.length, speed: p.speed } });
  return { ok: true, id: run.id, recipients: recipients.length };
}

type Run = typeof t.drillRuns.$inferSelect;

type ApplyContext = {
  run: Run;
  tpl: CampaignTemplate;
  recipients: Map<string, { token: string; userId: string; locale: string }>;
  module: { id: string; lessonIds: string[] } | null;
  attestation: Record<string, string>;
};

async function applyContext(db: DB, run: Run): Promise<ApplyContext | null> {
  const tpl = TEMPLATE_BY_KEY.get(run.templateKey);
  if (!tpl) return null;
  const rows = await db
    .select({ id: t.campaignRecipients.id, token: t.campaignRecipients.token, userId: t.campaignRecipients.userId, locale: t.users.locale })
    .from(t.campaignRecipients)
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .where(eq(t.campaignRecipients.campaignId, run.campaignId));
  const [mod] = await db.select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.slug, tpl.moduleSlug), isNull(t.modules.tenantId)));
  const lessons = mod ? await db.select({ id: t.lessons.id }).from(t.lessons).where(eq(t.lessons.moduleId, mod.id)).orderBy(asc(t.lessons.position)) : [];
  const [tenant] = await db.select({ settings: t.tenants.settings }).from(t.tenants).where(eq(t.tenants.id, run.tenantId));
  return {
    run,
    tpl,
    recipients: new Map(rows.map((r) => [r.id, { token: r.token, userId: r.userId, locale: r.locale }])),
    module: mod && lessons.length ? { id: mod.id, lessonIds: lessons.map((l) => l.id) } : null,
    attestation: tenant ? withDefaults(tenant.settings).attestationText : {},
  };
}

/** Applies one planned event through the service a real recipient's action goes through. */
async function applyEvent(db: DB, ctx: ApplyContext, e: DrillEvent) {
  const r = ctx.recipients.get(e.recipientId);
  if (!r) return;
  const tenantId = ctx.run.tenantId;
  switch (e.kind) {
    case "deliver":
      await db.update(t.campaignRecipients).set({ sentAt: new Date() }).where(and(eq(t.campaignRecipients.id, e.recipientId), isNull(t.campaignRecipients.sentAt)));
      return;
    case "open":
      await recordOpen(db, r.token);
      return;
    case "click":
      // The teachable moment: the click opens a risk tied to the template's module (14 days to train).
      await recordClick(db, r.token, "link");
      return;
    case "submit":
      await recordSubmit(db, r.token);
      return;
    case "report": {
      // Applied at most once per person, also when a request died after the report and before its bookkeeping.
      const [already] = await db.select({ at: t.campaignRecipients.reportedAt }).from(t.campaignRecipients).where(eq(t.campaignRecipients.id, e.recipientId));
      if (already?.at) return;
      // The Report button: matched to this simulation by its tracking link, triaged without an analyst.
      await submitThreatReport(db, {
        tenantId,
        userId: r.userId,
        channel: ctx.tpl.channel === "sms" ? "sms" : "email",
        subject: templateText(ctx.tpl.subject, r.locale),
        url: `${appUrl()}/t/${r.token}`,
      });
      await recomputeRisk(db, tenantId, [r.userId]);
      return;
    }
    case "train": {
      if (!ctx.module) return;
      for (const lessonId of ctx.module.lessonIds) await completeLesson(db, { tenantId, userId: r.userId, lessonId, secondsSpent: 150 });
      const text = ctx.attestation[r.locale] ?? pick(DEFAULT_ATTESTATION, r.locale);
      const attested = await attestModule(db, { tenantId, userId: r.userId, moduleId: ctx.module.id, text, locale: r.locale });
      if (attested) await emitEvent(db, tenantId, "attestation.completed", { module: ctx.tpl.moduleSlug, userId: r.userId });
      await recomputeRisk(db, tenantId, [r.userId]);
      return;
    }
  }
}

/** Number of events due `elapsedMs` after the start (events are sorted by time). */
export function dueCount(events: DrillEvent[], elapsedMs: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].at <= elapsedMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Applies whatever is due and finishes the drill once its time is up and every event is applied.
 * Safe to call from any number of requests at once. Returns the run as it is afterwards.
 */
export async function advanceDrill(db: DB, tenantId: string, drillId: string, now = new Date()): Promise<Run | null> {
  const [run] = await db.select().from(t.drillRuns).where(and(eq(t.drillRuns.id, drillId), eq(t.drillRuns.tenantId, tenantId)));
  if (!run || run.finishedAt) return run ?? null;
  // Cancelling the drill's campaign (campaign page) ends the drill where it is: no further step is played.
  const [campaign] = await db.select({ status: t.campaigns.status }).from(t.campaigns).where(eq(t.campaigns.id, run.campaignId));
  if (!campaign || campaign.status === "cancelled") {
    await db.update(t.drillRuns).set({ finishedAt: now, leaseUntil: null }).where(and(eq(t.drillRuns.id, run.id), isNull(t.drillRuns.finishedAt)));
    const [stopped] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, run.id));
    return stopped ?? null;
  }
  const elapsed = now.getTime() - run.startedAt.getTime();
  const due = dueCount(run.events, elapsed);
  let applied = run.appliedUntil;
  if (due > applied) {
    const [claimed] = await db
      .update(t.drillRuns)
      .set({ leaseUntil: new Date(now.getTime() + LEASE_MS) })
      .where(and(eq(t.drillRuns.id, run.id), eq(t.drillRuns.appliedUntil, applied), or(isNull(t.drillRuns.leaseUntil), lt(t.drillRuns.leaseUntil, now))))
      .returning({ id: t.drillRuns.id });
    if (claimed) {
      const ctx = await applyContext(db, run);
      // Whether this request still holds the drill: each step is recorded with a compare-and-set, and a request
      // that stalled past its lease (another one took over) stops instead of applying the same steps again.
      let held = true;
      // Points for the risk curve: one after every step that can move a score, when the average actually moved.
      const points: { sim: number; risk: number }[] = [];
      let lastRisk = run.riskTrail.at(-1)?.risk ?? run.baseline.avgRisk;
      try {
        while (applied < due) {
          const e = run.events[applied];
          try {
            if (ctx) await applyEvent(db, ctx, e);
          } catch (error) {
            // One failed step (a deleted person, a removed module) must not stop the rest of the drill.
            console.error(`[drill] ${run.id}: ${e.kind} for ${e.recipientId} failed`, error);
          }
          const [kept] = await db
            .update(t.drillRuns)
            .set({ appliedUntil: applied + 1, leaseUntil: new Date(Date.now() + LEASE_MS) })
            .where(and(eq(t.drillRuns.id, run.id), eq(t.drillRuns.appliedUntil, applied)))
            .returning({ id: t.drillRuns.id });
          if (!kept) {
            held = false;
            break;
          }
          applied++;
          if (e.kind !== "deliver" && e.kind !== "open") {
            const risk = await audienceRisk(db, run);
            if (risk !== lastRisk) points.push({ sim: e.sim, risk });
            lastRisk = risk;
          }
        }
        // Clicks and passwords push the curve up, reports and finished trainings pull it down. Written per batch, so
        // "Skip to the end" (one batch) keeps the curve's shape.
        if (held && points.length) {
          await db
            .update(t.drillRuns)
            .set({ riskTrail: sql`${t.drillRuns.riskTrail} || ${JSON.stringify(points)}::jsonb` })
            .where(eq(t.drillRuns.id, run.id));
        }
      } finally {
        // Released only by its holder: the row still shows this request's last step.
        if (held) await db.update(t.drillRuns).set({ leaseUntil: null }).where(and(eq(t.drillRuns.id, run.id), eq(t.drillRuns.appliedUntil, applied)));
      }
    }
  }
  if (applied >= run.events.length && elapsed >= run.durationMs) await finishDrill(db, run);
  const [after] = await db.select().from(t.drillRuns).where(eq(t.drillRuns.id, run.id));
  return after ?? null;
}

async function finishDrill(db: DB, run: Run) {
  const [done] = await db
    .update(t.drillRuns)
    .set({ finishedAt: new Date() })
    .where(and(eq(t.drillRuns.id, run.id), isNull(t.drillRuns.finishedAt), eq(t.drillRuns.appliedUntil, run.events.length)))
    .returning({ id: t.drillRuns.id });
  if (!done) return;
  await db.update(t.campaigns).set({ status: "completed", completedAt: new Date() }).where(and(eq(t.campaigns.id, run.campaignId), eq(t.campaigns.status, "running")));
  // Today's organisation KPIs (overview and leadership charts) include the drill at once.
  await snapshotTenant(db, run.tenantId);
  const progress = drillProgress(run.events, run.events.length, [...new Set(run.events.map((e) => e.recipientId))]);
  const now = await audienceRisk(db, run);
  // The trail grew during this request; the row read at its start does not have the last points.
  const [fresh] = await db.select({ trail: t.drillRuns.riskTrail }).from(t.drillRuns).where(eq(t.drillRuns.id, run.id));
  const trail = fresh?.trail ?? run.riskTrail;
  await audit(db, {
    tenantId: run.tenantId,
    actorId: run.createdBy,
    action: "drill.finished",
    targetType: "campaign",
    targetId: run.campaignId,
    meta: { clicked: progress.totals.clicked, reported: progress.totals.reported, trained: progress.totals.trained, riskBefore: run.baseline.avgRisk, riskPeak: Math.max(run.baseline.avgRisk, now, ...trail.map((p) => p.risk)), riskAfter: now },
  });
}

/** Jumps to the end: every remaining event is applied now and the drill finishes. */
export async function skipDrill(db: DB, tenantId: string, drillId: string): Promise<Run | null> {
  const [run] = await db.select().from(t.drillRuns).where(and(eq(t.drillRuns.id, drillId), eq(t.drillRuns.tenantId, tenantId)));
  if (!run || run.finishedAt) return run ?? null;
  const startedAt = new Date(Date.now() - run.durationMs - 1);
  await db.update(t.drillRuns).set({ startedAt }).where(and(eq(t.drillRuns.id, run.id), isNull(t.drillRuns.finishedAt)));
  return advanceDrill(db, tenantId, drillId);
}

async function audienceRisk(db: DB, run: Run): Promise<number> {
  const ids = Object.keys(run.baseline.scores);
  if (!ids.length) return run.baseline.avgRisk;
  const [row] = await db.select({ avg: sql<number>`round(avg(${t.users.riskScore}))` }).from(t.users).where(inArray(t.users.id, ids));
  return Number(row?.avg ?? run.baseline.avgRisk);
}

/* ───────── read model for the dashboard ───────── */

export type DrillFeedItem = { n: number; kind: Exclude<DrillKind, "deliver" | "open">; sim: number; name: string; department: string | null };

export type DrillView = {
  id: string;
  campaignId: string;
  status: "running" | "finished";
  /** The campaign was cancelled during the drill, which ended it early. */
  cancelled: boolean;
  /** Milliseconds since the start, measured on the server (the client keeps counting from it). */
  elapsedMs: number;
  durationMs: number;
  simMinutes: number;
  simNow: number;
  template: { key: string; name: string; channel: "email" | "sms"; difficulty: CampaignTemplate["difficulty"]; harvest: boolean; senderName: string; senderAddress: string; subject: string; moduleTitle: string | null; moduleSlug: string };
  totals: DrillTotals;
  firstClick: number | null;
  firstReport: number | null;
  /** Average risk of the audience: before, highest so far, now, and the curve (simulated minute, score). */
  risk: { before: number; peak: number; now: number; trail: { sim: number; risk: number }[] };
  benchmark: number;
  /** No per-person risk score here: a campaign manager may start drills without being allowed to read people's scores. */
  people: { id: string; name: string; initials: string; department: string | null; outcome: DrillOutcome; reported: boolean; trained: boolean }[];
  feed: DrillFeedItem[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export async function drillView(db: DB, run: Run, locale: string, now = new Date()): Promise<DrillView | null> {
  const tpl = TEMPLATE_BY_KEY.get(run.templateKey);
  if (!tpl || (tpl.channel !== "email" && tpl.channel !== "sms")) return null;
  const rows = await db
    .select({ id: t.campaignRecipients.id, userId: t.users.id, name: t.users.name, risk: t.users.riskScore, department: t.departments.name })
    .from(t.campaignRecipients)
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
    .where(eq(t.campaignRecipients.campaignId, run.campaignId))
    .orderBy(asc(t.departments.name), asc(t.users.name));
  const [mod] = await db.select({ title: t.modules.title }).from(t.modules).where(and(eq(t.modules.slug, tpl.moduleSlug), isNull(t.modules.tenantId)));
  const [campaign] = await db.select({ status: t.campaigns.status }).from(t.campaigns).where(eq(t.campaigns.id, run.campaignId));
  const progress = drillProgress(run.events, run.appliedUntil, rows.map((r) => r.id));
  const byRecipient = new Map(rows.map((r) => [r.id, r]));
  const until = run.finishedAt ?? now;
  const elapsedMs = Math.max(0, Math.min(run.durationMs, until.getTime() - run.startedAt.getTime()));
  const feed: DrillFeedItem[] = [];
  for (let i = run.appliedUntil - 1; i >= 0 && feed.length < 9; i--) {
    const e = run.events[i];
    if (e.kind === "deliver" || e.kind === "open") continue;
    const who = byRecipient.get(e.recipientId);
    if (who) feed.push({ n: i, kind: e.kind, sim: e.sim, name: who.name, department: who.department });
  }
  const avgNow = rows.length ? Math.round(rows.reduce((s, r) => s + r.risk, 0) / rows.length) : run.baseline.avgRisk;
  return {
    id: run.id,
    campaignId: run.campaignId,
    status: run.finishedAt ? "finished" : "running",
    cancelled: campaign?.status === "cancelled",
    elapsedMs,
    durationMs: run.durationMs,
    simMinutes: run.simMinutes,
    simNow: msToSim(elapsedMs, run.durationMs, run.simMinutes),
    template: {
      key: tpl.key,
      name: templateText(tpl.name, locale),
      channel: tpl.channel,
      difficulty: tpl.difficulty,
      harvest: tpl.harvest,
      senderName: templateText(tpl.sender.name, locale),
      senderAddress: tpl.sender.address,
      subject: templateText(tpl.subject, locale),
      moduleTitle: mod ? pick(mod.title, locale) : null,
      moduleSlug: tpl.moduleSlug,
    },
    totals: progress.totals,
    firstClick: progress.firstClick,
    firstReport: progress.firstReport,
    risk: { before: run.baseline.avgRisk, peak: Math.max(run.baseline.avgRisk, avgNow, ...run.riskTrail.map((p) => p.risk)), now: avgNow, trail: run.riskTrail },
    benchmark: INDUSTRY_BASELINE_CLICK,
    people: rows.map((r) => {
      const s = progress.people.get(r.id) ?? { outcome: "pending" as const, reported: false, trained: false };
      return { id: r.id, name: r.name, initials: initials(r.name), department: r.department, ...s };
    }),
    feed,
  };
}

export async function drillById(db: DB, tenantId: string, id: string): Promise<Run | null> {
  const [run] = await db.select().from(t.drillRuns).where(and(eq(t.drillRuns.id, id), eq(t.drillRuns.tenantId, tenantId)));
  return run ?? null;
}

/** The organisation's recent drills, newest first, with their outcome so far. */
export async function drillHistory(db: DB, tenantId: string, locale: string, limit = 8) {
  const rows = await db
    .select({ run: t.drillRuns, status: t.campaigns.status })
    .from(t.drillRuns)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.drillRuns.campaignId))
    .where(eq(t.drillRuns.tenantId, tenantId))
    .orderBy(desc(t.drillRuns.createdAt))
    .limit(limit);
  return rows.map(({ run, status }) => {
    const tpl = TEMPLATE_BY_KEY.get(run.templateKey);
    const ids = [...new Set(run.events.map((e) => e.recipientId))];
    const audience = Object.keys(run.baseline.scores).length;
    const { totals } = drillProgress(run.events, run.appliedUntil, ids);
    // createdAt, not startedAt: "Skip to the end" moves startedAt back so every step falls due.
    return { id: run.id, campaignId: run.campaignId, name: tpl ? templateText(tpl.name, locale) : run.templateKey, startedAt: run.createdAt, finished: !!run.finishedAt, cancelled: status === "cancelled", audience, totals };
  });
}
