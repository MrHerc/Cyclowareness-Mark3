import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { and, asc, count, desc, eq, gte, isNotNull } from "drizzle-orm";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  FlaskConical,
  GraduationCap,
  KeyRound,
  Mail,
  MessageSquare,
  Phone,
  Play,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Minus,
  Usb,
} from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { getCatalog, nextLesson } from "@/server/queries/catalog";
import { myRiskBreakdown, openRisks } from "@/server/queries/learner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill, type Tone } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ReportButton } from "@/components/learner/report-button";
import { Mascot } from "@/components/mascot/mascot";
import { BandScale, ScoreGauge } from "@/components/learner/security/score-gauge";
import { riskBand, type RiskBand } from "@/lib/domain/risk";
import { dayKey, REPORT_BONUS_XP } from "@/lib/domain/gamification";
import { cn } from "@/lib/cn";
import { riskTitle } from "@/lib/risk-title";

export async function generateMetadata() {
  const tr = await getTranslations("security");
  return { title: tr("title") };
}

const PARTS = [
  ["training", 30],
  ["overdue", 10],
  ["simulations", 35],
  ["openRisks", 30],
  ["knowledge", 16],
] as const;

type Part = (typeof PARTS)[number][0];
type SimOutcome = "submitted" | "clicked" | "reported" | "ignored";

const BAND_TONE: Record<RiskBand, Tone> = { low: "safe", medium: "warn", high: "risk" };
const BAND_MASCOT = {
  low: { mood: "proud", gesture: "shield-up" },
  medium: { mood: "curious", gesture: "ponder" },
  high: { mood: "worried", gesture: "point-down" },
} as const;
const OUTCOME_TONE: Record<SimOutcome, Tone> = { submitted: "risk", clicked: "risk", reported: "safe", ignored: "neutral" };
const OUTCOME_DOT: Record<SimOutcome, string> = { submitted: "bg-risk-500", clicked: "bg-risk-500", reported: "bg-safe-500", ignored: "bg-line-strong" };
const CHANNEL_ICON = { email: Mail, sms: MessageSquare, voice: Phone, usb: Usb, qr: QrCode } as const;

export default async function SecurityPage() {
  const v = await requireViewer();
  const locale = await getLocale();
  const [tr, to, tc, format] = await Promise.all([getTranslations("security"), getTranslations("security.overview"), getTranslations("common"), getAppFormatter()]);
  const campaignsOn = v.tenant.features.has("campaigns");
  const since30 = daysAgoKey(30);
  const [risks, catalog, breakdown, reports, [reportTotal], [oldest], sims, [simTotals]] = await Promise.all([
    openRisks(v),
    getCatalog(v, locale),
    myRiskBreakdown(v),
    db()
      .select({ number: t.threatReports.number, subject: t.threatReports.subject, status: t.threatReports.status, createdAt: t.threatReports.createdAt })
      .from(t.threatReports)
      .where(eq(t.threatReports.reporterId, v.user.id))
      .orderBy(desc(t.threatReports.createdAt))
      .limit(5),
    db().select({ n: count() }).from(t.threatReports).where(eq(t.threatReports.reporterId, v.user.id)),
    db()
      .select({ score: t.userRiskSnapshots.score })
      .from(t.userRiskSnapshots)
      .where(and(eq(t.userRiskSnapshots.userId, v.user.id), gte(t.userRiskSnapshots.day, since30)))
      .orderBy(asc(t.userRiskSnapshots.day))
      .limit(1),
    campaignsOn
      ? db()
          .select({
            id: t.campaignRecipients.id,
            channel: t.campaigns.channel,
            sentAt: t.campaignRecipients.sentAt,
            clickedAt: t.campaignRecipients.clickedAt,
            submittedAt: t.campaignRecipients.submittedAt,
            reportedAt: t.campaignRecipients.reportedAt,
          })
          .from(t.campaignRecipients)
          .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
          .where(and(eq(t.campaignRecipients.userId, v.user.id), isNotNull(t.campaignRecipients.sentAt)))
          .orderBy(desc(t.campaignRecipients.sentAt))
          .limit(6)
      : Promise.resolve([]),
    db()
      .select({ reported: count(t.campaignRecipients.reportedAt) })
      .from(t.campaignRecipients)
      .where(eq(t.campaignRecipients.userId, v.user.id)),
  ]);

  const score = v.user.riskScore;
  const band = riskBand(score);
  const open = risks.filter((r) => r.status === "open");
  const closed = risks.filter((r) => r.status === "closed");
  const byModule = new Map(catalog.map((m) => [m.id, m]));
  const today = daysAgoKey(0);
  const parts = breakdown ? PARTS.map(([key, max]) => ({ key, max, value: breakdown.parts[key] })) : [];
  const top = parts.filter((p) => p.value > 0).sort((a, b) => b.value / b.max - a.value / a.max)[0];
  const delta = oldest ? score - oldest.score : null;
  const bandLabels = { low: tc("risk.low"), medium: tc("risk.medium"), high: tc("risk.high") };
  const dateOf = (d: Date) => format.dateTime(d, { dateStyle: "medium" });
  const dueOf = (day: string) => dateOf(new Date(`${day}T12:00:00+04:00`));

  // Strengths: every score part that adds nothing, plus the habits that earn them.
  const clearParts = parts.filter((p) => p.value === 0).map((p) => p.key);
  const simsReported = Number(simTotals?.reported ?? 0);
  const achievements = [
    { key: "reports", value: Number(reportTotal?.n ?? 0), icon: <ShieldAlert /> },
    { key: "simsReported", value: simsReported, icon: <CheckCircle2 /> },
    { key: "risksClosed", value: closed.length, icon: <Award /> },
  ] as const;

  const outcomeOf = (s: { clickedAt: Date | null; submittedAt: Date | null; reportedAt: Date | null }): SimOutcome =>
    s.submittedAt ? "submitted" : s.clickedAt ? "clicked" : s.reportedAt ? "reported" : "ignored";

  return (
    <div className="grid gap-6 sm:gap-8">
      {/* The report button lives in the top bar and in the next-step cards, so the header stays quiet. */}
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} icon={<ShieldCheck />} className="mb-0 sm:mb-0" />

      {/* Hero: the score, what it means, where it is heading, and the cat reacting to it. */}
      <Card className="relative overflow-hidden">
        <div className="grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[auto_1fr_auto]">
          <div className="grid justify-items-center gap-3">
            <ScoreGauge score={score} band={band} caption={to("outOf")} label={to("gaugeLabel", { score, band: bandLabels[band] })} />
            <Pill tone={BAND_TONE[band]}>{bandLabels[band]}</Pill>
          </div>
          <div className="grid min-w-0 gap-4 text-center md:text-start">
            <div>
              <p className="text-tab-sm font-bold tracking-wide text-ink-muted uppercase">{to("heroLabel")}</p>
              <h2 className="mt-1 text-title font-bold text-balance text-ink">{to(`headline.${band}`)}</h2>
              <p className="mt-2 text-body-sm text-pretty text-ink-muted">
                {to(`bandBody.${band}`)} {top ? to("topCause", { part: tr(`why.${top.key}`) }) : to("noCause")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <TrendPill delta={delta} label={(key, points) => to(key, { points })} />
              <span className="text-caption text-ink-subtle">{tc("risk.lowerBetter")}</span>
            </div>
            <div className="flex justify-center md:justify-start">
              <BandScale score={score} labels={bandLabels} />
            </div>
          </div>
          {/* One cat for every width: tucked into the corner on phones, its own column from md up. */}
          <div className="absolute end-1 top-1 md:static md:justify-self-center">
            <Mascot mood={BAND_MASCOT[band].mood} gesture={v.user.motion === "still" ? undefined : BAND_MASCOT[band].gesture} gestureKey={band} still={v.user.motion === "still"} className="size-14 md:size-36 lg:size-44" auto />
          </div>
        </div>
      </Card>

      {/* What to do next: open risks with their training first, then 2FA, then the everyday habits. */}
      <section aria-labelledby="next-steps" className="grid gap-4">
        <SectionTitle id="next-steps" title={to("next.title")} subtitle={to("next.subtitle")} />
        <div className="grid gap-4 md:grid-cols-2">
          {open.length === 0 ? (
            <Card className="md:col-span-2">
              <EmptyState icon={<ShieldCheck />} title={tr("noRisksTitle")} body={tr("noRisksBody")} />
            </Card>
          ) : (
            open.map((r) => {
              const m = r.moduleId ? byModule.get(r.moduleId) : undefined;
              const overdue = r.dueDate ? r.dueDate < today : false;
              return (
                <ActionCard
                  key={r.id}
                  tone={overdue || r.severity === "high" || r.severity === "critical" ? "risk" : "warn"}
                  icon={m ? <GraduationCap /> : <AlertTriangle />}
                  eyebrow={
                    <>
                      <Pill tone="violet">{tr(`kind.${r.kind}`)}</Pill>
                      <Pill tone={r.severity === "high" || r.severity === "critical" ? "risk" : r.severity === "medium" ? "warn" : "neutral"}>{tc(`severity.${r.severity}`)}</Pill>
                      {overdue ? <Pill tone="risk">{to("overdue")}</Pill> : null}
                    </>
                  }
                  title={riskTitle(r.title, locale)}
                  meta={
                    r.dueDate ? (
                      <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-risk-700")}>
                        <Clock className="size-4 shrink-0" />
                        {tr("dueOn", { date: dueOf(r.dueDate) })}
                      </span>
                    ) : null
                  }
                >
                  {m ? (
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 text-caption">
                        <span className="min-w-0 flex-1 font-semibold break-words text-ink">{m.title}</span>
                        <span className="font-bold tabular-nums">{tc("units.percent", { value: format.number(m.percent) })}</span>
                      </div>
                      <ProgressBar decorative value={m.percent} size="sm" />
                      {m.status === "completed" ? <p className="text-caption text-ink-muted">{tr("retakeHint")}</p> : null}
                      {/* A module finished before the risk was opened is gone through again from the first lesson. */}
                      <ButtonLink href={`/learn/${m.slug}/${nextLesson(m).key}`} icon={<Play className="fill-current" />} className="w-full justify-center sm:w-auto sm:justify-self-start">
                        {m.status === "completed" ? tr("retakeTraining") : m.percent ? tr("continueTraining") : tr("startTraining")}
                      </ButtonLink>
                    </div>
                  ) : null}
                </ActionCard>
              );
            })
          )}
          {!v.user.totpEnabled ? (
            <ActionCard tone="brand" icon={<KeyRound />} title={to("twoFactor.title")} meta={to("twoFactor.body")}>
              <ButtonLink href="/profile#security" variant="secondary" iconRight={<ChevronRight />} className="w-full justify-center sm:w-auto sm:justify-self-start">
                {to("twoFactor.cta")}
              </ButtonLink>
            </ActionCard>
          ) : null}
          <ActionCard tone="risk" icon={<ShieldAlert />} title={tr("report.cta")} meta={tr("report.ctaBody", { xp: REPORT_BONUS_XP })}>
            <ReportButton variant="full" className="w-full justify-center sm:w-auto sm:justify-self-start" />
          </ActionCard>
          {v.tenant.features.has("sandbox") ? (
            <ActionCard tone="brand" icon={<FlaskConical />} title={tr("sandbox.card")} meta={tr("sandbox.cardBody")}>
              <ButtonLink href="/security/sandbox" variant="secondary" iconRight={<ChevronRight />} className="w-full justify-center sm:w-auto sm:justify-self-start">
                {to("sandboxCta")}
              </ButtonLink>
            </ActionCard>
          ) : null}
        </div>
        {closed.length ? (
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-caption font-semibold text-ink-muted pointer-coarse:py-2">{tr("showClosed", { count: closed.length })}</summary>
            <ul className="mt-3 grid gap-2">
              {closed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-caption">
                  <span className="flex min-w-0 items-start gap-2 break-words">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-safe-600" />
                    {riskTitle(r.title, locale)}
                  </span>
                  {r.closedAt ? <span className="shrink-0 text-ink-subtle">{tr("closedOn", { date: dateOf(r.closedAt) })}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Why the score is what it is: each part as a bar against its own maximum, with one tip. */}
        <Card>
          <CardHeader title={to("why.title")} description={tr("why.hint")} />
          <CardBody>
            {parts.length ? (
              <ul className="grid gap-5">
                {parts.map((p) => (
                  <li key={p.key}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-body-sm font-semibold text-ink">{tr(`why.${p.key}`)}</span>
                      {p.value === 0 ? (
                        <Pill tone="safe">
                          <CheckCircle2 />
                          {to("why.clear")}
                        </Pill>
                      ) : (
                        <span className="shrink-0 text-caption font-bold text-ink tabular-nums">{to("why.points", { value: p.value, max: p.max })}</span>
                      )}
                    </div>
                    <ProgressBar
                      label={`${tr(`why.${p.key}`)}: ${to("why.points", { value: p.value, max: p.max })}`}
                      value={(p.value / p.max) * 100}
                      size="sm"
                      tone={p.value === 0 ? "safe" : p.value / p.max > 0.5 ? "risk" : "warn"}
                      className="mt-2"
                    />
                    {p.value > 0 ? <p className="mt-1.5 text-caption text-ink-muted">{to(`tips.${p.key}`)}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-ink-muted">{to("noCause")}</p>
            )}
          </CardBody>
        </Card>

        {/* Simulation history as a timeline: how each training attack sent to this person ended. */}
        {campaignsOn ? (
          <Card>
            <CardHeader title={to("sims.title")} description={to("sims.hint")} />
            <CardBody>
              {sims.length ? (
                <ol className="relative grid gap-5 before:absolute before:inset-y-1 before:start-[0.6875rem] before:w-px before:bg-line">
                  {sims.map((s) => {
                    const outcome = outcomeOf(s);
                    const Icon = CHANNEL_ICON[s.channel];
                    return (
                      <li key={s.id} className="relative grid grid-cols-[1.375rem_1fr] gap-3">
                        <span className={cn("relative mt-1 size-[1.375rem] rounded-pill border-4 border-surface", OUTCOME_DOT[outcome])} aria-hidden />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone={OUTCOME_TONE[outcome]}>{to(`sims.outcome.${outcome}`)}</Pill>
                            {outcome !== "reported" && s.reportedAt ? <Pill tone="safe">{to("sims.alsoReported")}</Pill> : null}
                          </div>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-muted">
                            <span className="inline-flex items-center gap-1 font-semibold text-ink">
                              <Icon className="size-4 shrink-0" aria-hidden />
                              {to(`sims.channel.${s.channel}`)}
                            </span>
                            {s.sentAt ? <span>{dateOf(s.sentAt)}</span> : null}
                          </p>
                          <p className="mt-1 text-caption text-ink-muted">{to(`sims.outcomeBody.${outcome}`)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState icon={<Mail />} title={to("sims.empty")} body={to("sims.emptyBody")} />
              )}
            </CardBody>
          </Card>
        ) : null}

        {/* Strengths and achievements: what is already going well. */}
        <Card>
          <CardHeader title={to("strengths.title")} icon={<Award />} />
          <CardBody className="grid gap-5">
            <dl className="grid grid-cols-3 gap-2 sm:gap-3">
              {achievements.map((a) => (
                <div key={a.key} className="grid content-start justify-items-center gap-1 rounded-lg bg-sunken/70 px-2 py-3 text-center">
                  <span className="text-brand-600 [&_svg]:size-5" aria-hidden>
                    {a.icon}
                  </span>
                  <dd className="text-title font-bold text-ink tabular-nums">{a.value}</dd>
                  <dt className="text-tab-sm leading-tight break-words text-ink-muted">{to(`strengths.${a.key}`)}</dt>
                </div>
              ))}
            </dl>
            {clearParts.length || v.user.totpEnabled ? (
              <ul className="flex flex-wrap gap-2">
                {v.user.totpEnabled ? (
                  <li>
                    <Pill tone="safe" className="whitespace-normal">
                      <KeyRound />
                      {to("strengths.twoFactorOn")}
                    </Pill>
                  </li>
                ) : null}
                {clearParts.map((key: Part) => (
                  <li key={key}>
                    <Pill tone="safe" className="whitespace-normal">
                      <CheckCircle2 />
                      {to(`strengths.clear.${key}`)}
                    </Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{to("strengths.empty")}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={tr("myReports")} icon={<ShieldAlert />} />
          <CardBody>
            {reports.length ? (
              <ul className="divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.number} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0 text-body-sm break-words text-ink">{r.subject}</span>
                    <Pill tone={r.status === "converted" ? "violet" : r.status === "triaged" ? "safe" : r.status === "dismissed" ? "neutral" : "brand"}>{tr(`reportStatus.${r.status}`)}</Pill>
                    <span className="col-span-2 text-tab text-ink-subtle">
                      <span className="font-mono">TR-{r.number}</span> · {format.relativeTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-ink-muted">{tr("noReports")}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div>
      <h2 id={id} className="text-title-sm font-bold text-ink">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-caption text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}

const ACTION_TONE = {
  risk: "bg-risk-50 text-risk-600",
  warn: "bg-warn-50 text-warn-700",
  brand: "bg-brand-50 text-brand-600",
} as const;

function ActionCard({
  tone,
  icon,
  eyebrow,
  title,
  meta,
  children,
}: {
  tone: keyof typeof ACTION_TONE;
  icon: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg [&_svg]:size-5", ACTION_TONE[tone])} aria-hidden>
          {icon}
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          {eyebrow ? <div className="flex flex-wrap gap-1.5">{eyebrow}</div> : null}
          <h3 className="text-body font-semibold break-words text-ink">{title}</h3>
          {meta ? <div className="text-caption text-ink-muted">{meta}</div> : null}
        </div>
      </div>
      {children ? <div className="mt-auto grid">{children}</div> : null}
    </Card>
  );
}

function TrendPill({ delta, label }: { delta: number | null; label: (key: "trendDown" | "trendUp" | "trendFlat" | "trendNone", points: number) => string }) {
  if (delta === null) return <Pill tone="neutral">{label("trendNone", 0)}</Pill>;
  if (delta < 0)
    return (
      <Pill tone="safe" className="whitespace-normal">
        <TrendingDown aria-hidden />
        {label("trendDown", -delta)}
      </Pill>
    );
  if (delta > 0)
    return (
      <Pill tone="risk" className="whitespace-normal">
        <TrendingUp aria-hidden />
        {label("trendUp", delta)}
      </Pill>
    );
  return (
    <Pill tone="neutral">
      <Minus aria-hidden />
      {label("trendFlat", 0)}
    </Pill>
  );
}

/** The Baku day `days` ago, as YYYY-MM-DD (server only: this page is never hydrated). */
function daysAgoKey(days: number): string {
  return dayKey(new Date(Date.now() - days * 86_400_000));
}
