import "server-only";
import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { departmentClosure } from "../services/assignments";
import { activeInScope, getDepartments, listPeople, narrowToDepartment, scopeDepartmentIds } from "./admin";
import { dirOf, pick } from "../../i18n/config";
import { dayPlus, requestNow, todayIn, zonedTime } from "../../lib/time";

/** Days of risk snapshots the story needs before its trend means anything; below that it is an empty state. */
export const STORY_MIN_DAYS = 7;
/** The trend, the campaign and the training are read over the last three weeks. */
const WINDOW_DAYS = 21;
/** A department smaller than this is not called the most exposed: one person's score is not a department's. */
const MIN_MEMBERS = 3;
const DAY = 86_400_000;

export type RiskStory =
  | { empty: true; days: number }
  | {
      empty: false;
      /** Average risk of today's people in scope on the first snapshot day of the window and now. */
      trend: { since: Date; from: number; to: number };
      weakest: { id: string; name: string; risk: number; category: string | null; inCategory: number; module: { id: string; title: string } | null } | null;
      /** The campaign in the window whose click rate differs most from the campaign launched before it. */
      campaign: { name: string; from: number; to: number } | null;
      /** The module most people completed in the window. */
      training: { title: string; people: number } | null;
      certified: { people: number; total: number; share: number };
    };

/**
 * The leadership risk story from the organisation's own data: the most exposed department and its weakest
 * module category (open behaviour risks), the risk trend, the campaign and the training that moved most,
 * this quarter's server-verified certificates, and the module to assign next. People are the viewer's scope,
 * narrowed to `departmentId` (with its sub-departments) when given; one outside the scope matches nobody.
 */
export async function riskStory(v: Viewer, locale: string, departmentId?: string): Promise<RiskStory> {
  const tid = v.tenant.id;
  const tz = v.tenant.settings.timeZone;
  const now = requestNow();
  const closure = departmentClosure(await getDepartments(tid));
  let dept = await scopeDepartmentIds(v);
  if (departmentId) dept = narrowToDepartment(dept, closure, departmentId);
  const people = (await listPeople(v, { departmentIds: dept })).filter((p) => p.status === "active");
  if (!people.length) return { empty: true, days: 0 };
  const inScope = activeInScope(tid, dept);

  const days = await db()
    .select({ day: t.userRiskSnapshots.day })
    .from(t.userRiskSnapshots)
    .where(and(eq(t.userRiskSnapshots.tenantId, tid), gte(t.userRiskSnapshots.day, dayPlus(-WINDOW_DAYS, tz, now)), inArray(t.userRiskSnapshots.userId, inScope)))
    .groupBy(t.userRiskSnapshots.day)
    .orderBy(asc(t.userRiskSnapshots.day));
  if (days.length < STORY_MIN_DAYS) return { empty: true, days: days.length };
  const since = zonedTime(days[0].day, "00:00:00", tz);

  // Most exposed department: the highest average current risk score among departments big enough to count.
  const members = new Map<string, typeof people>();
  // Appended in place: copying the list per person is quadratic in a department of tens of thousands.
  for (const p of people) {
    if (!p.departmentId) continue;
    const list = members.get(p.departmentId);
    if (list) list.push(p);
    else members.set(p.departmentId, [p]);
  }
  const avgOf = (ps: typeof people) => Math.round(ps.reduce((s, p) => s + p.riskScore, 0) / ps.length);
  const top = [...members.entries()]
    .filter(([, ps]) => ps.length >= MIN_MEMBERS && avgOf(ps) > 0)
    .map(([id, ps]) => ({ id, name: ps[0].departmentName ?? "", risk: avgOf(ps) }))
    .sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name, locale))[0];

  const today = todayIn(tz, now);
  const month = Number(today.slice(5, 7));
  const quarterStart = zonedTime(`${today.slice(0, 4)}-${String(month - ((month - 1) % 3)).padStart(2, "0")}-01`, "00:00:00", tz);

  const [first, risks, assigned, campaigns, completions, [certified]] = await Promise.all([
    db()
      .select({ userId: t.userRiskSnapshots.userId, score: t.userRiskSnapshots.score })
      .from(t.userRiskSnapshots)
      .where(and(eq(t.userRiskSnapshots.tenantId, tid), eq(t.userRiskSnapshots.day, days[0].day), inArray(t.userRiskSnapshots.userId, inScope))),
    top
      ? db()
          .select({ moduleId: t.behaviorRisks.moduleId, category: t.modules.category, title: t.modules.title, status: t.modules.status, n: count() })
          .from(t.behaviorRisks)
          .innerJoin(t.modules, eq(t.modules.id, t.behaviorRisks.moduleId))
          .where(and(eq(t.behaviorRisks.tenantId, tid), eq(t.behaviorRisks.status, "open"), inArray(t.behaviorRisks.userId, activeInScope(tid, new Set([top.id])))))
          .groupBy(t.behaviorRisks.moduleId, t.modules.category, t.modules.title, t.modules.status)
      : Promise.resolve([]),
    // Module assignments that already reach the whole organisation or a department; the next step skips them.
    top
      ? db()
          .select({ moduleId: t.assignments.moduleId, scope: t.assignments.scope, departmentId: t.assignments.departmentId })
          .from(t.assignments)
          .where(and(eq(t.assignments.tenantId, tid), isNotNull(t.assignments.moduleId), inArray(t.assignments.scope, ["everyone", "department"])))
      : Promise.resolve([]),
    db()
      .select({ name: t.campaigns.name, launchedAt: t.campaigns.launchedAt, sent: count(t.campaignRecipients.sentAt), clicked: count(t.campaignRecipients.clickedAt) })
      .from(t.campaignRecipients)
      .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
      .where(and(eq(t.campaigns.tenantId, tid), isNotNull(t.campaigns.launchedAt), gte(t.campaigns.launchedAt, new Date(now.getTime() - 90 * DAY)), inArray(t.campaignRecipients.userId, inScope)))
      .groupBy(t.campaigns.id, t.campaigns.name, t.campaigns.launchedAt)
      .orderBy(asc(t.campaigns.launchedAt)),
    db()
      .select({ title: t.modules.title, n: count() })
      .from(t.moduleProgress)
      .innerJoin(t.modules, eq(t.modules.id, t.moduleProgress.moduleId))
      .where(and(inArray(t.moduleProgress.userId, inScope), eq(t.moduleProgress.status, "completed"), gte(t.moduleProgress.completedAt, since)))
      .groupBy(t.modules.id, t.modules.title)
      .orderBy(desc(count()))
      .limit(1),
    db()
      .select({ n: countDistinct(t.certificates.userId) })
      .from(t.certificates)
      .where(and(eq(t.certificates.tenantId, tid), eq(t.certificates.evidence, "server_verified"), gte(t.certificates.issuedAt, quarterStart), inArray(t.certificates.userId, inScope))),
  ]);

  // The weakest category is the one with the most open risks; its published module with the most open risks is the one
  // to assign, unless an assignment already reaches that department (to everyone, to it or to a parent department).
  const covered = new Set(assigned.filter((a) => a.scope === "everyone" || (a.departmentId && closure.get(a.departmentId)?.has(top!.id))).map((a) => a.moduleId));
  const byCategory = new Map<string, number>();
  for (const r of risks) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.n));
  const category = [...byCategory.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const toAssign = category ? risks.filter((r) => r.category === category[0] && r.status === "published" && !covered.has(r.moduleId)).sort((a, b) => Number(b.n) - Number(a.n))[0] : undefined;

  let campaign: { name: string; from: number; to: number; change: number } | null = null;
  const rate = (c: { sent: number; clicked: number }) => Math.round((Number(c.clicked) / Number(c.sent)) * 100);
  const sent = campaigns.filter((c) => Number(c.sent) > 0);
  for (let i = 1; i < sent.length; i++) {
    if (sent[i].launchedAt! < since) continue;
    const change = rate(sent[i]) - rate(sent[i - 1]);
    if (change !== 0 && (!campaign || Math.abs(change) > Math.abs(campaign.change))) campaign = { name: sent[i].name, from: rate(sent[i - 1]), to: rate(sent[i]), change };
  }

  // Both ends of the trend average the same people: someone without a first-day snapshot (a new hire) counts with
  // today's score, so a change in headcount does not move the trend.
  const firstScore = new Map(first.map((r) => [r.userId, Number(r.score)]));
  const from = Math.round(people.reduce((s, p) => s + (firstScore.get(p.id) ?? p.riskScore), 0) / people.length);

  const certifiedPeople = Number(certified?.n ?? 0);
  return {
    empty: false,
    // Today's scores, not today's snapshot: the same number as the average risk of the page's other cards (overviewData).
    trend: { since, from, to: avgOf(people) },
    weakest: top
      ? {
          id: top.id,
          name: top.name,
          risk: top.risk,
          category: category?.[0] ?? null,
          inCategory: category?.[1] ?? 0,
          module: toAssign?.moduleId ? { id: toAssign.moduleId, title: pick(toAssign.title, locale) } : null,
        }
      : null,
    campaign: campaign && { name: campaign.name, from: campaign.from, to: campaign.to },
    training: completions[0] ? { title: pick(completions[0].title, locale), people: Number(completions[0].n) } : null,
    certified: { people: certifiedPeople, total: people.length, share: Math.round((certifiedPeople / people.length) * 100) },
  };
}

/**
 * The story as sentences in `locale`, one ICU message each (the leadership page and the compliance pack).
 * Dates are formatted by the translator in the organisation's time zone of the request.
 */
export async function storySentences(s: RiskStory, locale: string): Promise<string[]> {
  const [tr, tc] = await Promise.all([getTranslations({ locale, namespace: "admin.riskStory" }), getTranslations({ locale, namespace: "common" })]);
  if (s.empty) return [tr("empty", { days: s.days, needed: STORY_MIN_DAYS })];
  const { trend, weakest, campaign, training, certified } = s;
  const delta = trend.to - trend.from;
  // Names the organisation typed (often Latin) keep their own direction inside a right-to-left sentence.
  const name = (x: string) => (dirOf(locale) === "rtl" ? `⁨${x}⁩` : x);
  return [
    weakest
      ? weakest.category
        ? tr("weakestCategory", { department: name(weakest.name), risk: weakest.risk, inCategory: weakest.inCategory, category: tc(`categories.${weakest.category as "email"}`) })
        : tr("weakest", { department: name(weakest.name), risk: weakest.risk })
      : null,
    tr("trend", { since: trend.since, direction: delta < 0 ? "down" : delta > 0 ? "up" : "flat", abs: Math.abs(delta), to: trend.to }),
    campaign ? tr("campaign", { campaign: name(campaign.name), from: campaign.from, to: campaign.to }) : null,
    training ? tr("training", { module: name(training.title), people: training.people, since: trend.since }) : null,
    tr("certified", { certified: certified.people, total: certified.total, share: certified.share }),
    weakest?.module ? tr("next", { module: name(weakest.module.title), department: name(weakest.name) }) : null,
  ].filter((x): x is string => x !== null);
}
