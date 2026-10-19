import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { LifeBuoy } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { requestNow } from "@/lib/time";
import { cn } from "@/lib/cn";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("support") };
}

const STATUSES = ["open", "in_progress", "answered", "closed", "all"] as const;
const PRIORITY_TONE = { low: "neutral", medium: "warn", high: "risk" } as const;

export default async function SupportDeskPage({ searchParams }: PageProps<"/admin/support">) {
  const v = await requirePermission("support.manage");
  if (!hasFeature(v, "support")) notFound();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as "open") ? (sp.status as (typeof STATUSES)[number]) : "open";
  const [tr, tn, format] = await Promise.all([getTranslations("secops.support"), getTranslations("admin.nav"), getFormatter()]);
  const all = await db().select().from(t.supportTickets).where(eq(t.supportTickets.tenantId, v.tenant.id)).orderBy(desc(t.supportTickets.updatedAt));
  const list = all.filter((x) => status === "all" || x.status === status).sort((a, b) => (status === "open" || status === "in_progress" ? a.slaDueAt.getTime() - b.slaDueAt.getTime() : 0));
  const people = await peopleById(v.tenant.id, list.map((x) => x.userId));
  const now = requestNow().getTime();

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("support")} subtitle={tr("subtitle")} icon={<LifeBuoy />} />
      <TabsNav items={STATUSES.map((s) => ({ href: `?status=${s}`, label: tr(`statuses.${s}`), active: status === s, count: s === "all" ? all.length : all.filter((x) => x.status === s).length }))} />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((x) => {
            const waiting = x.status === "open" || x.status === "in_progress";
            const late = waiting && x.slaDueAt.getTime() < now;
            const who = people.get(x.userId);
            return (
              <li key={x.id}>
                <Link href={`/admin/support/${x.id}`} className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-4 shadow-xs hover:shadow-raised", late ? "border-risk-100" : "border-line")}>
                  <span className="font-mono text-tab text-ink-subtle">#{x.number}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-body-sm">{x.subject}</b>
                    <span className="block truncate text-caption text-ink-muted">
                      {who?.name ?? "—"}
                      {who?.departmentName ? ` · ${who.departmentName}` : ""} · {tr(`category.${x.category}`)}
                    </span>
                  </span>
                  <Pill tone={PRIORITY_TONE[x.priority]}>{tr(`priority.${x.priority}`)}</Pill>
                  {waiting ? <Pill tone={late ? "risk" : "neutral"}>{late ? tr("overdue") : tr("dueIn", { time: format.relativeTime(x.slaDueAt) })}</Pill> : null}
                  <Pill tone={x.status === "answered" ? "safe" : x.status === "closed" ? "neutral" : "brand"}>{tr(`statuses.${x.status}`)}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<LifeBuoy />} title={tr("empty")} />
      )}
    </div>
  );
}
