import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, FlaskConical, GraduationCap, Info, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { getCatalog, nextLesson } from "@/server/queries/catalog";
import { myRiskBreakdown, openRisks } from "@/server/queries/learner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader, Stat } from "@/components/ui/layout";
import { ReportButton } from "@/components/learner/report-button";
import { riskBand } from "@/lib/domain/risk";
import { REPORT_BONUS_XP } from "@/lib/domain/gamification";

export async function generateMetadata() {
  const tr = await getTranslations("security");
  return { title: tr("title") };
}

export default async function SecurityPage() {
  const v = await requireViewer();
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("security"), getTranslations("common"), getFormatter()]);
  const [risks, catalog, breakdown, reports] = await Promise.all([
    openRisks(v),
    getCatalog(v, locale),
    myRiskBreakdown(v),
    db()
      .select({ number: t.threatReports.number, subject: t.threatReports.subject, status: t.threatReports.status, createdAt: t.threatReports.createdAt, channel: t.threatReports.channel })
      .from(t.threatReports)
      .where(eq(t.threatReports.reporterId, v.user.id))
      .orderBy(desc(t.threatReports.createdAt))
      .limit(10),
  ]);
  const open = risks.filter((r) => r.status === "open");
  const closed = risks.filter((r) => r.status === "closed");
  const byModule = new Map(catalog.map((m) => [m.id, m]));
  const band = riskBand(v.user.riskScore);
  const parts = breakdown
    ? ([
        ["training", breakdown.parts.training, 30],
        ["overdue", breakdown.parts.overdue, 10],
        ["simulations", breakdown.parts.simulations, 35],
        ["openRisks", breakdown.parts.openRisks, 30],
        ["knowledge", breakdown.parts.knowledge, 16],
      ] as const)
    : [];

  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} icon={<ShieldCheck />} actions={<ReportButton variant="full" />} />
      <Notice tone="info" icon={<Info />}>
        {tr("notice")}
      </Notice>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={tr("openRisks")} value={open.length} icon={<AlertTriangle />} tone="risk" />
        <Stat label={tr("closedRisks")} value={closed.length} icon={<CheckCircle2 />} tone="safe" />
        <Stat label={tr("riskScore")} value={v.user.riskScore} icon={<ShieldCheck />} tone={band === "low" ? "safe" : band === "medium" ? "warn" : "risk"} trend={<Pill tone={band === "low" ? "safe" : band === "medium" ? "warn" : "risk"}>{tc(`risk.${band}`)}</Pill>} />
      </div>

      <section aria-labelledby="open-risks" className="grid gap-3">
        <h2 id="open-risks" className="text-tab-sm font-bold tracking-wide text-ink-muted uppercase">
          {tr("riskStatus.open")}
        </h2>
        {open.length === 0 ? (
          <Card>
            <EmptyState icon={<ShieldCheck />} title={tr("noRisksTitle")} body={tr("noRisksBody")} />
          </Card>
        ) : (
          open.map((r) => {
            const m = r.moduleId ? byModule.get(r.moduleId) : undefined;
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="violet">{tr(`kind.${r.kind}`)}</Pill>
                    <Pill tone={r.severity === "high" || r.severity === "critical" ? "risk" : r.severity === "medium" ? "warn" : "neutral"}>{tc(`severity.${r.severity}`)}</Pill>
                    <Pill tone="warn">{tr("riskStatus.open")}</Pill>
                  </div>
                  {r.dueDate ? (
                    <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                      <Clock className="size-4" />
                      {tr("dueOn", { date: format.dateTime(new Date(`${r.dueDate}T12:00:00`), { dateStyle: "medium" }) })}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-body font-semibold">{r.title}</p>
                {m ? (
                  <div className="mt-4 rounded-lg border border-line bg-sunken/60 p-4">
                    <p className="text-tab-sm font-bold tracking-wide text-ink-muted uppercase">{tr("closingTraining")}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <GraduationCap className="size-5 text-brand-600" />
                      <span className="min-w-0 flex-[1_1_12rem] text-body-sm font-semibold break-words">{m.title}</span>
                      <span className="text-caption font-bold tabular-nums">{m.percent}%</span>
                      {/* A module finished before the risk was opened is gone through again from the first lesson. */}
                      <ButtonLink href={`/learn/${m.slug}/${nextLesson(m).key}`} icon={<Play className="fill-current" />}>
                        {m.status === "completed" ? tr("retakeTraining") : m.percent ? tr("continueTraining") : tr("startTraining")}
                      </ButtonLink>
                    </div>
                    <ProgressBar decorative value={m.percent} size="sm" className="mt-3" />
                    {m.status === "completed" ? <p className="mt-2 text-caption text-ink-muted">{tr("retakeHint")}</p> : null}
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
        {closed.length ? (
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-caption font-semibold text-ink-muted">{tr("showClosed", { count: closed.length })}</summary>
            <ul className="mt-3 grid gap-2">
              {closed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-caption">
                  <span className="flex min-w-0 items-start gap-2 break-words">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-safe-600" />
                    {r.title}
                  </span>
                  {r.closedAt ? <span className="shrink-0 text-ink-subtle">{tr("closedOn", { date: format.dateTime(r.closedAt, { dateStyle: "medium" }) })}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr("why.title")} description={tr("why.hint")} />
          <CardBody className="grid gap-3">
            {parts.map(([key, value, max]) => (
              <div key={key}>
                <div className="flex justify-between text-caption">
                  <span>{tr(`why.${key}`)}</span>
                  <span className="font-bold tabular-nums">+{value}</span>
                </div>
                <ProgressBar decorative value={(value / max) * 100} size="sm" tone={value === 0 ? "safe" : value / max > 0.5 ? "risk" : "warn"} className="mt-1.5" />
              </div>
            ))}
          </CardBody>
        </Card>
        <div className="grid content-start gap-4">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-risk-50 text-risk-600">
                <ShieldAlert className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">{tr("report.cta")}</p>
                <p className="mt-0.5 text-caption text-ink-muted">{tr("report.ctaBody", { xp: REPORT_BONUS_XP })}</p>
              </div>
            </div>
            <ReportButton variant="full" className="mt-4 w-full justify-center" />
          </Card>
          {v.tenant.features.has("sandbox") ? (
            <Link href="/security/sandbox" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs hover:shadow-raised">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600">
                <FlaskConical className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold">{tr("sandbox.card")}</span>
                <span className="block text-caption text-ink-muted">{tr("sandbox.cardBody")}</span>
              </span>
              <ChevronRight className="size-5 text-ink-subtle" />
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader title={tr("myReports")} />
        <CardBody>
          {reports.length ? (
            <ul className="divide-y divide-line">
              {reports.map((r) => (
                <li key={r.number} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-mono text-tab text-ink-subtle">TR-{r.number}</span>
                  <span className="min-w-0 flex-1 text-body-sm">{r.subject}</span>
                  <Pill tone={r.status === "converted" ? "violet" : r.status === "triaged" ? "safe" : r.status === "dismissed" ? "neutral" : "brand"}>{tr(`reportStatus.${r.status}`)}</Pill>
                  <span className="text-tab text-ink-subtle">{format.relativeTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-ink-muted">{tr("noReports")}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
