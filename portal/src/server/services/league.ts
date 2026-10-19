import { and, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { resolveAssignments } from "./assignments";
import { rankLeague, withTrend, type DepartmentStats, type LeagueRowWithTrend } from "../../lib/domain/league";

const DAY = 86_400_000;
/** Reporting counts simulations sent in the last 90 days. */
const REPORT_WINDOW_DAYS = 90;
/** The trend compares today's places with the places this many days ago. */
const TREND_DAYS = 7;

/**
 * Department league for this month (score = 60 % assigned completion + 40 % reporting),
 * ranked as of `now`, with each department's trend against its place `TREND_DAYS` earlier.
 * Events after the cut-off are ignored (lesson completions, simulations sent and reports).
 */
export async function departmentLeague(db: DB, tenantId: string, now = new Date()): Promise<LeagueRowWithTrend[]> {
  const [departments, users] = await Promise.all([
    db.select({ id: t.departments.id, name: t.departments.name }).from(t.departments).where(eq(t.departments.tenantId, tenantId)),
    db
      .select({ id: t.users.id, departmentId: t.users.departmentId })
      .from(t.users)
      .where(and(eq(t.users.tenantId, tenantId), eq(t.users.status, "active"))),
  ]);
  const assigned = await resolveAssignments(db, tenantId);
  const moduleIds = [...new Set([...assigned.values()].flatMap((m) => [...m.keys()]))];
  const lessons = moduleIds.length ? await db.select({ id: t.lessons.id, moduleId: t.lessons.moduleId }).from(t.lessons).where(inArray(t.lessons.moduleId, moduleIds)) : [];
  const byModule = new Map<string, string[]>();
  for (const l of lessons) byModule.set(l.moduleId, [...(byModule.get(l.moduleId) ?? []), l.id]);
  const userIds = users.map((u) => u.id);
  const earliest = new Date(now.getTime() - (REPORT_WINDOW_DAYS + TREND_DAYS) * DAY);
  const [done, sims] = await Promise.all([
    userIds.length
      ? db
          .select({ userId: t.lessonProgress.userId, lessonId: t.lessonProgress.lessonId, completedAt: t.lessonProgress.completedAt })
          .from(t.lessonProgress)
          .where(and(inArray(t.lessonProgress.userId, userIds), isNotNull(t.lessonProgress.completedAt), lte(t.lessonProgress.completedAt, now)))
      : [],
    userIds.length
      ? db
          .select({ userId: t.campaignRecipients.userId, sentAt: t.campaignRecipients.sentAt, reportedAt: t.campaignRecipients.reportedAt })
          .from(t.campaignRecipients)
          .where(and(inArray(t.campaignRecipients.userId, userIds), isNotNull(t.campaignRecipients.sentAt), gte(t.campaignRecipients.sentAt, earliest), lte(t.campaignRecipients.sentAt, now)))
      : [],
  ]);

  const statsAt = (cutoff: Date): DepartmentStats[] => {
    const doneSet = new Set(done.filter((d) => d.completedAt && d.completedAt <= cutoff).map((d) => `${d.userId}:${d.lessonId}`));
    const windowStart = new Date(cutoff.getTime() - REPORT_WINDOW_DAYS * DAY);
    const simBy = new Map<string, { sent: number; reported: number }>();
    for (const s of sims) {
      if (!s.sentAt || s.sentAt < windowStart || s.sentAt > cutoff) continue;
      const entry = simBy.get(s.userId) ?? { sent: 0, reported: 0 };
      entry.sent++;
      if (s.reportedAt && s.reportedAt <= cutoff) entry.reported++;
      simBy.set(s.userId, entry);
    }
    return departments.map((d) => {
      const members = users.filter((u) => u.departmentId === d.id);
      let total = 0;
      let completed = 0;
      let sent = 0;
      let reported = 0;
      for (const u of members) {
        for (const m of (assigned.get(u.id) ?? new Map()).values()) {
          for (const l of byModule.get(m.moduleId) ?? []) {
            total++;
            if (doneSet.has(`${u.id}:${l}`)) completed++;
          }
        }
        sent += simBy.get(u.id)?.sent ?? 0;
        reported += simBy.get(u.id)?.reported ?? 0;
      }
      return {
        id: d.id,
        name: d.name,
        learners: members.length,
        completion: total ? Math.round((completed / total) * 100) : 0,
        reportRate: sent ? Math.round((reported / sent) * 100) : 0,
      };
    });
  };

  return withTrend(rankLeague(statsAt(now)), rankLeague(statsAt(new Date(now.getTime() - TREND_DAYS * DAY))));
}
