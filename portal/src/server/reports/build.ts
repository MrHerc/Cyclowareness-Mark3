import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { departmentClosure, resolveAssignments } from "../services/assignments";
import { scopeDepartmentIds } from "../queries/admin";
import { TEMPLATE_BY_KEY } from "../../lib/campaigns/templates";
import { riskBand } from "../../lib/domain/risk";
import { levelFor } from "../../lib/domain/gamification";
import { LOCALE_NAMES, pick, type Locale } from "../../i18n/config";
import { dayRange, todayIn } from "../../lib/time";
import { isUuid } from "../../lib/ids";
import type { ReportKind } from "../db/schema";

export type Cell = string | number | Date | null;
export type ReportTable = { title: string; headers: string[]; rows: Cell[][] };
export type ReportFilters = { from?: string; to?: string; departmentId?: string };

/** Impossible days and a reversed range are ignored (no date filter) rather than compared as Invalid Date, which drops every row. */
function range(f: ReportFilters, timeZone: string) {
  const r = dayRange(f.from, f.to, timeZone);
  return { from: r.from, to: r.to };
}
const within = (d: Date | null, r: { from: Date | null; to: Date | null }) => !d || ((!r.from || d >= r.from) && (!r.to || d <= r.to));

/**
 * Filters from a document link (?from&to&d) as the report applies them. `rejected` when a value was given
 * but cannot be applied (a day that does not exist, a start after the end, a malformed department id):
 * the caller refuses it rather than printing the unfiltered report under the period that was asked for.
 */
export function parseReportFilters(raw: { from?: string; to?: string; d?: string }): { filters: ReportFilters; rejected: boolean } {
  const r = dayRange(raw.from, raw.to);
  const badDepartment = !!raw.d && !isUuid(raw.d);
  return {
    filters: { from: r.fromDay || undefined, to: r.toDay || undefined, departmentId: raw.d && !badDepartment ? raw.d : undefined },
    rejected: r.rejected || badDepartment,
  };
}

/** People in scope: the viewer's own scope, narrowed to a department filter when given. */
/** The people a report covers: the viewer's scope (department heads see their departments) narrowed by the department filter. */
export async function scopedPeople(v: Viewer, f: ReportFilters) {
  const scope = await scopeDepartmentIds(v);
  const departments = await db().select().from(t.departments).where(eq(t.departments.tenantId, v.tenant.id));
  const closure = departmentClosure(departments);
  let dept: Set<string> | null = scope;
  if (f.departmentId) {
    // A department filter that no longer exists (deleted or merged) or lies outside the viewer's scope
    // matches nobody; it must never widen the report to the whole organisation.
    dept = closure.has(f.departmentId) && (!scope || scope.has(f.departmentId)) ? closure.get(f.departmentId)! : new Set<string>();
  }
  const users = await db()
    .select()
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), ne(t.users.status, "deleted"), ne(t.users.role, "super_admin")))
    .orderBy(asc(t.users.name));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  return { users: users.filter((u) => !dept || (u.departmentId && dept.has(u.departmentId))), deptName };
}

export async function buildReport(v: Viewer, kind: ReportKind, f: ReportFilters, locale: string): Promise<ReportTable> {
  const [tr, tc] = await Promise.all([getTranslations({ locale, namespace: "admin.reports" }), getTranslations({ locale, namespace: "common" })]);
  const c = (k: string) => tr(`cols.${k}` as "cols.person");
  const title = tr(`kinds.${kind}.title`);
  const r = range(f, v.tenant.settings.timeZone);
  const { users, deptName } = await scopedPeople(v, f);
  const ids = users.map((u) => u.id);
  const dept = (u: { departmentId: string | null }) => (u.departmentId ? (deptName.get(u.departmentId) ?? "") : "");
  const modules = await db().select().from(t.modules).where(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)));
  const modById = new Map(modules.map((m) => [m.id, m]));

  switch (kind) {
    case "people":
      return {
        title,
        headers: [c("person"), c("email"), c("department"), c("jobTitle"), c("role"), c("status"), c("risk"), c("xp"), c("level"), c("lastActive"), c("joined")],
        rows: users.map((u) => [u.name, u.email, dept(u), u.jobTitle, tc(`roles.${u.role}`), tc(`userStatus.${u.status}`), u.riskScore, u.xp, levelFor(u.xp).level, u.lastActiveAt, u.createdAt]),
      };

    case "completion": {
      const assigned = await resolveAssignments(db(), v.tenant.id, ids);
      const progress = ids.length ? await db().select().from(t.moduleProgress).where(inArray(t.moduleProgress.userId, ids)) : [];
      const pm = new Map(progress.map((p) => [`${p.userId}:${p.moduleId}`, p]));
      const today = todayIn(v.tenant.settings.timeZone);
      const rows: Cell[][] = [];
      for (const u of users) {
        for (const a of (assigned.get(u.id) ?? new Map()).values()) {
          const p = pm.get(`${u.id}:${a.moduleId}`);
          const status = p?.status === "completed" ? c("done") : a.due && a.due < today ? c("overdue") : p?.status === "awaiting_attestation" ? c("awaiting") : p?.status === "in_progress" ? c("inProgress") : c("notStarted");
          if (!within(p?.completedAt ?? null, r) && p?.status === "completed") continue;
          // The due day stays a YYYY-MM-DD day (no time of day in CSV and XLSX); the printed report writes it in its language.
          rows.push([u.name, u.email, dept(u), pick(modById.get(a.moduleId)?.title, locale), a.due, status, p?.percent ?? 0, p?.completedAt ?? null]);
        }
      }
      return { title, headers: [c("person"), c("email"), c("department"), c("module"), c("due"), c("status"), c("completion"), c("completedAt")], rows };
    }

    case "risk": {
      const open = ids.length
        ? await db()
            .select({ userId: t.behaviorRisks.userId, n: sql<number>`count(*)` })
            .from(t.behaviorRisks)
            .where(and(inArray(t.behaviorRisks.userId, ids), eq(t.behaviorRisks.status, "open")))
            .groupBy(t.behaviorRisks.userId)
        : [];
      const om = new Map(open.map((o) => [o.userId, Number(o.n)]));
      const rows: Cell[][] = users.map((u) => [u.name, u.email, dept(u), u.riskScore, tc(`risk.${riskBand(u.riskScore)}`), om.get(u.id) ?? 0]);
      const byDept = new Map<string, number[]>();
      for (const u of users) byDept.set(dept(u) || "—", [...(byDept.get(dept(u) || "—") ?? []), u.riskScore]);
      for (const [d, scores] of byDept) rows.push([`${c("average")}: ${d}`, "", d, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), "", ""]);
      return { title, headers: [c("person"), c("email"), c("department"), c("risk"), c("band"), c("openRisks")], rows };
    }

    case "modules": {
      const assigned = await resolveAssignments(db(), v.tenant.id, ids);
      const progress = ids.length ? await db().select().from(t.moduleProgress).where(and(inArray(t.moduleProgress.userId, ids), eq(t.moduleProgress.status, "completed"))) : [];
      const doneBy = new Map<string, number>();
      for (const p of progress) if (within(p.completedAt, r)) doneBy.set(p.moduleId, (doneBy.get(p.moduleId) ?? 0) + 1);
      const assignedBy = new Map<string, number>();
      for (const m of assigned.values()) for (const a of m.values()) assignedBy.set(a.moduleId, (assignedBy.get(a.moduleId) ?? 0) + 1);
      const scores = ids.length
        ? await db()
            .select({ moduleId: t.lessons.moduleId, total: sql<number>`count(*)`, good: sql<number>`count(*) filter (where ${t.answers.correct})` })
            .from(t.answers)
            .innerJoin(t.lessons, eq(t.lessons.id, t.answers.lessonId))
            .where(and(inArray(t.answers.userId, ids), eq(t.answers.firstTry, true)))
            .groupBy(t.lessons.moduleId)
        : [];
      const sm = new Map(scores.map((s) => [s.moduleId, Number(s.total) ? Math.round((Number(s.good) / Number(s.total)) * 100) : null]));
      const ratings = await db()
        .select({ moduleId: t.feedback.moduleId, r: sql<number>`avg(${t.feedback.rating})`, n: sql<number>`count(*)` })
        .from(t.feedback)
        .where(and(eq(t.feedback.tenantId, v.tenant.id), isNotNull(t.feedback.moduleId)))
        .groupBy(t.feedback.moduleId);
      const rm = new Map(ratings.map((x) => [x.moduleId, Number(x.r)]));
      const rows: Cell[][] = modules
        .filter((m) => assignedBy.has(m.id) || doneBy.has(m.id))
        .map((m) => {
          const a = assignedBy.get(m.id) ?? 0;
          const d = doneBy.get(m.id) ?? 0;
          return [pick(m.title, locale), tc(`categories.${m.category as "email"}`), tc(`difficulty.${m.difficulty}`), a, d, a ? Math.round((d / a) * 100) : null, sm.get(m.id) ?? null, rm.has(m.id) ? Math.round(rm.get(m.id)! * 10) / 10 : null];
        });
      return { title, headers: [c("module"), c("category"), c("difficulty"), c("assigned"), c("completed"), c("completion"), c("score"), c("rating")], rows };
    }

    case "feedback": {
      const rows = await db()
        .select({ moduleId: t.feedback.moduleId, rating: t.feedback.rating, comment: t.feedback.comment, at: t.feedback.createdAt })
        .from(t.feedback)
        .where(and(eq(t.feedback.tenantId, v.tenant.id), isNotNull(t.feedback.moduleId)))
        .orderBy(asc(t.feedback.rating), desc(t.feedback.createdAt));
      return {
        title,
        headers: [c("module"), c("rating"), c("comment"), c("date")],
        rows: rows.filter((x) => within(x.at, r)).map((x) => [pick(modById.get(x.moduleId ?? "")?.title, locale), x.rating, x.comment, x.at]),
      };
    }

    case "confirmations": {
      const att = ids.length ? await db().select().from(t.attestations).where(inArray(t.attestations.userId, ids)).orderBy(desc(t.attestations.at)) : [];
      const waiting = ids.length ? await db().select().from(t.moduleProgress).where(and(inArray(t.moduleProgress.userId, ids), eq(t.moduleProgress.status, "awaiting_attestation"))) : [];
      const uById = new Map(users.map((u) => [u.id, u]));
      const rows: Cell[][] = [
        ...att.filter((a) => within(a.at, r)).map((a) => {
          const u = uById.get(a.userId)!;
          return [u.name, u.email, dept(u), pick(modById.get(a.moduleId)?.title, locale), c("done"), a.at, LOCALE_NAMES[a.locale as Locale] ?? a.locale, a.text] as Cell[];
        }),
        ...waiting.map((w) => {
          const u = uById.get(w.userId)!;
          return [u.name, u.email, dept(u), pick(modById.get(w.moduleId)?.title, locale), c("awaiting"), null, "", ""] as Cell[];
        }),
      ];
      return { title, headers: [c("person"), c("email"), c("department"), c("module"), c("status"), c("confirmedAt"), c("language"), c("text")], rows };
    }

    case "simulations": {
      const tcmp = await getTranslations({ locale, namespace: "admin.campaigns" });
      const rec = ids.length
        ? await db()
            .select({ r: t.campaignRecipients, name: t.campaigns.name, channel: t.campaigns.channel, templateKey: t.campaigns.templateKey })
            .from(t.campaignRecipients)
            .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
            .where(and(eq(t.campaigns.tenantId, v.tenant.id), inArray(t.campaignRecipients.userId, ids)))
            .orderBy(desc(t.campaignRecipients.sentAt))
        : [];
      const uById = new Map(users.map((u) => [u.id, u]));
      return {
        title,
        headers: [c("campaign"), c("channel"), c("template"), c("person"), c("department"), c("sent"), c("opened"), c("clicked"), c("submitted"), c("reported")],
        rows: rec
          .filter((x) => within(x.r.sentAt, r))
          .map((x) => {
            const u = uById.get(x.r.userId)!;
            const tpl = TEMPLATE_BY_KEY.get(x.templateKey);
            // A QR campaign is an email carrying the code, as the campaign pages show it.
            return [x.name, tcmp(`channel.${x.channel === "qr" ? "email" : x.channel}`), tpl ? (tpl.name[locale as "az"] ?? tpl.name.en) : x.templateKey, u.name, dept(u), x.r.sentAt, x.r.openedAt, x.r.clickedAt, x.r.submittedAt, x.r.reportedAt];
          }),
      };
    }

    case "secops": {
      const tid = v.tenant.id;
      const [ts, tsb] = await Promise.all([getTranslations({ locale, namespace: "secops" }), getTranslations({ locale, namespace: "security.sandbox" })]);
      const [reports, incidents, sandbox, loops] = await Promise.all([
        db().select().from(t.threatReports).where(and(eq(t.threatReports.tenantId, tid), isNull(t.threatReports.campaignRecipientId))),
        db().select().from(t.incidents).where(eq(t.incidents.tenantId, tid)),
        db().select().from(t.sandboxAnalyses).where(eq(t.sandboxAnalyses.tenantId, tid)),
        db().select().from(t.loops).where(eq(t.loops.tenantId, tid)),
      ]);
      const rows: Cell[][] = [
        ...reports.filter((x) => within(x.createdAt, r)).map((x) => [c("threatReport"), `TR-${x.number}`, x.subject, x.severity ? tc(`severity.${x.severity}`) : "", ts(`threats.statuses.${x.status}`), x.createdAt] as Cell[]),
        ...incidents.filter((x) => within(x.createdAt, r)).map((x) => [c("incident"), `IR-${x.number}`, x.title, tc(`severity.${x.severity}`), ts(`incidents.statuses.${x.status}`), x.createdAt] as Cell[]),
        ...sandbox.filter((x) => within(x.createdAt, r)).map((x) => [c("sandbox"), `SB-${x.number}`, x.objectName, `${tsb(`verdict.${x.verdict}`)} (${x.score})`, x.incidentId ? c("escalated") : "", x.createdAt] as Cell[]),
        ...loops.filter((x) => within(x.createdAt, r)).map((x) => [c("loop"), x.id.slice(0, 8), x.title, ts(`verdicts.${x.verdict}`), ts(`stages.${x.stage}`), x.createdAt] as Cell[]),
      ];
      return { title, headers: [c("type"), c("number"), c("title"), c("severity"), c("status"), c("created")], rows };
    }
  }
}

