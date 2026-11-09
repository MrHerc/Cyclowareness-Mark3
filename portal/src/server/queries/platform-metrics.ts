import "server-only";
import { and, asc, eq, gte, ne, or, sql } from "drizzle-orm";
import { db, t } from "../db";
import { campaignStats } from "../services/campaigns";

const DAY = 86_400_000;

/** People per organisation by status, and the active ones seen in the last 7 and 30 days. The operator overview, the metrics page and the seat export all count seats here. */
export async function peopleCounts(now = new Date()) {
  const week = new Date(now.getTime() - 7 * DAY).toISOString();
  const month = new Date(now.getTime() - 30 * DAY).toISOString();
  // users.last_active_at, not sessions: session rows are deleted on sign-out and expiry, so they would forget people who signed out.
  const rows = await db()
    .select({
      tenantId: t.users.tenantId,
      active: sql<number>`count(*) filter (where ${t.users.status} = 'active')`,
      invited: sql<number>`count(*) filter (where ${t.users.status} = 'invited')`,
      weekly: sql<number>`count(*) filter (where ${t.users.status} = 'active' and ${t.users.lastActiveAt} >= ${week})`,
      monthly: sql<number>`count(*) filter (where ${t.users.status} = 'active' and ${t.users.lastActiveAt} >= ${month})`,
    })
    .from(t.users)
    // Platform operators are vendor staff, not billable seats of the organisation they sit in.
    .where(ne(t.users.role, "super_admin"))
    .groupBy(t.users.tenantId);
  return new Map(rows.map((r) => [r.tenantId, { active: Number(r.active), invited: Number(r.invited), weekly: Number(r.weekly), monthly: Number(r.monthly) }]));
}

export type OrganisationMetrics = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  active: number;
  invited: number;
  weekly: number;
  monthly: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  modulesCompleted: number;
  sent: number;
  opened: number;
  clicked: number;
  reported: number;
  certificates: number;
};

/** Usage per organisation for the operator console: aggregates only, never a row per person. */
export async function platformMetrics(now = new Date()): Promise<OrganisationMetrics[]> {
  const month = new Date(now.getTime() - 30 * DAY);
  const since = month.toISOString();
  const lastDone = sql`coalesce(${t.lessonProgress.lastCompletedAt}, ${t.lessonProgress.completedAt})`;
  // Same population as the seats: an operator playing lessons inside a tenant is not its usage.
  const notOperator = ne(t.users.role, "super_admin");
  const [tenants, people, lessons, modules, campaigns, certificates] = await Promise.all([
    db().select({ id: t.tenants.id, slug: t.tenants.slug, name: t.tenants.name, plan: t.tenants.plan }).from(t.tenants).orderBy(asc(t.tenants.name)),
    peopleCounts(now),
    // started_at is cleared by a completion, so a lesson finished in the window counts as started too.
    db()
      .select({ tenantId: t.users.tenantId, started: sql<number>`count(*)`, completed: sql<number>`count(*) filter (where ${lastDone} >= ${since})` })
      .from(t.lessonProgress)
      .innerJoin(t.users, eq(t.users.id, t.lessonProgress.userId))
      .where(and(notOperator, or(gte(t.lessonProgress.startedAt, month), sql`${lastDone} >= ${since}`)))
      .groupBy(t.users.tenantId),
    db()
      .select({ tenantId: t.users.tenantId, n: sql<number>`count(*)` })
      .from(t.moduleProgress)
      .innerJoin(t.users, eq(t.users.id, t.moduleProgress.userId))
      .where(and(notOperator, eq(t.moduleProgress.status, "completed")))
      .groupBy(t.users.tenantId),
    db().select({ id: t.campaigns.id, tenantId: t.campaigns.tenantId }).from(t.campaigns),
    db()
      .select({ tenantId: t.certificates.tenantId, n: sql<number>`count(*)` })
      .from(t.certificates)
      .innerJoin(t.users, eq(t.users.id, t.certificates.userId))
      .where(and(notOperator, eq(t.certificates.evidence, "server_verified")))
      .groupBy(t.certificates.tenantId),
  ]);
  const stats = await campaignStats(db(), campaigns.map((c) => c.id));
  const funnel = new Map<string, { sent: number; opened: number; clicked: number; reported: number }>();
  for (const c of campaigns) {
    const s = stats.get(c.id);
    if (!s) continue;
    const f = funnel.get(c.tenantId) ?? { sent: 0, opened: 0, clicked: 0, reported: 0 };
    funnel.set(c.tenantId, { sent: f.sent + s.sent, opened: f.opened + s.opened, clicked: f.clicked + s.clicked, reported: f.reported + s.reported });
  }
  const lessonsBy = new Map(lessons.map((r) => [r.tenantId, r]));
  const modulesBy = new Map(modules.map((r) => [r.tenantId, Number(r.n)]));
  const certificatesBy = new Map(certificates.map((r) => [r.tenantId, Number(r.n)]));
  return tenants.map((x) => {
    const p = people.get(x.id);
    const l = lessonsBy.get(x.id);
    const f = funnel.get(x.id);
    return {
      ...x,
      active: p?.active ?? 0,
      invited: p?.invited ?? 0,
      weekly: p?.weekly ?? 0,
      monthly: p?.monthly ?? 0,
      lessonsStarted: Number(l?.started ?? 0),
      lessonsCompleted: Number(l?.completed ?? 0),
      modulesCompleted: modulesBy.get(x.id) ?? 0,
      sent: f?.sent ?? 0,
      opened: f?.opened ?? 0,
      clicked: f?.clicked ?? 0,
      reported: f?.reported ?? 0,
      certificates: certificatesBy.get(x.id) ?? 0,
    };
  });
}
