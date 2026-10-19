import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Landmark, Radar } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { formOptions } from "@/server/queries/secops-options";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { IntelActions } from "@/components/secops/intake";

const STATUSES = ["all", "new", "reviewed", "converted", "dismissed"] as const;
const SEV_TONE = { low: "neutral", medium: "warn", high: "risk", critical: "risk" } as const;

export async function generateMetadata({ searchParams }: PageProps<"/admin/intel">) {
  const sp = await searchParams;
  const tr = await getTranslations("admin.nav");
  return { title: tr(sp.kind === "policy" ? "policyIntel" : "threatIntel") };
}

export default async function IntelPage({ searchParams }: PageProps<"/admin/intel">) {
  const v = await requirePermission("intel.read");
  const sp = await searchParams;
  const kind = sp.kind === "policy" ? "policy" : "threat";
  if (!hasFeature(v, kind === "policy" ? "policy_intel" : "threat_intel")) notFound();
  const status = STATUSES.includes(sp.status as "all") ? (sp.status as (typeof STATUSES)[number]) : "all";
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("secops.intel"), getTranslations("common"), getFormatter()]);
  const all = await db()
    .select()
    .from(t.intelItems)
    .where(and(eq(t.intelItems.tenantId, v.tenant.id), eq(t.intelItems.kind, kind)))
    .orderBy(desc(t.intelItems.publishedAt));
  const list = all.filter((i) => status === "all" || i.status === status);
  const options = await formOptions(v.tenant.id, locale);
  const canConvert = kind === "policy" ? hasFeature(v, "policies") : hasFeature(v, "closed_loops") && hasFeature(v, "approvals");

  return (
    <div className="grid gap-5">
      <PageHeader title={kind === "policy" ? tr("policyTitle") : tr("threatTitle")} subtitle={kind === "policy" ? tr("policySubtitle") : tr("threatSubtitle")} icon={kind === "policy" ? <Landmark /> : <Radar />} />
      <TabsNav items={STATUSES.map((s) => ({ href: `?kind=${kind}&status=${s}`, label: tr(`statuses.${s}`), active: status === s, count: s === "all" ? all.length : all.filter((i) => i.status === s).length }))} />
      {list.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {list.map((i) => (
            <li key={i.id}>
              <Card className="h-full">
                <CardBody className="flex h-full flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={SEV_TONE[i.severity]}>{tc(`severity.${i.severity}`)}</Pill>
                    <Pill tone={i.status === "new" ? "brand" : i.status === "converted" ? "safe" : "neutral"}>{tr(`statuses.${i.status}`)}</Pill>
                    {i.jurisdiction ? <Pill tone="cyan">{i.jurisdiction}</Pill> : null}
                    <span className="ml-auto text-tab text-ink-subtle">{tr("published", { date: format.dateTime(i.publishedAt, { dateStyle: "medium" }) })}</span>
                  </div>
                  <h2 className="text-title-sm font-semibold">{i.title}</h2>
                  <p className="text-body-sm text-ink-muted">{i.summary}</p>
                  {i.effectiveDate ? <p className="text-caption font-semibold text-ink">{tr("effective", { date: format.dateTime(new Date(`${i.effectiveDate}T12:00:00`), { dateStyle: "long" }) })}</p> : null}
                  <div className="flex flex-wrap items-center gap-1.5 text-tab">
                    {i.tags.map((tag) => (
                      <span key={tag} className="rounded-xs bg-sunken px-2 py-0.5 font-mono text-ink-muted">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                    <span className="text-caption text-ink-muted">
                      {tr("source")}:{" "}
                      {i.sourceUrl ? (
                        <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
                          {i.sourceName}
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <b>{i.sourceName}</b>
                      )}
                    </span>
                    {i.status === "converted" ? (
                      i.loopId ? (
                        <Link href={`/admin/loops/${i.loopId}`} className="text-caption font-semibold text-brand-600 hover:underline">
                          {tr("openLoop")} →
                        </Link>
                      ) : i.policyId ? (
                        <Link href={`/admin/policies/${i.policyId}`} className="text-caption font-semibold text-brand-600 hover:underline">
                          {tr("openPolicy")} →
                        </Link>
                      ) : null
                    ) : (
                      <IntelActions id={i.id} kind={kind} status={i.status} modules={options.modules} departments={options.departments} canConvert={canConvert} />
                    )}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={kind === "policy" ? <Landmark /> : <Radar />} title={tr("empty")} />
      )}
    </div>
  );
}
