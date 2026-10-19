import { notFound } from "next/navigation";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { Route } from "lucide-react";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { formOptions } from "@/server/queries/secops-options";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { DeletePath, PathEditor, type PathDraft } from "@/components/secops/studio";
import { AssignDialog } from "@/components/admin/assign-dialog";
import { pick } from "@/i18n/config";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("paths") };
}

export default async function PathsAdminPage() {
  const v = await requirePermission("paths.write");
  if (!hasFeature(v, "paths")) notFound();
  const locale = await getLocale();
  const [tr, tn, tc] = await Promise.all([getTranslations("secops.paths"), getTranslations("admin.nav"), getTranslations("common")]);
  const [paths, modules, assignments, options] = await Promise.all([
    db().select().from(t.learningPaths).where(or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, v.tenant.id))),
    db()
      .select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title, minutes: t.modules.minutes, tenantId: t.modules.tenantId })
      .from(t.modules)
      .where(and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)), eq(t.modules.status, "published"))),
    db().select({ pathId: t.assignments.pathId }).from(t.assignments).where(and(eq(t.assignments.tenantId, v.tenant.id), isNotNull(t.assignments.pathId))),
    formOptions(v.tenant.id, locale),
  ]);
  const titleBySlug = new Map(modules.map((m) => [m.slug, pick(m.title, locale)]));
  const moduleOptions = [...titleBySlug.entries()].map(([slug, label]) => ({ slug, label })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const assignedCount = new Map<string, number>();
  for (const a of assignments) if (a.pathId) assignedCount.set(a.pathId, (assignedCount.get(a.pathId) ?? 0) + 1);
  const draftOf = (p: (typeof paths)[number], copy: boolean): PathDraft => ({
    id: copy ? null : p.id,
    title: pick(p.title, locale),
    description: pick(p.description, locale),
    audience: pick(p.audience, locale),
    recurrence: pick(p.recurrence, locale),
    standards: p.standards.join(", "),
    mandatory: p.mandatory,
    moduleSlugs: p.moduleSlugs.filter((s) => titleBySlug.has(s)),
  });
  const canAssign = allowed(v, "assignments.write");
  const assignProps = {
    modules: modules.map((m) => ({ id: m.id, title: pick(m.title, locale), meta: tc("units.min", { count: m.minutes }) })),
    paths: paths.map((p) => ({ id: p.id, title: pick(p.title, locale), meta: tc("units.modules", { count: p.moduleSlugs.length }) })),
    departments: options.departments.map((d) => ({ id: d.id, name: d.label })),
    people: options.people.map((p) => ({ id: p.id, name: p.name })),
  };
  const groups = [
    { key: "own", items: paths.filter((p) => p.tenantId) },
    { key: "library", items: paths.filter((p) => !p.tenantId) },
  ] as const;

  return (
    <div className="grid gap-6">
      <PageHeader title={tn("paths")} subtitle={tr("subtitle")} icon={<Route />} actions={<PathEditor initial={null} modules={moduleOptions} trigger="new" />} />
      {groups.map((g) => (
        <section key={g.key} className="grid gap-3">
          <h2 className="text-title-sm font-semibold">{tr(g.key)}</h2>
          {g.items.length ? (
            <ul className="grid gap-3 lg:grid-cols-2">
              {g.items.map((p) => (
                <li key={p.id}>
                  <Card className="h-full">
                    <CardBody className="flex h-full flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.mandatory ? <Pill tone="risk">{tr("mandatory")}</Pill> : null}
                        {p.standards.map((s) => (
                          <Pill key={s} tone="cyan">
                            {s}
                          </Pill>
                        ))}
                        <span className="ml-auto text-tab text-ink-subtle">{tr("assigned", { count: assignedCount.get(p.id) ?? 0 })}</span>
                      </div>
                      <div>
                        <p className="text-body font-semibold">{pick(p.title, locale)}</p>
                        <p className="mt-1 text-caption text-ink-muted">{pick(p.description, locale)}</p>
                      </div>
                      <ol className="flex flex-wrap gap-1.5 text-tab">
                        {p.moduleSlugs.map((s, i) => (
                          <li key={s} className="rounded-pill bg-sunken px-2.5 py-1 text-ink-muted">
                            {i + 1}. {titleBySlug.get(s) ?? s}
                          </li>
                        ))}
                      </ol>
                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <span className="mr-auto text-caption text-ink-muted">
                          {tr("modules", { count: p.moduleSlugs.length })}
                          {pick(p.recurrence, locale) ? ` · ${pick(p.recurrence, locale)}` : ""}
                        </span>
                        {canAssign ? <AssignDialog {...assignProps} preset={{ target: "path", targetId: p.id }} label={tr("assign")} /> : null}
                        {p.tenantId ? (
                          <>
                            <PathEditor initial={draftOf(p, false)} modules={moduleOptions} trigger="edit" />
                            <DeletePath id={p.id} />
                          </>
                        ) : (
                          <PathEditor initial={draftOf(p, true)} modules={moduleOptions} trigger="duplicate" />
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <EmptyState icon={<Route />} title={tr("new")} action={<PathEditor initial={null} modules={moduleOptions} trigger="new" />} />
            </Card>
          )}
        </section>
      ))}
    </div>
  );
}
