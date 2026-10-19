import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { count, desc, eq } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ProblemStatus } from "@/components/admin/problem-status";
import { cn } from "@/lib/cn";

const STATUSES = ["new", "in_progress", "resolved", "not_a_problem"] as const;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("problems") };
}

export default async function ProblemsPage({ searchParams }: PageProps<"/admin/problems">) {
  const v = await requirePermission("problems.manage");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : "new";
  const [tr, format] = await Promise.all([getTranslations("admin.problems"), getFormatter()]);
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
                    {p.context ? ` · ${tr("context")}: ${p.context}` : ""}
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
