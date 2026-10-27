import { notFound } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { MessageSquareHeart, Star } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { ReviewFeedback } from "@/components/secops/service";
import { pick } from "@/i18n/config";
import { cn } from "@/lib/cn";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("feedback") };
}

const TOPICS = ["all", "module", "platform", "idea"] as const;

/** Five stars as one image; `label` is the translated rating ("4.3 out of 5 stars"). */
function Stars({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <span role="img" className={cn("inline-flex gap-0.5", className)} aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={cn("size-3.5", i <= Math.round(value) ? "fill-reward-400 text-reward-400" : "text-line-strong")} />
      ))}
    </span>
  );
}

export default async function FeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  const v = await requirePermission("feedback.read");
  if (!hasFeature(v, "feedback")) notFound();
  const sp = await searchParams;
  const topic = TOPICS.includes(sp.topic as "all") ? (sp.topic as (typeof TOPICS)[number]) : "all";
  const locale = await getLocale();
  const [tr, ts, tn, format] = await Promise.all([getTranslations("secops.feedback"), getTranslations("secops"), getTranslations("admin.nav"), getFormatter()]);
  const all = await db().select().from(t.feedback).where(eq(t.feedback.tenantId, v.tenant.id)).orderBy(desc(t.feedback.createdAt));
  const list = all.filter((f) => topic === "all" || f.topic === topic);
  const modIds = [...new Set(all.map((f) => f.moduleId).filter((x): x is string => !!x))];
  const modules = modIds.length ? await db().select({ id: t.modules.id, title: t.modules.title }).from(t.modules).where(inArray(t.modules.id, modIds)) : [];
  const modTitle = new Map(modules.map((m) => [m.id, pick(m.title, locale)]));
  const people = await peopleById(v.tenant.id, list.map((f) => f.userId));
  const avg = all.length ? all.reduce((s, f) => s + f.rating, 0) / all.length : 0;
  const dist = [5, 4, 3, 2, 1].map((r) => ({ r, n: all.filter((f) => f.rating === r).length }));
  const byModule = modIds
    .map((id) => {
      const rows = all.filter((f) => f.moduleId === id);
      return { id, title: modTitle.get(id) ?? "—", n: rows.length, avg: rows.reduce((s, f) => s + f.rating, 0) / rows.length };
    })
    .sort((a, b) => a.avg - b.avg);

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("feedback")} subtitle={tr("subtitle")} icon={<MessageSquareHeart />} />
      {all.length ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card>
            <CardHeader title={tr("average")} />
            <CardBody className="grid gap-4 pt-3">
              <div className="flex items-end gap-3">
                <span className="text-display font-bold tabular-nums">{format.number(avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                <span className="pb-2">
                  <Stars value={avg} label={tr("stars", { value: Math.round(avg * 10) / 10 })} />
                  <span className="block text-caption text-ink-muted">{tr("count", { count: all.length })}</span>
                </span>
              </div>
              <ul className="grid gap-1.5">
                {dist.map((d) => (
                  <li key={d.r} className="flex items-center gap-2 text-caption">
                    <span className="w-3 tabular-nums">{d.r}</span>
                    <Star className="size-3.5 fill-reward-400 text-reward-400" />
                    <span className="h-2 flex-1 overflow-hidden rounded-pill bg-sunken">
                      <span className="block h-full rounded-pill bg-reward-400" style={{ width: `${(d.n / all.length) * 100}%` }} />
                    </span>
                    <span className="w-6 text-end text-ink-muted tabular-nums">{d.n}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tr("byModule")} />
            <CardBody className="pt-3">
              <ul className="divide-y divide-line">
                {byModule.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2 text-caption">
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
                    <Stars value={m.avg} label={tr("stars", { value: Math.round(m.avg * 10) / 10 })} />
                    <span className="w-8 text-end tabular-nums">{format.number(m.avg, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                    <span className="shrink-0 text-end whitespace-nowrap text-ink-subtle tabular-nums">{tr("count", { count: m.n })}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      ) : null}
      <TabsNav items={TOPICS.map((k) => ({ href: `?topic=${k}`, label: tr(`topics.${k}`), active: topic === k, count: k === "all" ? all.length : all.filter((f) => f.topic === k).length }))} />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs">
              <Stars value={f.rating} label={tr("stars", { value: f.rating })} className="mt-1" />
              <div className="min-w-0 flex-[1_1_12rem]">
                <p className={cn("text-body-sm break-words", !f.comment && "text-ink-subtle italic")}>{f.comment ?? tr("noComment")}</p>
                <p className="mt-1 text-tab text-ink-subtle">
                  {f.userId ? (people.get(f.userId)?.name ?? ts("unknownPerson")) : ts("anonymous")} · {tr(`topics.${f.topic}`)}
                  {f.moduleId ? ` · ${modTitle.get(f.moduleId) ?? ""}` : ""} · {format.dateTime(f.createdAt, { dateStyle: "medium" })}
                </p>
              </div>
              {f.status === "reviewed" ? <Pill tone="safe">{tr("reviewed")}</Pill> : <ReviewFeedback id={f.id} />}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MessageSquareHeart />} title={tr("empty")} />
      )}
    </div>
  );
}
