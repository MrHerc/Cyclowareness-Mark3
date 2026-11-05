import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { db } from "@/server/db";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { buildReport, parseReportFilters } from "@/server/reports/build";
import { audit } from "@/server/services/audit";
import { REPORT_KINDS, type ReportKind } from "@/server/db/schema";
import { DocHeader, ReportSection } from "@/components/admin/report-document";
import { PrintToolbar } from "@/components/admin/print-toolbar";
import { Notice } from "@/components/ui/layout";
import { dayAt } from "@/lib/time";

/** The title is what the browser's "Save as PDF" suggests as the file name. */
export async function generateMetadata({ params }: PageProps<"/print/report/[kind]">) {
  const { kind } = await params;
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) return { robots: { index: false } };
  const tr = await getTranslations("admin.reports");
  return { title: tr(`kinds.${kind as ReportKind}.title`), robots: { index: false } };
}

export default async function PrintReport({ params, searchParams }: PageProps<"/print/report/[kind]">) {
  const [{ kind }, sp] = await Promise.all([params, searchParams]);
  const v = await requirePermission("reports.read");
  if (!hasFeature(v, "reports") || !(REPORT_KINDS as readonly string[]).includes(kind) || (kind === "secops" && !allowed(v, "secops.read"))) notFound();
  const locale = await getLocale();
  const [tr, format] = await Promise.all([getTranslations("admin.reports"), getFormatter()]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  // The header, the rows and the audit entry all use the filters the report applies; a period it would
  // ignore (2026-13-01, a start after the end) is refused, never printed as all-time data under that label.
  const { filters, rejected } = parseReportFilters({ from: str("from"), to: str("to"), d: str("d") });
  if (rejected) {
    return (
      <main className="mx-auto max-w-2xl px-8 py-12">
        <Notice tone="warn" icon={<AlertTriangle />} title={tr("filtersRejectedTitle")}>
          {tr("filtersRejected")}
        </Notice>
      </main>
    );
  }
  const report = await buildReport(v, kind as ReportKind, filters, locale);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "report.downloaded", meta: { kind, format: "pdf", ...filters } });
  const day = (s?: string) => (s ? format.dateTime(dayAt(s, v.tenant.settings.timeZone), { dateStyle: "long" }) : "…");
  const period = filters.from || filters.to ? tr("period", { from: day(filters.from), to: day(filters.to) }) : tr("allTime");
  return (
    <>
      <PrintToolbar label={tr("print")} />
      <main className="mx-auto max-w-5xl px-8 py-8 print:max-w-none print:p-0">
        <DocHeader org={v.tenant.name} title={report.title} sub={`${period} · ${tr("generatedAt", { date: format.dateTime(new Date(), { dateStyle: "long", timeStyle: "short" }) })}`} logo={v.tenant.branding.logoUrl} />
        <ReportSection title={report.title} headers={report.headers} rows={report.rows} formatDate={(d) => format.dateTime(d, { dateStyle: "short", timeStyle: "short" })} formatDay={(day) => format.dateTime(dayAt(day, v.tenant.settings.timeZone), { dateStyle: "short" })} formatNumber={(n) => format.number(n)} empty={tr("compliance.none")} />
      </main>
    </>
  );
}
