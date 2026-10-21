import { isUuid } from "@/lib/ids";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { Recycle, Users } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { LOOP_STAGES } from "@/server/db/schema";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { StageTrack } from "@/components/secops/stage-track";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("loops") };
}

const VIEWS = ["open", "closed", "all"] as const;
const VERDICT_TONE = { malicious: "risk", suspicious: "warn", pending: "neutral", benign: "safe" } as const;

export default async function LoopsPage({ searchParams }: PageProps<"/admin/loops">) {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "closed_loops")) notFound();
  const sp = await searchParams;
  const view = VIEWS.includes(sp.view as "open") ? (sp.view as (typeof VIEWS)[number]) : "open";
  const [tr, ts, tn, format] = await Promise.all([getTranslations("secops.loops"), getTranslations("secops"), getTranslations("admin.nav"), getFormatter()]);
  const all = await db().select().from(t.loops).where(eq(t.loops.tenantId, v.tenant.id)).orderBy(desc(t.loops.updatedAt));
  const list = all.filter((l) => (view === "open" ? !l.closedAt : view === "closed" ? !!l.closedAt : true));
  const labels = Object.fromEntries(LOOP_STAGES.map((s) => [s, ts(`stages.${s}`)])) as Record<(typeof LOOP_STAGES)[number], string>;

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("loops")} subtitle={tr("subtitle")} icon={<Recycle />} />
      <TabsNav
        items={VIEWS.map((k) => ({
          href: `?view=${k}`,
          label: tr(k),
          active: view === k,
          count: k === "open" ? all.filter((l) => !l.closedAt).length : k === "closed" ? all.filter((l) => l.closedAt).length : all.length,
        }))}
      />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/loops/${l.id}`} className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-raised">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-ink">{l.title}</p>
                    <p className="mt-1 text-caption text-ink-muted">
                      {ts(`sources.${l.sourceType}`)}
                      {l.sourceId && !isUuid(l.sourceId) ? ` · ${l.sourceId}` : ""} · {l.closedAt ? tr("closedOn", { date: format.dateTime(l.closedAt, { dateStyle: "medium" }) }) : tr("openedOn", { date: format.dateTime(l.createdAt, { dateStyle: "medium" }) })}
                    </p>
                  </div>
                  <Pill tone={VERDICT_TONE[l.verdict]}>{ts(`verdicts.${l.verdict}`)}</Pill>
                  <Pill tone={l.closedAt ? "safe" : "brand"}>{l.closedAt ? tr("closed") : ts(`stages.${l.stage}`)}</Pill>
                  {l.trainedCount ? (
                    <span className="inline-flex items-center gap-1 text-caption font-semibold text-ink-muted">
                      <Users className="size-4" />
                      {tr("trained", { count: l.trainedCount })}
                    </span>
                  ) : null}
                </div>
                <StageTrack stage={l.stage} closed={!!l.closedAt} labels={labels} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Recycle />} title={tr("empty")} />
      )}
    </div>
  );
}
