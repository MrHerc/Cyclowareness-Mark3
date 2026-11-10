import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { dayKey } from "../../lib/domain/gamification";
import { dayPlus } from "../../lib/time";
import { TEACHABLE_DAYS } from "../../lib/tenant-defaults";
import { departmentLeague } from "../services/league";
import { computeTenantRisk } from "../services/risk";

export type PolicyToSign = { policyId: string; versionId: string; title: string; version: number; publishedAt: Date | null };

/** Latest published version of every active policy and whether this person signed it. */
export const getPolicies = cache(async (v: Viewer, locale: string) => {
  const rows = await db()
    .select({
      policyId: t.policies.id,
      versionId: t.policyVersions.id,
      title: t.policyVersions.title,
      translations: t.policyVersions.translations,
      version: t.policyVersions.version,
      publishedAt: t.policyVersions.publishedAt,
    })
    .from(t.policies)
    .innerJoin(t.policyVersions, eq(t.policyVersions.policyId, t.policies.id))
    .where(and(eq(t.policies.tenantId, v.tenant.id), isNull(t.policies.archivedAt), sql`${t.policyVersions.publishedAt} is not null`))
    .orderBy(desc(t.policyVersions.version));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.policyId)) latest.set(r.policyId, r);
  const versionIds = [...latest.values()].map((r) => r.versionId);
  const signed = versionIds.length
    ? await db()
        .select({ versionId: t.policySignoffs.versionId, signedAt: t.policySignoffs.signedAt })
        .from(t.policySignoffs)
        .where(and(eq(t.policySignoffs.userId, v.user.id), inArray(t.policySignoffs.versionId, versionIds)))
    : [];
  const signedMap = new Map(signed.map((s) => [s.versionId, s.signedAt]));
  return [...latest.values()].map((r) => ({
    policyId: r.policyId,
    versionId: r.versionId,
    title: r.translations?.[locale]?.title ?? r.title,
    version: r.version,
    publishedAt: r.publishedAt,
    signedAt: signedMap.get(r.versionId) ?? null,
  }));
});

export async function todayXp(v: Viewer): Promise<number> {
  const tz = v.tenant.settings.timeZone;
  const today = dayKey(new Date(), tz);
  const [row] = await db()
    .select({ n: sql<number>`coalesce(sum(${t.xpEvents.amount}), 0)` })
    .from(t.xpEvents)
    .where(and(eq(t.xpEvents.userId, v.user.id), gte(t.xpEvents.at, new Date(Date.now() - 2 * 86_400_000)), sql`to_char(${t.xpEvents.at} at time zone ${tz}, 'YYYY-MM-DD') = ${today}`));
  return Number(row?.n ?? 0);
}

export async function openRisks(v: Viewer) {
  return db()
    .select({
      id: t.behaviorRisks.id,
      kind: t.behaviorRisks.kind,
      severity: t.behaviorRisks.severity,
      title: t.behaviorRisks.title,
      status: t.behaviorRisks.status,
      dueDate: t.behaviorRisks.dueDate,
      moduleId: t.behaviorRisks.moduleId,
      createdAt: t.behaviorRisks.createdAt,
      closedAt: t.behaviorRisks.closedAt,
    })
    .from(t.behaviorRisks)
    .where(eq(t.behaviorRisks.userId, v.user.id))
    .orderBy(asc(t.behaviorRisks.status), desc(t.behaviorRisks.createdAt));
}

export async function openRiskCount(v: Viewer): Promise<number> {
  const [r] = await db()
    .select({ n: count() })
    .from(t.behaviorRisks)
    .where(and(eq(t.behaviorRisks.userId, v.user.id), eq(t.behaviorRisks.status, "open")));
  return Number(r.n);
}

/** The newest teachable-moment lesson this person still has to take (services/teachable.ts), with its due day. */
export async function openTeachable(v: Viewer) {
  const [row] = await db()
    .select({ slug: t.modules.slug, title: t.modules.title, assignedAt: t.teachableLoops.assignedAt })
    .from(t.teachableLoops)
    .innerJoin(t.modules, eq(t.modules.id, t.teachableLoops.microModuleId))
    // Still to take, also once the 21-day fallback has scheduled the re-simulation.
    .where(and(eq(t.teachableLoops.userId, v.user.id), isNull(t.teachableLoops.completedAt), inArray(t.teachableLoops.status, ["assigned", "resim"])))
    .orderBy(desc(t.teachableLoops.assignedAt))
    .limit(1);
  return row ? { slug: row.slug, title: row.title, due: dayPlus(TEACHABLE_DAYS.lesson, v.tenant.settings.timeZone, row.assignedAt) } : null;
}

export async function nextLiveSession(v: Viewer) {
  const [s] = await db()
    .select()
    .from(t.liveSessions)
    .where(and(eq(t.liveSessions.tenantId, v.tenant.id), gte(t.liveSessions.startsAt, new Date())))
    .orderBy(asc(t.liveSessions.startsAt))
    .limit(1);
  return s ?? null;
}

export async function myLeagueRow(v: Viewer) {
  const rows = await departmentLeague(db(), v.tenant.id);
  const mine = rows.find((r) => r.id === v.user.departmentId) ?? null;
  return { rows, mine };
}

export async function myRiskBreakdown(v: Viewer) {
  const evidence = await computeTenantRisk(db(), v.tenant.id, new Date(), [v.user.id]);
  return evidence.get(v.user.id) ?? null;
}

export async function xpByDay(v: Viewer, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const tz = v.tenant.settings.timeZone;
  const rows = await db()
    .select({ day: sql<string>`to_char(${t.xpEvents.at} at time zone ${tz}, 'YYYY-MM-DD')`, xp: sql<number>`sum(${t.xpEvents.amount})` })
    .from(t.xpEvents)
    .where(and(eq(t.xpEvents.userId, v.user.id), gte(t.xpEvents.at, since)))
    .groupBy(sql`1`);
  const map = new Map(rows.map((r) => [r.day, Number(r.xp)]));
  return Array.from({ length: days }, (_, i) => {
    const day = dayPlus(-(days - 1 - i), tz);
    return { label: day, value: map.get(day) ?? 0 };
  });
}
