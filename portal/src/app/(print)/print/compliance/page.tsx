import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, t } from "@/server/db";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { buildReport, buildRiskStory, parseReportFilters, scopedPeople } from "@/server/reports/build";
import { audit } from "@/server/services/audit";
import { DocHeader, ReportSection } from "@/components/admin/report-document";
import { PrintToolbar } from "@/components/admin/print-toolbar";
import { Notice } from "@/components/ui/layout";
import { pick } from "@/i18n/config";
import { dayAt } from "@/lib/time";

/** The title is what the browser's "Save as PDF" suggests as the file name. */
export async function generateMetadata() {
  const tr = await getTranslations("admin.reports");
  return { title: tr("compliance.title"), robots: { index: false } };
}

/** Compliance pack: one document for auditors. */
export default async function CompliancePack({ searchParams }: PageProps<"/print/compliance">) {
  const sp = await searchParams;
  const v = await requirePermission("reports.read");
  if (!hasFeature(v, "compliance_pack")) notFound();
  const locale = await getLocale();
  const [tr, format] = await Promise.all([getTranslations("admin.reports"), getFormatter()]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  // Every section, the period header and the audit entry use the filters the reports apply; a period they
  // would ignore (2026-13-01, a start after the end) is refused, never shown to auditors as that period.
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
  const [story, completion, confirmations, simulations, risk] = await Promise.all([
    buildRiskStory(v, filters, locale),
    buildReport(v, "completion", filters, locale),
    buildReport(v, "confirmations", filters, locale),
    buildReport(v, "simulations", filters, locale),
    buildReport(v, "risk", filters, locale),
  ]);
  const s = v.tenant.settings;
  const yes = tr("cols.yes");
  const no = tr("cols.no");
  const settingRows: [string, string][] = [
    [tr("compliance.settingRows.twofa"), s.identity.requireAdmin2fa ? yes : no],
    [tr("compliance.settingRows.protection"), s.protection.contentProtection ? yes : no],
    [tr("compliance.settingRows.watermark"), s.protection.watermark ? yes : no],
    [tr("compliance.settingRows.timeLimits"), s.learning.timeLimits ? yes : no],
    [tr("compliance.settingRows.refresher", { value: s.learning.riskThreshold }), s.learning.refresher ? yes : no],
    [tr("compliance.settingRows.sso"), s.identity.ssoEnabled ? yes : no],
    [tr("compliance.settingRows.email"), s.email.enabled ? yes : no],
  ];
  // Cross-check: modules marked completed must each have a stored attestation (same people as the sections above).
  const { users } = await scopedPeople(v, filters);
  const ids = users.map((u) => u.id);
  const [completed, attests] = ids.length
    ? await Promise.all([
        db().select({ userId: t.moduleProgress.userId, moduleId: t.moduleProgress.moduleId, title: t.modules.title }).from(t.moduleProgress).innerJoin(t.modules, eq(t.modules.id, t.moduleProgress.moduleId)).where(and(inArray(t.moduleProgress.userId, ids), eq(t.moduleProgress.status, "completed"))),
        db().select({ userId: t.attestations.userId, moduleId: t.attestations.moduleId }).from(t.attestations).where(inArray(t.attestations.userId, ids)),
      ])
    : [[], []];
  const attested = new Set(attests.map((a) => `${a.userId}:${a.moduleId}`));
  const names = new Map(users.map((u) => [u.id, u.name]));
  const gaps = completed.filter((c) => !attested.has(`${c.userId}:${c.moduleId}`)).map((c) => [names.get(c.userId) ?? "", pick(c.title, locale)]);
  if (allowed(v, "reports.read")) await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "report.compliance_pack", meta: filters });
  const fd = (d: Date) => format.dateTime(d, { dateStyle: "short", timeStyle: "short" });
  const fdy = (day: string) => format.dateTime(dayAt(day, v.tenant.settings.timeZone), { dateStyle: "short" });
  const fn = (n: number) => format.number(n);
  const day = (s?: string) => (s ? format.dateTime(dayAt(s, v.tenant.settings.timeZone), { dateStyle: "long" }) : "…");
  const period = filters.from || filters.to ? tr("period", { from: day(filters.from), to: day(filters.to) }) : tr("allTime");
  return (
    <>
      <PrintToolbar label={tr("print")} />
      <main className="mx-auto max-w-5xl px-8 py-8 print:max-w-none print:p-0">
        <DocHeader org={v.tenant.name} title={tr("compliance.title")} sub={`${period} · ${tr("generatedAt", { date: format.dateTime(new Date(), { dateStyle: "long", timeStyle: "short" }) })}`} logo={v.tenant.branding.logoUrl} />
        <ReportSection title={story.title} headers={story.headers} rows={story.rows} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
        <ReportSection title={tr("compliance.settings")} headers={[tr("compliance.settingCol"), tr("compliance.valueCol")]} rows={settingRows} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
        <ReportSection title={tr("compliance.training")} headers={completion.headers} rows={completion.rows} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
        <ReportSection title={tr("compliance.confirmations")} headers={confirmations.headers} rows={confirmations.rows} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
        <ReportSection title={tr("compliance.crosscheck")} headers={[tr("cols.person"), tr("cols.module")]} rows={gaps} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
        <ReportSection title={tr("compliance.simulations")} headers={simulations.headers} rows={simulations.rows} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
        <ReportSection title={tr("compliance.risk")} headers={risk.headers} rows={risk.rows} formatDate={fd} formatDay={fdy} formatNumber={fn} empty={tr("compliance.none")} />
      </main>
    </>
  );
}
