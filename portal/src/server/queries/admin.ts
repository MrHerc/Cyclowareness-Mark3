import "server-only";
import { cache } from "react";
import { and, asc, avg, count, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, t } from "../db";
import { avatarSrc } from "../avatar";
import type { Viewer } from "../auth/viewer";
import { departmentClosure, resolveAssignments } from "../services/assignments";
import { departmentLeague } from "../services/league";
import { riskBand } from "../../lib/domain/risk";
import { pick } from "../../i18n/config";
import { dayPlus } from "../../lib/time";

const DAY = 86_400_000;

export const getDepartments = cache(async (tenantId: string) =>
  db().select().from(t.departments).where(eq(t.departments.tenantId, tenantId)).orderBy(asc(t.departments.name)),
);

/**
 * Which departments a viewer may see. Department heads see their own department and its
 * sub-departments; everyone else with admin access sees the whole organisation (null).
 */
export async function scopeDepartmentIds(v: Viewer): Promise<Set<string> | null> {
  if (v.user.role !== "department_head") return null;
  const departments = await getDepartments(v.tenant.id);
  const headed = departments.filter((d) => d.headUserId === v.user.id).map((d) => d.id);
  const roots = headed.length ? headed : v.user.departmentId ? [v.user.departmentId] : [];
  const closure = departmentClosure(departments);
  const ids = new Set<string>();
  for (const r of roots) closure.get(r)?.forEach((x) => ids.add(x));
  return ids;
}

/**
 * The departments a department filter covers inside the viewer's scope. A filter that no longer exists
 * (deleted or merged) or lies outside the scope matches nobody; it must never widen to the whole organisation.
 */
export function narrowToDepartment(scope: Set<string> | null, closure: Map<string, Set<string>>, departmentId: string): Set<string> {
  return closure.has(departmentId) && (!scope || scope.has(departmentId)) ? closure.get(departmentId)! : new Set<string>();
}

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: (typeof t.users.$inferSelect)["role"];
  status: (typeof t.users.$inferSelect)["status"];
  departmentId: string | null;
  departmentName: string | null;
  jobTitle: string | null;
  riskScore: number;
  xp: number;
  lastActiveAt: Date | null;
  createdAt: Date;
  /** The photo's address (server/avatar.ts), not the photo. */
  avatarUrl: string | null;
  awaiting: number;
  deletionRequestedAt: Date | null;
};

export async function listPeople(v: Viewer, opts: { departmentIds?: Set<string> | null; includeDeleted?: boolean } = {}): Promise<PersonRow[]> {
  const scope = opts.departmentIds ?? (await scopeDepartmentIds(v));
  const rows = await db()
    .select({
      id: t.users.id,
      name: t.users.name,
      email: t.users.email,
      role: t.users.role,
      status: t.users.status,
      departmentId: t.users.departmentId,
      departmentName: t.departments.name,
      jobTitle: t.users.jobTitle,
      riskScore: t.users.riskScore,
      xp: t.users.xp,
      lastActiveAt: t.users.lastActiveAt,
      createdAt: t.users.createdAt,
      avatarUrl: avatarSrc,
      deletionRequestedAt: t.users.deletionRequestedAt,
    })
    .from(t.users)
    .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
    .where(and(eq(t.users.tenantId, v.tenant.id), opts.includeDeleted ? undefined : ne(t.users.status, "deleted")))
    .orderBy(asc(t.users.name));
  const filtered = scope ? rows.filter((r) => r.departmentId && scope.has(r.departmentId)) : rows;
  const ids = filtered.map((r) => r.id);
  const waiting = ids.length
    ? await db()
        .select({ userId: t.moduleProgress.userId, n: count() })
        .from(t.moduleProgress)
        .where(and(inArray(t.moduleProgress.userId, ids), eq(t.moduleProgress.status, "awaiting_attestation")))
        .groupBy(t.moduleProgress.userId)
    : [];
  const wmap = new Map(waiting.map((w) => [w.userId, Number(w.n)]));
  return filtered.map((r) => ({ ...r, awaiting: wmap.get(r.id) ?? 0 }));
}

export async function overviewData(v: Viewer, locale: string, departmentFilter: string | null) {
  const scope = await scopeDepartmentIds(v);
  const departments = await getDepartments(v.tenant.id);
  const closure = departmentClosure(departments);
  let deptScope: Set<string> | null = scope;
  if (departmentFilter && closure.has(departmentFilter) && (!scope || scope.has(departmentFilter))) deptScope = closure.get(departmentFilter)!;
  const people = (await listPeople(v, { departmentIds: deptScope })).filter((p) => p.status === "active");
  const ids = people.map((p) => p.id);
  const now = new Date();

  const [snapshots, assigned, league, sims, lessons, done, modules, ratings, scores] = await Promise.all([
    db()
      .select()
      .from(t.riskSnapshots)
      .where(and(eq(t.riskSnapshots.tenantId, v.tenant.id), gte(t.riskSnapshots.day, dayPlus(-31, v.tenant.settings.timeZone, now))))
      .orderBy(asc(t.riskSnapshots.day)),
    resolveAssignments(db(), v.tenant.id, ids),
    departmentLeague(db(), v.tenant.id),
    ids.length
      ? db()
          .select({ sent: count(), reported: sql<number>`count(${t.campaignRecipients.reportedAt})`, clicked: sql<number>`count(${t.campaignRecipients.clickedAt})` })
          .from(t.campaignRecipients)
          .where(and(inArray(t.campaignRecipients.userId, ids), gte(t.campaignRecipients.sentAt, new Date(now.getTime() - 90 * DAY))))
      : Promise.resolve([{ sent: 0, reported: 0, clicked: 0 }]),
    db().select({ id: t.lessons.id, moduleId: t.lessons.moduleId }).from(t.lessons),
    ids.length
      ? db().select({ userId: t.lessonProgress.userId, lessonId: t.lessonProgress.lessonId }).from(t.lessonProgress).where(and(inArray(t.lessonProgress.userId, ids), isNotNull(t.lessonProgress.completedAt)))
      : Promise.resolve([]),
    db().select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title, category: t.modules.category }).from(t.modules),
    db().select({ moduleId: t.feedback.moduleId, r: avg(t.feedback.rating), n: count() }).from(t.feedback).where(and(eq(t.feedback.tenantId, v.tenant.id), isNotNull(t.feedback.moduleId))).groupBy(t.feedback.moduleId),
    ids.length
      ? db()
          .select({ moduleId: t.lessons.moduleId, total: count(), good: sql<number>`count(*) filter (where ${t.answers.correct} and ${t.answers.firstTry})` })
          .from(t.answers)
          .innerJoin(t.lessons, eq(t.lessons.id, t.answers.lessonId))
          .where(and(inArray(t.answers.userId, ids), eq(t.answers.firstTry, true)))
          .groupBy(t.lessons.moduleId)
      : Promise.resolve([]),
  ]);

  // Completion of assigned lessons (scoped).
  const lessonsBy = new Map<string, string[]>();
  for (const l of lessons) lessonsBy.set(l.moduleId, [...(lessonsBy.get(l.moduleId) ?? []), l.id]);
  const doneSet = new Set(done.map((d) => `${d.userId}:${d.lessonId}`));
  let total = 0;
  let completed = 0;
  const moduleStats = new Map<string, { assignedTo: number; completedBy: number }>();
  const progress = ids.length
    ? await db().select().from(t.moduleProgress).where(inArray(t.moduleProgress.userId, ids))
    : [];
  const progressMap = new Map(progress.map((p) => [`${p.userId}:${p.moduleId}`, p]));
  for (const p of people) {
    for (const m of (assigned.get(p.id) ?? new Map()).values()) {
      const ls = lessonsBy.get(m.moduleId) ?? [];
      total += ls.length;
      completed += ls.filter((l) => doneSet.has(`${p.id}:${l}`)).length;
      const s = moduleStats.get(m.moduleId) ?? { assignedTo: 0, completedBy: 0 };
      s.assignedTo++;
      if (progressMap.get(`${p.id}:${m.moduleId}`)?.status === "completed") s.completedBy++;
      moduleStats.set(m.moduleId, s);
    }
  }
  const awaitingBy = new Map<string, number>();
  for (const p of progress) if (p.status === "awaiting_attestation") awaitingBy.set(p.moduleId, (awaitingBy.get(p.moduleId) ?? 0) + 1);

  const scoped = !!deptScope;
  const avgRisk = people.length ? Math.round(people.reduce((s, p) => s + p.riskScore, 0) / people.length) : 0;
  const completion = total ? Math.round((completed / total) * 100) : 0;
  const sent = Number(sims[0]?.sent ?? 0);
  const reportRate = sent ? Math.round((Number(sims[0].reported) / sent) * 100) : 0;
  const active7 = people.filter((p) => p.lastActiveAt && p.lastActiveAt.getTime() > now.getTime() - 7 * DAY).length;
  const first = snapshots[0];

  const bands = { low: 0, medium: 0, high: 0 };
  for (const p of people) bands[riskBand(p.riskScore)]++;

  const modById = new Map(modules.map((m) => [m.id, m]));
  const ratingBy = new Map(ratings.map((r) => [r.moduleId, { avg: Number(r.r), n: Number(r.n) }]));
  const scoreBy = new Map(scores.map((s) => [s.moduleId, Number(s.total) ? Math.round((Number(s.good) / Number(s.total)) * 100) : null]));
  const moduleRows = [...moduleStats.entries()]
    .map(([moduleId, s]) => ({
      moduleId,
      slug: modById.get(moduleId)?.slug ?? "",
      category: modById.get(moduleId)?.category ?? "email",
      title: pick(modById.get(moduleId)?.title, locale),
      assignedTo: s.assignedTo,
      completedBy: s.completedBy,
      awaiting: awaitingBy.get(moduleId) ?? 0,
      rating: ratingBy.get(moduleId)?.avg ?? null,
      score: scoreBy.get(moduleId) ?? null,
    }))
    .sort((a, b) => b.assignedTo - a.assignedTo);

  const deptRows = league
    .filter((r) => !deptScope || deptScope.has(r.id))
    .map((r) => {
      const members = people.filter((p) => p.departmentId === r.id);
      return { ...r, risk: members.length ? Math.round(members.reduce((s, p) => s + p.riskScore, 0) / members.length) : 0 };
    });

  return {
    scoped,
    departments,
    kpis: {
      avgRisk,
      avgRiskDelta: first && !scoped ? avgRisk - first.avgRisk : null,
      completion,
      completionFrom: first && !scoped ? first.completion : null,
      learners: people.length,
      active7,
      reportRate,
      reportFrom: first && !scoped ? first.reportRate : null,
    },
    charts: snapshots.map((s) => ({ day: s.day, avgRisk: s.avgRisk, completion: s.completion, reportRate: s.reportRate })),
    league,
    bands,
    highest: [...people].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    deptRows,
    moduleRows,
  };
}

export async function setupState(v: Viewer) {
  const tid = v.tenant.id;
  const [[deps], [ppl], [asg], [pol]] = await Promise.all([
    db().select({ n: count() }).from(t.departments).where(eq(t.departments.tenantId, tid)),
    db().select({ n: count() }).from(t.users).where(eq(t.users.tenantId, tid)),
    db().select({ n: count() }).from(t.assignments).where(eq(t.assignments.tenantId, tid)),
    db()
      .select({ n: count() })
      .from(t.policyVersions)
      .innerJoin(t.policies, eq(t.policies.id, t.policyVersions.policyId))
      .where(and(eq(t.policies.tenantId, tid), isNotNull(t.policyVersions.publishedAt))),
  ]);
  const s = v.tenant.settings;
  return [
    { key: "departments", done: Number(deps.n) > 0, href: "/admin/departments" },
    { key: "people", done: Number(ppl.n) > 1, href: "/admin/users" },
    { key: "email", done: !!s.email.enabled, href: "/admin/settings?tab=email" },
    { key: "logo", done: !!v.tenant.branding.logoUrl, href: "/admin/settings?tab=branding" },
    { key: "assign", done: Number(asg.n) > 0, href: "/admin/assignments" },
    { key: "policy", done: Number(pol.n) > 0, href: "/admin/policies" },
    { key: "twofa", done: s.identity.requireAdmin2fa, href: "/admin/settings?tab=identity", skippable: true },
  ] as { key: "departments" | "people" | "email" | "logo" | "assign" | "policy" | "twofa"; done: boolean; href: string; skippable?: boolean; optional?: boolean }[];
}

export async function recentAudit(tenantId: string, limit = 10) {
  return db()
    .select({ id: t.auditLog.id, action: t.auditLog.action, at: t.auditLog.at, actor: t.users.name })
    .from(t.auditLog)
    .leftJoin(t.users, eq(t.users.id, t.auditLog.actorId))
    .where(eq(t.auditLog.tenantId, tenantId))
    .orderBy(desc(t.auditLog.at))
    .limit(limit);
}
