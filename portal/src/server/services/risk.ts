/**
 * Recomputes human risk scores from evidence (training, simulations, open risks, answers)
 * and records the daily organisation snapshot used by the trend charts.
 */
import { and, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { resolveAssignments } from "./assignments";
import { riskScore, type RiskBreakdown, type Severity } from "../../lib/domain/risk";
import { dayKey } from "../../lib/domain/gamification";
import { tenantTimeZone } from "./tenants";

const DAY = 86_400_000;

export type RiskEvidence = Map<string, RiskBreakdown>;

export async function computeTenantRisk(db: DB, tenantId: string, now = new Date(), onlyUserIds?: string[]): Promise<RiskEvidence> {
  const since90 = new Date(now.getTime() - 90 * DAY);
  const since180 = new Date(now.getTime() - 180 * DAY);
  const today = dayKey(now, await tenantTimeZone(db, tenantId));
  const users = await db
    .select({ id: t.users.id })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), ne(t.users.status, "deleted"), onlyUserIds?.length ? inArray(t.users.id, onlyUserIds) : undefined));
  const ids = users.map((u) => u.id);
  if (!ids.length) return new Map();

  const assigned = await resolveAssignments(db, tenantId, onlyUserIds);
  const moduleIds = [...new Set([...assigned.values()].flatMap((m) => [...m.keys()]))];
  const lessonRows = moduleIds.length
    ? await db.select({ id: t.lessons.id, moduleId: t.lessons.moduleId }).from(t.lessons).where(inArray(t.lessons.moduleId, moduleIds))
    : [];
  const lessonsByModule = new Map<string, string[]>();
  for (const l of lessonRows) lessonsByModule.set(l.moduleId, [...(lessonsByModule.get(l.moduleId) ?? []), l.id]);

  const [done, modDone, sims, lessonRisky, open, answers] = await Promise.all([
    db
      .select({ userId: t.lessonProgress.userId, lessonId: t.lessonProgress.lessonId })
      .from(t.lessonProgress)
      .where(and(inArray(t.lessonProgress.userId, ids), isNotNull(t.lessonProgress.completedAt))),
    db
      .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
      .from(t.moduleProgress)
      .where(and(inArray(t.moduleProgress.userId, ids), eq(t.moduleProgress.status, "completed"))),
    db
      .select({
        userId: t.campaignRecipients.userId,
        clicks: sql<number>`count(${t.campaignRecipients.clickedAt})`,
        submits: sql<number>`count(${t.campaignRecipients.submittedAt})`,
        reports: sql<number>`count(${t.campaignRecipients.reportedAt})`,
      })
      .from(t.campaignRecipients)
      .where(and(inArray(t.campaignRecipients.userId, ids), gte(t.campaignRecipients.sentAt, since90)))
      .groupBy(t.campaignRecipients.userId),
    db
      .select({ userId: t.answers.userId, n: sql<number>`count(*)` })
      .from(t.answers)
      .where(and(inArray(t.answers.userId, ids), gte(t.answers.at, since90), inArray(t.answers.outcome, ["risky", "compromised"])))
      .groupBy(t.answers.userId),
    db
      .select({ userId: t.behaviorRisks.userId, severity: t.behaviorRisks.severity })
      .from(t.behaviorRisks)
      .where(and(inArray(t.behaviorRisks.userId, ids), eq(t.behaviorRisks.status, "open"))),
    db
      .select({
        userId: t.answers.userId,
        total: sql<number>`count(*)`,
        good: sql<number>`count(*) filter (where ${t.answers.correct} and ${t.answers.firstTry})`,
      })
      .from(t.answers)
      .where(and(inArray(t.answers.userId, ids), gte(t.answers.at, since180), eq(t.answers.firstTry, true)))
      .groupBy(t.answers.userId),
  ]);

  const doneByUser = new Map<string, Set<string>>();
  for (const d of done) doneByUser.set(d.userId, (doneByUser.get(d.userId) ?? new Set()).add(d.lessonId));
  const modDoneByUser = new Map<string, Set<string>>();
  for (const d of modDone) modDoneByUser.set(d.userId, (modDoneByUser.get(d.userId) ?? new Set()).add(d.moduleId));
  const simByUser = new Map(sims.map((s) => [s.userId, s]));
  const riskyByUser = new Map(lessonRisky.map((s) => [s.userId, Number(s.n)]));
  const openByUser = new Map<string, Severity[]>();
  for (const o of open) openByUser.set(o.userId, [...(openByUser.get(o.userId) ?? []), o.severity]);
  const answersByUser = new Map(answers.map((a) => [a.userId, a]));

  const out: RiskEvidence = new Map();
  for (const id of ids) {
    const mods = assigned.get(id) ?? new Map();
    let total = 0;
    let completed = 0;
    let overdue = 0;
    const userDone = doneByUser.get(id) ?? new Set<string>();
    const userModDone = modDoneByUser.get(id) ?? new Set<string>();
    for (const m of mods.values()) {
      const lessons = lessonsByModule.get(m.moduleId) ?? [];
      total += lessons.length;
      completed += lessons.filter((l) => userDone.has(l)).length;
      if (m.due && m.due < today && !userModDone.has(m.moduleId)) overdue++;
    }
    const sim = simByUser.get(id);
    const ans = answersByUser.get(id);
    out.set(
      id,
      riskScore({
        assignedCompletion: total ? completed / total : null,
        overdueAssignments: overdue,
        simClicks: Number(sim?.clicks ?? 0),
        simSubmits: Number(sim?.submits ?? 0),
        simReports: Number(sim?.reports ?? 0),
        lessonRiskyChoices: riskyByUser.get(id) ?? 0,
        openRisks: openByUser.get(id) ?? [],
        firstTryRate: ans && Number(ans.total) >= 5 ? Number(ans.good) / Number(ans.total) : null,
      }),
    );
  }
  return out;
}

/** Persists fresh scores. Call after any event that can move a score. */
export async function recomputeRisk(db: DB, tenantId: string, userIds?: string[], now = new Date()): Promise<RiskEvidence> {
  const evidence = await computeTenantRisk(db, tenantId, now, userIds);
  for (const [userId, b] of evidence) {
    await db.update(t.users).set({ riskScore: b.score }).where(eq(t.users.id, userId));
  }
  return evidence;
}

/** Organisation KPIs for one day (average risk, assigned completion, report and click rate). */
export async function tenantKpis(db: DB, tenantId: string, now = new Date()) {
  const users = await db
    .select({ id: t.users.id, risk: t.users.riskScore })
    .from(t.users)
    .where(and(eq(t.users.tenantId, tenantId), eq(t.users.status, "active"), inArray(t.users.role, ["learner", "department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin"])));
  const avgRisk = users.length ? Math.round(users.reduce((s, u) => s + u.risk, 0) / users.length) : 0;

  const assigned = await resolveAssignments(db, tenantId);
  const moduleIds = [...new Set([...assigned.values()].flatMap((m) => [...m.keys()]))];
  const lessonRows = moduleIds.length ? await db.select({ id: t.lessons.id, moduleId: t.lessons.moduleId }).from(t.lessons).where(inArray(t.lessons.moduleId, moduleIds)) : [];
  const lessonsByModule = new Map<string, string[]>();
  for (const l of lessonRows) lessonsByModule.set(l.moduleId, [...(lessonsByModule.get(l.moduleId) ?? []), l.id]);
  const done = users.length
    ? await db
        .select({ userId: t.lessonProgress.userId, lessonId: t.lessonProgress.lessonId })
        .from(t.lessonProgress)
        .where(and(inArray(t.lessonProgress.userId, users.map((u) => u.id)), isNotNull(t.lessonProgress.completedAt)))
    : [];
  const doneSet = new Set(done.map((d) => `${d.userId}:${d.lessonId}`));
  let total = 0;
  let completed = 0;
  for (const u of users) {
    for (const m of (assigned.get(u.id) ?? new Map()).values()) {
      for (const l of lessonsByModule.get(m.moduleId) ?? []) {
        total++;
        if (doneSet.has(`${u.id}:${l}`)) completed++;
      }
    }
  }
  const since = new Date(now.getTime() - 90 * DAY);
  const [sim] = await db
    .select({
      sent: sql<number>`count(*)`,
      clicked: sql<number>`count(${t.campaignRecipients.clickedAt})`,
      reported: sql<number>`count(${t.campaignRecipients.reportedAt})`,
    })
    .from(t.campaignRecipients)
    .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
    .where(and(eq(t.campaigns.tenantId, tenantId), gte(t.campaignRecipients.sentAt, since)));
  const sent = Number(sim?.sent ?? 0);
  return {
    learners: users.length,
    avgRisk,
    completion: total ? Math.round((completed / total) * 100) : 0,
    reportRate: sent ? Math.round((Number(sim.reported) / sent) * 100) : 0,
    clickRate: sent ? Math.round((Number(sim.clicked) / sent) * 100) : 0,
  };
}

export async function snapshotTenant(db: DB, tenantId: string, now = new Date()) {
  const k = await tenantKpis(db, tenantId, now);
  const day = dayKey(now, await tenantTimeZone(db, tenantId));
  await db
    .insert(t.riskSnapshots)
    .values({ tenantId, day, avgRisk: k.avgRisk, completion: k.completion, reportRate: k.reportRate, clickRate: k.clickRate })
    .onConflictDoUpdate({
      target: [t.riskSnapshots.tenantId, t.riskSnapshots.day],
      set: { avgRisk: k.avgRisk, completion: k.completion, reportRate: k.reportRate, clickRate: k.clickRate },
    });
  return k;
}
