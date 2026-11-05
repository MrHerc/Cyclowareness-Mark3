import { isUuid } from "@/lib/ids";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { GraduationCap, Lock, Siren } from "lucide-react";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { formOptions } from "@/server/queries/secops-options";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { NewIncident } from "@/components/secops/incident";
import { dayPlus } from "@/lib/time";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("incidents") };
}

const STATUSES = ["all", "open", "investigating", "resolved"] as const;
const SEV_TONE = { low: "neutral", medium: "warn", high: "risk", critical: "risk" } as const;

export default async function IncidentsPage({ searchParams }: PageProps<"/admin/incidents">) {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "incidents")) notFound();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as "all") ? (sp.status as (typeof STATUSES)[number]) : "all";
  const locale = await getLocale();
  const [tr, ts, tn, tc, format] = await Promise.all([getTranslations("secops.incidents"), getTranslations("secops"), getTranslations("admin.nav"), getTranslations("common"), getFormatter()]);
  const all = await db().select().from(t.incidents).where(eq(t.incidents.tenantId, v.tenant.id)).orderBy(desc(t.incidents.createdAt));
  const list = all.filter((i) => status === "all" || i.status === status);
  const canWrite = allowed(v, "secops.write");
  const options = canWrite ? await formOptions(v.tenant.id, locale) : null;
  const sbId = typeof sp.sandbox === "string" && isUuid(sp.sandbox) ? sp.sandbox : null;
  const [sb] = sbId ? await db().select().from(t.sandboxAnalyses).where(eq(t.sandboxAnalyses.id, sbId)) : [];
  const prefill = sb && sb.tenantId === v.tenant.id ? { title: `SB-${sb.number}: ${sb.objectName}`.slice(0, 300), severity: sb.verdict === "malicious" ? ("high" as const) : ("medium" as const), source: "sandbox" as const, iocs: sb.iocs.map((i) => i.value).join("\n"), mitre: sb.mitre.join(", "), sandboxId: sb.id } : undefined;

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tn("incidents")}
        subtitle={tr("subtitle")}
        icon={<Siren />}
        actions={options ? <NewIncident modules={options.modules} departments={options.departments} people={options.people} prefill={prefill} defaultOpen={!!prefill} defaultDue={dayPlus(7, v.tenant.settings.timeZone)} key={prefill?.sandboxId ?? "new"} /> : null}
      />
      <TabsNav items={STATUSES.map((s) => ({ href: `?status=${s}`, label: tr(`statuses.${s}`), active: status === s, count: s === "all" ? all.length : all.filter((i) => i.status === s).length }))} />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((i) => (
            <li key={i.id}>
              <Link href={`/admin/incidents/${i.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-raised">
                <span className="font-mono text-tab text-ink-subtle">IR-{i.number}</span>
                <div className="min-w-0 flex-[1_1_12rem]">
                  <p className="flex items-center gap-2 text-body font-semibold">
                    {i.confidential ? <Lock className="size-4 shrink-0 text-ink-subtle" aria-label={tr("confidential")} /> : null}
                    <span className="truncate">{i.title}</span>
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">
                    {ts(`sources.${i.source}`)} · {format.dateTime(i.createdAt, { dateStyle: "medium" })}
                    {i.targetUserIds.length ? ` · ${ts("people", { count: i.targetUserIds.length })}` : ""}
                  </p>
                </div>
                {i.live && i.status !== "resolved" ? <Pill tone="risk">{tr("live")}</Pill> : null}
                {i.autoTrainingAt ? (
                  <Pill tone="safe">
                    <GraduationCap aria-hidden className="size-3.5" />
                    {tr("assignedOn", { date: format.dateTime(i.autoTrainingAt, { day: "numeric", month: "short" }) })}
                  </Pill>
                ) : null}
                <Pill tone={SEV_TONE[i.severity]}>{tc(`severity.${i.severity}`)}</Pill>
                <Pill tone={i.status === "resolved" ? "safe" : i.status === "investigating" ? "brand" : "warn"}>{tr(`statuses.${i.status}`)}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Siren />} title={tr("empty")} />
      )}
    </div>
  );
}
