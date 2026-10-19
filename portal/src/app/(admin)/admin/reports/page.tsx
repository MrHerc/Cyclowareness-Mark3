import { getLocale, getTranslations } from "next-intl/server";
import { and, avg, count, desc, eq, isNotNull } from "drizzle-orm";
import { FileDown, FileSpreadsheet, FileText, ShieldCheck, Star, AlertTriangle } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { getDepartments, scopeDepartmentIds } from "@/server/queries/admin";
import { REPORT_KINDS } from "@/server/db/schema";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/ui/layout";
import { CompliancePack, ReportFilters, Schedules } from "@/components/admin/reports-client";
import { requestNow } from "@/lib/time";
import { pick } from "@/i18n/config";

const DAY = 86_400_000;
/** YYYY-MM-DD in Baku time, the format the date inputs and report filters use. */
const isoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("reports") };
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const v = await requirePermission("reports.read");
  const sp = await searchParams;
  const locale = await getLocale();
  const tr = await getTranslations("admin.reports");
  const [departments, scope, feedback, schedules] = await Promise.all([
    getDepartments(v.tenant.id),
    scopeDepartmentIds(v),
    db()
      .select({ moduleId: t.feedback.moduleId, title: t.modules.title, r: avg(t.feedback.rating), n: count() })
      .from(t.feedback)
      .innerJoin(t.modules, eq(t.modules.id, t.feedback.moduleId))
      .where(and(eq(t.feedback.tenantId, v.tenant.id), isNotNull(t.feedback.moduleId)))
      .groupBy(t.feedback.moduleId, t.modules.title),
    db().select().from(t.reportSchedules).where(eq(t.reportSchedules.tenantId, v.tenant.id)).orderBy(desc(t.reportSchedules.createdAt)),
  ]);
  const visible = scope ? departments.filter((d) => scope.has(d.id)) : departments;
  // Without dates in the URL the filter covers the last 30 days up to today.
  const now = requestNow();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const from = str("from") ?? isoDay(new Date(now.getTime() - 30 * DAY));
  const to = str("to") ?? isoDay(now);
  const dept = str("d");
  const qs = new URLSearchParams({ from, to, ...(dept ? { d: dept } : {}) }).toString();
  const kinds = REPORT_KINDS.filter((k) => k !== "secops" || allowed(v, "secops.read"));
  const sorted = feedback.map((f) => ({ ...f, r: Number(f.r) })).sort((a, b) => a.r - b.r);

  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} />
      <ReportFilters departments={visible.map((d) => ({ id: d.id, name: d.name }))} defaults={{ from, to }} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kinds.map((k) => (
          <Card key={k} className="flex flex-col p-5">
            <p className="text-body font-bold">{tr(`kinds.${k}.title`)}</p>
            <p className="mt-1 flex-1 text-caption text-ink-muted">{tr(`kinds.${k}.body`)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonAnchor size="sm" variant="secondary" icon={<FileText />} href={`/api/admin/reports/${k}?format=csv${qs ? `&${qs}` : ""}`}>
                CSV
              </ButtonAnchor>
              <ButtonAnchor size="sm" variant="secondary" icon={<FileSpreadsheet />} href={`/api/admin/reports/${k}?format=xlsx${qs ? `&${qs}` : ""}`}>
                Excel
              </ButtonAnchor>
              <ButtonLink size="sm" variant="secondary" icon={<FileDown />} href={`/print/report/${k}${qs ? `?${qs}` : ""}`} target="_blank">
                PDF
              </ButtonLink>
            </div>
          </Card>
        ))}
        <Card className="flex flex-col border-brand-100 bg-brand-50/50 p-5">
          <p className="flex items-center gap-2 text-body font-bold">
            <ShieldCheck className="size-5 text-brand-600" />
            {tr("compliance.title")}
          </p>
          <p className="mt-1 flex-1 text-caption text-ink-muted">{tr("compliance.body")}</p>
          <CompliancePack defaults={{ from, to }} />
        </Card>
      </section>

      <Card>
        <CardHeader title={tr("moduleFeedback")} description={tr("moduleFeedbackSub")} />
        <CardBody className="pt-3">
          {sorted.length ? (
            <ul className="divide-y divide-line">
              {sorted.map((f) => (
                <li key={f.moduleId} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">{pick(f.title, locale)}</span>
                  <span className="text-tab text-ink-subtle">{tr("ratings", { count: Number(f.n) })}</span>
                  <span className="inline-flex w-14 items-center justify-end gap-1 font-bold tabular-nums">
                    <Star className="size-4 fill-laurel-500 text-laurel-600" />
                    {f.r.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ink-muted">{tr("noFeedback")}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tr("scheduled")} description={tr("scheduledSub")} />
        <CardBody className="grid gap-4 pt-3">
          {!v.tenant.settings.email.enabled ? (
            <Notice
              tone="warn"
              icon={<AlertTriangle />}
              action={
                allowed(v, "settings.write") ? (
                  <ButtonLink href="/admin/settings?tab=email" size="sm" variant="secondary">
                    {tr("openEmailSettings")}
                  </ButtonLink>
                ) : null
              }
            >
              {tr("emailMissing")}
            </Notice>
          ) : null}
          <Schedules
            kinds={kinds.map((k) => ({ key: k, title: tr(`kinds.${k}.title`) }))}
            departments={visible.map((d) => ({ id: d.id, name: d.name }))}
            schedules={schedules.map((s) => ({ id: s.id, kind: s.kind, format: s.format, frequency: s.frequency, day: s.day, recipients: s.recipients, lastSentAt: s.lastSentAt?.toISOString() ?? null }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
