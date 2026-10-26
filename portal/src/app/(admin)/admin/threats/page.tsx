import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { Inbox, Link2, ShieldCheck } from "lucide-react";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { ReportActions } from "@/components/secops/intake";
import { defang } from "@/lib/defang";
import { cn } from "@/lib/cn";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("threats") };
}

const STATUSES = ["new", "triaged", "converted", "dismissed", "all"] as const;
const STATUS_TONE = { new: "warn", triaged: "brand", converted: "safe", dismissed: "neutral" } as const;

export default async function ThreatsPage({ searchParams }: PageProps<"/admin/threats">) {
  const v = await requirePermission("secops.read");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as "new") ? (sp.status as (typeof STATUSES)[number]) : "new";
  const focus = typeof sp.focus === "string" ? sp.focus : null;
  const [tr, ts, tn, tc, tch, format] = await Promise.all([getTranslations("secops.threats"), getTranslations("secops"), getTranslations("admin.nav"), getTranslations("common"), getTranslations("security.report.channels"), getAppFormatter()]);
  const all = await db().select().from(t.threatReports).where(eq(t.threatReports.tenantId, v.tenant.id)).orderBy(desc(t.threatReports.createdAt)).limit(500);
  const list = all.filter((r) => status === "all" || r.status === status || r.id === focus);
  const people = await peopleById(v.tenant.id, list.map((r) => r.reporterId));
  const canWrite = allowed(v, "secops.write");

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("threats")} subtitle={tr("subtitle")} icon={<Inbox />} />
      <TabsNav items={STATUSES.map((s) => ({ href: `?status=${s}`, label: tr(`statuses.${s}`), active: status === s, count: s === "all" ? all.length : all.filter((r) => r.status === s).length }))} />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((r) => {
            const who = r.reporterId ? people.get(r.reporterId) : null;
            return (
              <li key={r.id} id={r.id} className={cn("grid gap-3 rounded-xl border bg-surface p-5 shadow-xs", r.id === focus ? "border-brand-300 ring-2 ring-brand-100" : "border-line")}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="font-mono text-tab text-ink-subtle">TR-{r.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold break-words">{r.subject}</p>
                    <p className="mt-1 text-caption text-ink-muted">
                      {/* Every report is filed by a signed-in employee; no reporter means the account was deleted since. */}
                      {tr("reporter")}: {who?.name ?? ts("unknownPerson")}
                      {who?.departmentName ? ` · ${who.departmentName}` : ""} · {tch(r.channel)} · {format.relativeTime(r.createdAt)}
                    </p>
                  </div>
                  {r.campaignRecipientId ? (
                    <Pill tone="safe" title={tr("simulationHint")}>
                      <ShieldCheck className="size-3.5" />
                      {tr("simulation")}
                    </Pill>
                  ) : null}
                  {r.severity ? <Pill tone={r.severity === "high" || r.severity === "critical" ? "risk" : r.severity === "medium" ? "warn" : "neutral"}>{tc(`severity.${r.severity}`)}</Pill> : null}
                  <Pill tone={STATUS_TONE[r.status]}>{tr(`statuses.${r.status}`)}</Pill>
                </div>
                {r.url ? (
                  <p className="flex items-center gap-2 rounded-md bg-sunken px-3 py-2 font-mono text-caption break-all">
                    <Link2 className="size-4 shrink-0 text-ink-subtle" />
                    {defang(r.url)}
                  </p>
                ) : null}
                {r.details ? <p className="text-body-sm whitespace-pre-line text-ink-muted">{r.details}</p> : null}
                {canWrite && !r.campaignRecipientId ? <ReportActions report={{ id: r.id, status: r.status, severity: r.severity, subject: r.subject, url: r.url }} incidentsOn={hasFeature(v, "incidents")} sandboxOn={hasFeature(v, "sandbox")} loopsOn={hasFeature(v, "closed_loops")} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Inbox />} title={tr("empty")} />
      )}
    </div>
  );
}
