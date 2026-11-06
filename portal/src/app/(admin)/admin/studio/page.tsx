import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Wand2 } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { aiEnabled } from "@/server/ai";
import { formOptions } from "@/server/queries/secops-options";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { MaterialForm, ModuleRowActions, StudioLessonForm } from "@/components/secops/studio";
import { AiTrainer } from "@/components/admin/ai-trainer/ai-trainer";
import { ScormExport } from "@/components/admin/scorm-export";
import { TRAINING_LOCALES } from "@/server/ai-verify";
import { CATEGORIES } from "@/lib/domain/catalog";
import { isLocale, pick } from "@/i18n/config";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("studio") };
}

const TABS = ["lessons", "materials"] as const;

export default async function StudioPage({ searchParams }: PageProps<"/admin/studio">) {
  const v = await requirePermission("studio.write");
  if (!hasFeature(v, "studio")) notFound();
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as "lessons") ? (sp.tab as (typeof TABS)[number]) : "lessons";
  const locale = await getLocale();
  const [tr, ta, tn, tc, format] = await Promise.all([getTranslations("secops.studio"), getTranslations("secops.approvals"), getTranslations("admin.nav"), getTranslations("common"), getFormatter()]);
  const [own, materials, options, exportable] = await Promise.all([
    db()
      .select()
      .from(t.modules)
      .where(and(eq(t.modules.tenantId, v.tenant.id), ne(t.modules.origin, "library")))
      .orderBy(desc(t.modules.createdAt)),
    db().select().from(t.materials).where(eq(t.materials.tenantId, v.tenant.id)).orderBy(desc(t.materials.createdAt)).limit(100),
    formOptions(v.tenant.id, locale),
    // The library's modules and the organisation's own: what a SCORM export may package.
    db()
      .select({ id: t.modules.id, title: t.modules.title })
      .from(t.modules)
      .where(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)))
      .orderBy(asc(t.modules.sortOrder)),
  ]);
  const lessons = own.length
    ? await db().select({ moduleId: t.lessons.moduleId, key: t.lessons.key }).from(t.lessons).where(inArray(t.lessons.moduleId, own.map((m) => m.id))).orderBy(asc(t.lessons.position))
    : [];
  const firstLesson = new Map<string, string>();
  for (const l of lessons) if (!firstLesson.has(l.moduleId)) firstLesson.set(l.moduleId, l.key);
  const categories = CATEGORIES.map((c) => ({ id: c, label: tc(`categories.${c}`) }));

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tn("studio")}
        subtitle={tr("subtitle")}
        icon={<Wand2 />}
        actions={
          <>
            {hasFeature(v, "approvals") ? <MaterialForm modules={options.modules} departments={options.departments} /> : null}
            <StudioLessonForm locales={v.tenant.settings.locales} defaultLocale={locale} categories={categories} aiOn={aiEnabled()} />
          </>
        }
      />
      <AiTrainer
        aiOn={aiEnabled()}
        locales={TRAINING_LOCALES.filter((l) => v.tenant.settings.locales.includes(l))}
        defaultLocale={locale}
        categories={categories}
      />
      <ScormExport modules={exportable.map((m) => ({ id: m.id, title: pick(m.title, locale) }))} defaultLocale={isLocale(locale) ? locale : "en"} />
      <TabsNav items={TABS.map((k) => ({ href: `?tab=${k}`, label: tr(`tabs.${k}`), active: tab === k, count: k === "lessons" ? own.length : materials.length }))} />
      {tab === "lessons" ? (
        own.length ? (
          <ul className="grid gap-3">
            {own.map((m) => {
              const first = firstLesson.get(m.id);
              return (
                <li key={m.id}>
                  <Card>
                    <CardBody className="flex flex-wrap items-center gap-4">
                      <div className="min-w-0 flex-[1_1_12rem]">
                        <p className="text-body font-semibold break-words">{pick(m.title, locale)}</p>
                        <p className="mt-1 text-caption text-ink-muted">
                          {tc(`categories.${m.category as "email"}`)} · {tc(`difficulty.${m.difficulty}`)} · {tc("units.min", { count: m.minutes })} · {format.dateTime(m.createdAt, { dateStyle: "medium" })}
                        </p>
                      </div>
                      <Pill tone={m.origin === "ai" ? "violet" : "brand"}>{tr(`origin.${m.origin as "custom"}`)}</Pill>
                      <Pill tone={m.status === "published" ? "safe" : "neutral"}>{tr(`status.${m.status}`)}</Pill>
                      <ModuleRowActions id={m.id} status={m.status} previewHref={first ? `/learn/${m.slug}/${first}` : null} />
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Wand2 />} title={tr("empty")} />
        )
      ) : materials.length ? (
        <ul className="grid gap-3">
          {materials.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/approvals?tab=${m.status === "pending" ? "pending" : m.status === "second_approval" ? "second" : "decided"}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-raised"
              >
                <span className="min-w-0 flex-[1_1_12rem]">
                  <b className="block truncate text-body-sm">{m.title}</b>
                  <span className="block truncate text-caption text-ink-muted">{m.body}</span>
                </span>
                <Pill tone={m.origin === "ai" ? "violet" : m.origin === "template" ? "cyan" : "brand"}>{ta(`origin.${m.origin}`)}</Pill>
                <Pill tone={m.status === "approved" ? "safe" : m.status === "rejected" ? "risk" : "warn"}>{ta(`status.${m.status}`)}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Wand2 />} title={tr("emptyMaterials")} />
      )}
    </div>
  );
}
