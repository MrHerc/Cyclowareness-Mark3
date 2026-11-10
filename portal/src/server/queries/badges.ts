import "server-only";
import { and, count, eq, isNotNull, notLike, sql } from "drizzle-orm";
import { db, t } from "../db";
import { earnedBadges, type BadgeFacts } from "../../lib/domain/gamification";

/** Facts behind the eight badges, for one person. */
export async function badgeFacts(userId: string, tenantId: string): Promise<BadgeFacts> {
  const [[lessons], [modules], [reports], [user], [labs], [certs], [paths]] = await Promise.all([
    db().select({ n: count() }).from(t.lessonProgress).where(and(eq(t.lessonProgress.userId, userId), isNotNull(t.lessonProgress.completedAt))),
    db().select({ n: count() }).from(t.moduleProgress).where(and(eq(t.moduleProgress.userId, userId), eq(t.moduleProgress.status, "completed"))),
    db().select({ n: count() }).from(t.threatReports).where(eq(t.threatReports.reporterId, userId)),
    db().select({ longest: t.users.streakLongest }).from(t.users).where(eq(t.users.id, userId)),
    // The lab explorer badge counts the lab games and machine labs; a module mini-lab ("mini:<slug>") is practice for its module.
    db().select({ n: sql<number>`count(distinct ${t.labAttempts.exercise})` }).from(t.labAttempts).where(and(eq(t.labAttempts.userId, userId), notLike(t.labAttempts.exercise, "mini:%"))),
    db().select({ n: count() }).from(t.certificates).where(eq(t.certificates.userId, userId)),
    db().select({ n: count() }).from(t.certificates).where(and(eq(t.certificates.userId, userId), isNotNull(t.certificates.pathId))),
  ]);
  const versions = await db().execute<{ total: number; signed: number }>(sql`
    with latest as (
      select distinct on (pv.policy_id) pv.id
      from ${t.policyVersions} pv join ${t.policies} p on p.id = pv.policy_id
      where p.tenant_id = ${tenantId} and p.archived_at is null and pv.published_at is not null
      order by pv.policy_id, pv.version desc
    )
    select count(*)::int as total,
           count(s.id)::int as signed
    from latest l left join ${t.policySignoffs} s on s.version_id = l.id and s.user_id = ${userId}`);
  const row = (versions as unknown as { rows: { total: number; signed: number }[] }).rows?.[0] ?? { total: 0, signed: 0 };
  return {
    lessonsCompleted: Number(lessons.n),
    modulesCompleted: Number(modules.n),
    reports: Number(reports.n),
    longestStreak: user?.longest ?? 0,
    policiesToSign: Number(row.total) - Number(row.signed),
    policiesSigned: Number(row.signed),
    labGamesPlayed: Number(labs.n),
    certificates: Number(certs.n),
    pathsCompleted: Number(paths.n),
  };
}

export async function badgesFor(userId: string, tenantId: string) {
  return earnedBadges(await badgeFacts(userId, tenantId));
}
