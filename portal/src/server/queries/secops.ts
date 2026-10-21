import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { pick } from "../../i18n/config";
import { dayBoundary, todayInBaku } from "../../lib/time";

const DAY = 86_400_000;

export type PersonRef = { id: string; name: string; email: string; departmentName: string | null };

/** Names for a set of user ids (people who left show as missing). */
export async function peopleById(tenantId: string, ids: (string | null | undefined)[]): Promise<Map<string, PersonRef>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const rows = await db()
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, departmentName: t.departments.name })
    .from(t.users)
    .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
    .where(and(eq(t.users.tenantId, tenantId), inArray(t.users.id, unique)));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Modules a tenant can use for targeted training (library + its own published ones). */
export async function trainingModules(tenantId: string, locale: string) {
  const rows = await db()
    .select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title, category: t.modules.category, tenantId: t.modules.tenantId })
    .from(t.modules)
    .where(and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, tenantId)), eq(t.modules.status, "published")));
  return rows.map((m) => ({ id: m.id, slug: m.slug, title: pick(m.title, locale), category: m.category, own: !!m.tenantId })).sort((a, b) => a.title.localeCompare(b.title, locale));
}

/** Everything the operations center shows. */
export async function opsOverview(v: Viewer) {
  const tid = v.tenant.id;
  const now = Date.now();
  // Start of the Baku day 13 days ago (14 days including today): the days the chart below is keyed by,
  // not the server's local midnight. todayInBaku always yields a real day, so dayBoundary cannot be null.
  const since14 = dayBoundary(todayInBaku(new Date(now - 13 * DAY)))!;
  const since30 = new Date(now - 30 * DAY);
  const since90 = new Date(now - 90 * DAY);

  const [newReports, incidents, approvals, loops, reports14, sandbox30, recentReports, recentSandbox, recentIncidents, recentLoopEvents, recentDecisions] = await Promise.all([
    db().select({ n: sql<number>`count(*)` }).from(t.threatReports).where(and(eq(t.threatReports.tenantId, tid), eq(t.threatReports.status, "new"))),
    db().select().from(t.incidents).where(and(eq(t.incidents.tenantId, tid), inArray(t.incidents.status, ["open", "investigating"]))),
    db().select({ n: sql<number>`count(*)` }).from(t.materials).where(and(eq(t.materials.tenantId, tid), inArray(t.materials.status, ["pending", "second_approval"]))),
    db().select({ stage: t.loops.stage, closedAt: t.loops.closedAt, createdAt: t.loops.createdAt }).from(t.loops).where(eq(t.loops.tenantId, tid)),
    db()
      .select({ day: sql<string>`to_char(${t.threatReports.createdAt} at time zone 'Asia/Baku', 'YYYY-MM-DD')`, n: sql<number>`count(*)` })
      .from(t.threatReports)
      .where(and(eq(t.threatReports.tenantId, tid), gte(t.threatReports.createdAt, since14), isNull(t.threatReports.campaignRecipientId)))
      .groupBy(sql`1`),
    db()
      .select({ verdict: t.sandboxAnalyses.verdict, n: sql<number>`count(*)` })
      .from(t.sandboxAnalyses)
      .where(and(eq(t.sandboxAnalyses.tenantId, tid), gte(t.sandboxAnalyses.createdAt, since30)))
      .groupBy(t.sandboxAnalyses.verdict),
    db().select({ id: t.threatReports.id, number: t.threatReports.number, subject: t.threatReports.subject, at: t.threatReports.createdAt, sim: t.threatReports.campaignRecipientId }).from(t.threatReports).where(eq(t.threatReports.tenantId, tid)).orderBy(desc(t.threatReports.createdAt)).limit(8),
    db().select({ id: t.sandboxAnalyses.id, number: t.sandboxAnalyses.number, objectName: t.sandboxAnalyses.objectName, kind: t.sandboxAnalyses.kind, verdict: t.sandboxAnalyses.verdict, at: t.sandboxAnalyses.createdAt }).from(t.sandboxAnalyses).where(eq(t.sandboxAnalyses.tenantId, tid)).orderBy(desc(t.sandboxAnalyses.createdAt)).limit(6),
    db().select({ id: t.incidents.id, number: t.incidents.number, title: t.incidents.title, confidential: t.incidents.confidential, severity: t.incidents.severity, at: t.incidents.createdAt }).from(t.incidents).where(eq(t.incidents.tenantId, tid)).orderBy(desc(t.incidents.createdAt)).limit(6),
    db()
      .select({ id: t.loopEvents.id, loopId: t.loopEvents.loopId, stage: t.loopEvents.stage, at: t.loopEvents.at, title: t.loops.title })
      .from(t.loopEvents)
      .innerJoin(t.loops, eq(t.loops.id, t.loopEvents.loopId))
      .where(and(eq(t.loops.tenantId, tid), isNotNull(t.loopEvents.actorId)))
      .orderBy(desc(t.loopEvents.at))
      .limit(8),
    db()
      .select({ id: t.materialDecisions.id, decision: t.materialDecisions.decision, at: t.materialDecisions.at, title: t.materials.title })
      .from(t.materialDecisions)
      .innerJoin(t.materials, eq(t.materials.id, t.materialDecisions.materialId))
      .where(eq(t.materials.tenantId, tid))
      .orderBy(desc(t.materialDecisions.at))
      .limit(6),
  ]);

  const openLoops = loops.filter((l) => !l.closedAt);
  const closed30 = loops.filter((l) => l.closedAt && l.closedAt.getTime() >= since30.getTime()).length;
  const durations = loops
    .filter((l) => l.closedAt && l.closedAt.getTime() >= since90.getTime())
    .map((l) => (l.closedAt!.getTime() - l.createdAt.getTime()) / 3_600_000)
    .sort((a, b) => a - b);
  const median = durations.length ? Math.round(durations.length % 2 ? durations[(durations.length - 1) / 2] : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2) : null;

  const byDay = new Map(reports14.map((r) => [r.day, Number(r.n)]));
  const days: { day: string; value: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * DAY + 12 * 3_600_000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });
    days.push({ day: key, value: byDay.get(key) ?? 0 });
  }

  type Feed = { id: string; kind: "report" | "sandbox" | "incident" | "loop" | "decision"; at: Date; title: string; href: string; number?: number; extra?: string; tone: "brand" | "risk" | "warn" | "safe" | "neutral" };
  const feed: Feed[] = [
    ...recentReports.map((r) => ({ id: r.id, kind: "report" as const, at: r.at, title: r.subject, href: `/admin/threats?focus=${r.id}`, number: r.number, tone: r.sim ? ("safe" as const) : ("brand" as const) })),
    ...recentSandbox.map((s) => ({ id: s.id, kind: "sandbox" as const, at: s.at, title: s.objectName, href: `/admin/sandbox/${s.id}`, number: s.number, extra: s.verdict, tone: s.verdict === "malicious" ? ("risk" as const) : s.verdict === "suspicious" ? ("warn" as const) : ("safe" as const) })),
    ...recentIncidents.map((i) => ({ id: i.id, kind: "incident" as const, at: i.at, title: i.confidential ? `IR-${i.number}` : i.title, href: `/admin/incidents/${i.id}`, number: i.number, tone: i.severity === "high" || i.severity === "critical" ? ("risk" as const) : ("warn" as const) })),
    ...recentLoopEvents.map((e) => ({ id: e.id, kind: "loop" as const, at: e.at, title: e.title, href: `/admin/loops/${e.loopId}`, extra: e.stage, tone: "brand" as const })),
    ...recentDecisions.map((d) => ({ id: d.id, kind: "decision" as const, at: d.at, title: d.title, href: "/admin/approvals?tab=decided", extra: d.decision, tone: d.decision === "reject" ? ("risk" as const) : ("safe" as const) })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 14);

  const sev = (s: string) => ({ critical: 0, high: 1, medium: 2, low: 3 })[s] ?? 4;
  return {
    newReports: Number(newReports[0]?.n ?? 0),
    openIncidents: incidents.length,
    highIncidents: incidents.filter((i) => i.severity === "high" || i.severity === "critical").length,
    pendingApprovals: Number(approvals[0]?.n ?? 0),
    openLoops: openLoops.length,
    closed30,
    medianHours: median,
    pipeline: t.LOOP_STAGES.map((stage) => ({ stage, count: openLoops.filter((l) => l.stage === stage).length })),
    reportsByDay: days,
    sandbox: { malicious: 0, suspicious: 0, clean: 0, ...Object.fromEntries(sandbox30.map((s) => [s.verdict, Number(s.n)])) } as Record<"malicious" | "suspicious" | "clean", number>,
    live: incidents.filter((i) => i.live || i.severity === "high" || i.severity === "critical").sort((a, b) => Number(b.live) - Number(a.live) || sev(a.severity) - sev(b.severity)),
    feed,
  };
}
