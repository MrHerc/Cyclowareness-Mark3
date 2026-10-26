import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ProblemStatus } from "@/components/admin/problem-status";
import { cn } from "@/lib/cn";
import { pick } from "@/i18n/config";

const STATUSES = ["new", "in_progress", "resolved", "not_a_problem"] as const;
const LESSON_CONTEXT = /^lesson:([^/#]+)\/([^#]+)/;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("problems") };
}

export default async function ProblemsPage({ searchParams }: PageProps<"/admin/problems">) {
  const v = await requirePermission("problems.manage");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : "new";
  const [tr, format, locale] = await Promise.all([getTranslations("admin.problems"), getAppFormatter(), getLocale()]);
  const [counts, rows] = await Promise.all([
    db().select({ status: t.problemReports.status, n: count() }).from(t.problemReports).where(eq(t.problemReports.tenantId, v.tenant.id)).groupBy(t.problemReports.status),
    db()
      .select({ p: t.problemReports, name: t.users.name })
      .from(t.problemReports)
      .leftJoin(t.users, eq(t.users.id, t.problemReports.userId))
      .where(eq(t.problemReports.tenantId, v.tenant.id))
      .orderBy(desc(t.problemReports.createdAt)),
  ]);
  const countMap = new Map(counts.map((c) => [c.status, Number(c.n)]));
  const list = rows.filter((r) => r.p.status === status);
  // The player reports "lesson:<module slug>/<lesson key>#<scene>", other screens "page:<path>": shown as names in the console's language.
  const slugs = [...new Set(list.flatMap(({ p }) => LESSON_CONTEXT.exec(p.context ?? "")?.[1] ?? []))];
  const lessonRows = slugs.length
    ? await db()
        .select({ slug: t.modules.slug, tenantId: t.modules.tenantId, module: t.modules.title, key: t.lessons.key, lesson: t.lessons.title })
        .from(t.lessons)
        .innerJoin(t.modules, eq(t.modules.id, t.lessons.moduleId))
        .where(and(inArray(t.modules.slug, slugs), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))))
    : [];
  // A tenant's own module with the same slug replaces the library one.
  const lessonByRef = new Map<string, (typeof lessonRows)[number]>();
  for (const r of lessonRows) if (!lessonByRef.has(`${r.slug}/${r.key}`) || r.tenantId) lessonByRef.set(`${r.slug}/${r.key}`, r);
  const where = (context: string) => {
    const lesson = LESSON_CONTEXT.exec(context);
    const found = lesson ? lessonByRef.get(`${lesson[1]}/${lesson[2]}`) : undefined;
    if (found) return tr("contextLesson", { lesson: pick(found.lesson, locale), module: pick(found.module, locale) });
    if (context.startsWith("page:")) return tr("contextPage", { path: context.slice(5) });
    return context;
  };
  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn("rounded-xl border p-4 transition-colors", s === status ? "border-brand-600 bg-surface ring-2 ring-brand-100" : "border-transparent bg-sunken hover:bg-line/60")}
          >
            <p className="text-caption font-semibold text-ink-muted">{tr(`status.${s}`)}</p>
            <p className="mt-1 text-title font-bold tabular-nums">{countMap.get(s) ?? 0}</p>
          </Link>
        ))}
      </div>
      {list.length ? (
        <ul className="grid gap-3">
          {list.map(({ p, name }) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm">{p.message}</p>
                  <p className="mt-1.5 text-tab text-ink-subtle">
                    {tr("from", { name: name ?? tr("anonymous") })} · {format.relativeTime(p.createdAt)}
                    {p.context ? (
                      <>
                        {" · "}
                        <span title={p.context}>
                          {tr("context")}: {where(p.context)}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <ProblemStatus id={p.id} status={p.status} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<Inbox />} title={status === "new" ? tr("emptyNew") : tr("empty")} body={tr("emptyBody")} />
        </Card>
      )}
    </div>
  );
}
