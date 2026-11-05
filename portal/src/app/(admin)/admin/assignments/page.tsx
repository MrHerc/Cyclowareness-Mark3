import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { Building2, CalendarDays, ClipboardList, Globe, Route, User } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { assignmentTargets } from "@/server/services/assignments";
import { getDepartments, scopeDepartmentIds } from "@/server/queries/admin";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ProgressBar } from "@/components/ui/progress";
import { ModuleIcon } from "@/components/learner/module-icon";
import { AssignDialog } from "@/components/admin/assign-dialog";
import { AssignmentRowActions } from "@/components/admin/assignment-row-actions";
import type { Category } from "@/lib/domain/catalog";
import { dayAt } from "@/lib/time";
import { pick } from "@/i18n/config";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("assignments") };
}

export default async function AssignmentsPage() {
  const v = await requirePermission("assignments.read");
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("admin.assignments"), getTranslations("common"), getFormatter()]);
  const [allRows, targets, modules, paths, departments, allPeople] = await Promise.all([
    db().select().from(t.assignments).where(eq(t.assignments.tenantId, v.tenant.id)).orderBy(desc(t.assignments.createdAt)),
    assignmentTargets(db(), v.tenant.id),
    db()
      .select()
      .from(t.modules)
      .where(and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)), eq(t.modules.status, "published"))),
    db().select().from(t.learningPaths).where(or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, v.tenant.id))),
    getDepartments(v.tenant.id),
    db().select({ id: t.users.id, name: t.users.name, departmentId: t.users.departmentId }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"))),
  ]);
  // Department heads see only the people inside their departments: individual assignments to others are
  // hidden and the completion counts cover their people only.
  const scope = await scopeDepartmentIds(v);
  const people = scope ? allPeople.filter((p) => p.departmentId && scope.has(p.departmentId)) : allPeople;
  const visible = new Set(people.map((p) => p.id));
  const whoById = new Map(allRows.map((a) => [a.id, [...(targets.get(a.id) ?? new Set<string>())].filter((uid) => !scope || visible.has(uid))]));
  // A head sees organisation-wide rows, their own departments' rows and any row that reaches one of their people.
  const rows = scope
    ? allRows.filter((a) => (a.scope !== "department" && a.scope !== "user") || (a.scope === "department" && !!a.departmentId && scope.has(a.departmentId)) || (whoById.get(a.id)?.length ?? 0) > 0)
    : allRows;
  const modById = new Map(modules.map((m) => [m.id, m]));
  const pathById = new Map(paths.map((p) => [p.id, p]));
  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const personById = new Map(people.map((p) => [p.id, p.name]));
  // Completion per assignment: targeted people who completed every module it covers.
  const allTargetIds = [...new Set([...targets.values()].flatMap((s) => [...s]))];
  const completed = allTargetIds.length
    ? await db()
        .select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId })
        .from(t.moduleProgress)
        .where(and(inArray(t.moduleProgress.userId, allTargetIds), eq(t.moduleProgress.status, "completed")))
    : [];
  const doneSet = new Set(completed.map((c) => `${c.userId}:${c.moduleId}`));
  const slugToId = new Map(modules.map((m) => [m.slug, m.id]));
  const canWrite = allowed(v, "assignments.write");

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tr("title")}
        subtitle={tr("count", { count: rows.length })}
        actions={
          canWrite ? (
            <AssignDialog
              modules={modules.map((m) => ({ id: m.id, title: pick(m.title, locale), meta: tc("units.min", { count: m.minutes }) }))}
              paths={paths.map((p) => ({ id: p.id, title: pick(p.title, locale), meta: tc("units.modules", { count: p.moduleSlugs.length }) }))}
              departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              people={people.sort((a, b) => a.name.localeCompare(b.name, locale))}
            />
          ) : null
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardList />} title={tr("count", { count: 0 })} />
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((a) => {
            const mod = a.moduleId ? modById.get(a.moduleId) : null;
            const path = a.pathId ? pathById.get(a.pathId) : null;
            const moduleIds = mod ? [mod.id] : (path?.moduleSlugs.map((s) => slugToId.get(s)).filter((x): x is string => !!x) ?? []);
            const who = whoById.get(a.id) ?? [];
            const done = who.filter((uid) => moduleIds.every((m) => doneSet.has(`${uid}:${m}`))).length;
            const pct = who.length ? Math.round((done / who.length) * 100) : 0;
            return (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center gap-4 p-4">
                  {mod ? (
                    <ModuleIcon slug={mod.slug} category={mod.category as Category} />
                  ) : (
                    <span className="grid size-12 place-items-center rounded-md bg-[#f3eefe] text-[#6d28d9]">
                      <Route className="size-6" />
                    </span>
                  )}
                  <div className="min-w-0 flex-[1_1_12rem]">
                    <p className="text-body-sm font-semibold break-words">{pick(mod?.title ?? path?.title, locale)}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-tab text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        {a.scope === "everyone" ? <Globe className="size-3.5" /> : a.scope === "department" ? <Building2 className="size-3.5" /> : <User className="size-3.5" />}
                        {a.scope === "everyone" ? tr("everyone") : a.scope === "department" ? (deptById.get(a.departmentId ?? "") ?? "—") : (personById.get(a.userId ?? "") ?? "—")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {a.dueKind === "fixed" && a.dueDate
                          ? tr("due", { date: format.dateTime(dayAt(a.dueDate, v.tenant.settings.timeZone), { dateStyle: "medium" }) })
                          : a.dueKind === "after_joining"
                            ? tr("afterJoining", { days: a.dueDays ?? 0 })
                            : tr("noDue")}
                      </span>
                    </div>
                  </div>
                  <div className="flex w-56 items-center gap-2">
                    <span className="shrink-0 text-tab text-ink-muted">{tr("completedOf", { done, total: who.length })}</span>
                    <ProgressBar decorative value={pct} size="sm" />
                    <span className="text-tab font-bold">{tc("units.percent", { value: format.number(pct) })}</span>
                  </div>
                  {canWrite ? <AssignmentRowActions id={a.id} dueKind={a.dueKind} dueDate={a.dueDate} dueDays={a.dueDays} /> : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
