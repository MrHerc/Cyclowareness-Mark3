import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { Award, Building2, Check, Flame, Mail, QrCode, ShieldAlert } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed } from "@/server/auth/viewer";
import { getDepartments } from "@/server/queries/admin";
import { computeTenantRisk } from "@/server/services/risk";
import { badgesFor } from "@/server/queries/badges";
import { assignedForUser } from "@/server/services/assignments";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { BackLink } from "@/components/ui/layout";
import { BarChart, Heatmap, Sparkline } from "@/components/ui/charts";
import { DeletePersonButton, PersonActions } from "@/components/admin/person-actions";
import { TEMPLATES } from "@/lib/campaigns/templates";
import { levelFor, dayKey, liveStreak } from "@/lib/domain/gamification";
import { riskBand } from "@/lib/domain/risk";
import { dayAt, dayPlus, requestNow } from "@/lib/time";
import { isLocale, pick } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { riskTitle } from "@/lib/risk-title";
import { personForPage } from "./person";

const DAY = 86_400_000;
/** Templates that carry a QR code: a click on their link means the code was scanned with a phone. */
const QR_KEYS = TEMPLATES.filter((x) => x.qr).map((x) => x.key);
/** xp_events.reason values written by awardXp (progress.ts, lab and threat reports). */
const XP_REASONS = ["lesson", "lab", "report"] as const;

export async function generateMetadata({ params }: PageProps<"/admin/users/[id]">) {
  const { person } = await personForPage((await params).id);
  return { title: person.u.name };
}

export default async function PersonPage({ params }: PageProps<"/admin/users/[id]">) {
  const { v, person } = await personForPage((await params).id);
  const u = person.u;
  const locale = await getLocale();
  const [tr, tc, tp, ts, tcol, format] = await Promise.all([
    getTranslations("admin.person"),
    getTranslations("common"),
    getTranslations("learner.progress"),
    getTranslations("security"),
    getTranslations("admin.reports.cols"),
    getAppFormatter(),
  ]);
  const now = requestNow();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const tz = v.tenant.settings.timeZone;

  const [progress, lessonsAgg, answers, byCategory, sims, phishing, qrScans, xpDays, risks, attests, certs, recent, badges, evidence, departments, firstXp, modules, assigned, riskDays] = await Promise.all([
    db().select({ p: t.moduleProgress, title: t.modules.title, slug: t.modules.slug }).from(t.moduleProgress).innerJoin(t.modules, eq(t.modules.id, t.moduleProgress.moduleId)).where(eq(t.moduleProgress.userId, u.id)).orderBy(desc(t.moduleProgress.percent)),
    db().select({ n: count(), secs: sql<number>`coalesce(sum(${t.lessonProgress.secondsSpent}),0)` }).from(t.lessonProgress).where(and(eq(t.lessonProgress.userId, u.id), isNotNull(t.lessonProgress.completedAt))),
    db().select({ total: count(), good: sql<number>`count(*) filter (where ${t.answers.correct})` }).from(t.answers).where(and(eq(t.answers.userId, u.id), eq(t.answers.firstTry, true))),
    db()
      .select({ category: t.answers.category, total: count(), good: sql<number>`count(*) filter (where ${t.answers.correct})` })
      .from(t.answers)
      .where(and(eq(t.answers.userId, u.id), eq(t.answers.firstTry, true)))
      .groupBy(t.answers.category),
    db().select({ outcome: t.answers.outcome, n: count() }).from(t.answers).where(and(eq(t.answers.userId, u.id), isNotNull(t.answers.outcome))).groupBy(t.answers.outcome),
    db().select({ sent: count(), clicked: sql<number>`count(${t.campaignRecipients.clickedAt})`, reported: sql<number>`count(${t.campaignRecipients.reportedAt})` }).from(t.campaignRecipients).where(eq(t.campaignRecipients.userId, u.id)),
    db()
      .select({ id: t.campaignRecipients.id, campaign: t.campaigns.name, at: t.campaignRecipients.clickedAt })
      .from(t.campaignRecipients)
      .innerJoin(t.campaigns, eq(t.campaigns.id, t.campaignRecipients.campaignId))
      .where(
        and(
          eq(t.campaignRecipients.userId, u.id),
          isNotNull(t.campaignRecipients.clickedAt),
          QR_KEYS.length ? or(eq(t.campaigns.channel, "qr"), inArray(t.campaigns.templateKey, QR_KEYS)) : eq(t.campaigns.channel, "qr"),
        ),
      )
      .orderBy(desc(t.campaignRecipients.clickedAt))
      .limit(10),
    db()
      .select({ day: sql<string>`to_char(${t.xpEvents.at} at time zone ${tz}, 'YYYY-MM-DD')`, xp: sql<number>`sum(${t.xpEvents.amount})` })
      .from(t.xpEvents)
      .where(and(eq(t.xpEvents.userId, u.id), gte(t.xpEvents.at, since30)))
      .groupBy(sql`1`),
    db().select().from(t.behaviorRisks).where(and(eq(t.behaviorRisks.userId, u.id), eq(t.behaviorRisks.status, "open"))),
    db().select({ a: t.attestations, title: t.modules.title }).from(t.attestations).innerJoin(t.modules, eq(t.modules.id, t.attestations.moduleId)).where(eq(t.attestations.userId, u.id)).orderBy(desc(t.attestations.at)).limit(10),
    db().select({ n: count() }).from(t.certificates).where(eq(t.certificates.userId, u.id)),
    db().select().from(t.xpEvents).where(eq(t.xpEvents.userId, u.id)).orderBy(desc(t.xpEvents.at)).limit(8),
    badgesFor(u.id, v.tenant.id),
    computeTenantRisk(db(), v.tenant.id, now, [u.id]),
    getDepartments(v.tenant.id),
    db()
      .select({ at: sql`min(${t.xpEvents.at})`.mapWith(t.xpEvents.at) })
      .from(t.xpEvents)
      .where(eq(t.xpEvents.userId, u.id)),
    db()
      .select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title, tenantId: t.modules.tenantId })
      .from(t.modules)
      .where(and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)), eq(t.modules.status, "published")))
      .orderBy(asc(t.modules.sortOrder)),
    assignedForUser(db(), v.tenant.id, u.id),
    db()
      .select({ day: t.userRiskSnapshots.day, score: t.userRiskSnapshots.score })
      .from(t.userRiskSnapshots)
      .where(and(eq(t.userRiskSnapshots.userId, u.id), gte(t.userRiskSnapshots.day, dayKey(since30, tz)))),
  ]);
  const pathIds = [...new Set([...assigned.values()].map((a) => a.pathId).filter((p): p is string => !!p))];
  const paths = pathIds.length
    ? await db().select({ id: t.learningPaths.id, title: t.learningPaths.title, moduleSlugs: t.learningPaths.moduleSlugs }).from(t.learningPaths).where(inArray(t.learningPaths.id, pathIds))
    : [];
  const breakdown = evidence.get(u.id);
  const dayMap = new Map(xpDays.map((d) => [d.day, Number(d.xp)]));
  // The charts' hidden data tables read the label aloud, so it is a date in the interface language; `day` stays the lookup key.
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = dayPlus(i - 29, tz, now);
    return { day, label: format.dateTime(dayAt(day, tz), { day: "numeric", month: "short" }), value: dayMap.get(day) ?? 0 };
  });
  // Days without a snapshot (before the history began) show today's score, so the line stays flat there.
  const riskByDay = new Map(riskDays.map((r) => [r.day, r.score]));
  const riskTrend = days.map((d) => ({ label: d.label, value: riskByDay.get(d.day) ?? u.riskScore }));
  const lvl = levelFor(u.xp);
  const band = riskBand(u.riskScore);
  const completed = progress.filter((p) => p.p.status === "completed").length;
  const inProgress = progress.filter((p) => p.p.status === "in_progress").length;
  const awaiting = progress.filter((p) => p.p.status === "awaiting_attestation").length;
  const firstTry = Number(answers[0].total) ? Math.round((Number(answers[0].good) / Number(answers[0].total)) * 100) : null;
  const weak = byCategory
    .filter((c) => Number(c.total) >= 3 && c.category)
    .map((c) => ({ category: c.category!, rate: Math.round((Number(c.good) / Number(c.total)) * 100) }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 4);
  const outcome = Object.fromEntries(sims.map((s) => [s.outcome, Number(s.n)])) as Record<string, number>;
  const ph = phishing[0];
  const hours = Math.round(Number(lessonsAgg[0].secs) / 360) / 10;
  const firstActive: Date | null = firstXp[0]?.at ?? null;
  const streak = liveStreak(u.streakCurrent, u.streakLastDay, dayKey(now, tz), u.streakFreezes);
  const activeDays = days.filter((d) => d.value > 0).length;
  // A tenant's own module with the same slug replaces the library one.
  const moduleBySlug = new Map<string, (typeof modules)[number]>();
  for (const m of modules) if (!moduleBySlug.has(m.slug) || m.tenantId) moduleBySlug.set(m.slug, m);
  const progressById = new Map(progress.map((p) => [p.p.moduleId, p.p]));
  const completedSlugs = new Set(progress.filter((p) => p.p.status === "completed").map((p) => p.slug));
  const STATUS = {
    not_started: { tone: "neutral", label: tcol("notStarted") },
    in_progress: { tone: "brand", label: tcol("inProgress") },
    awaiting_attestation: { tone: "reward", label: tcol("awaiting") },
    completed: { tone: "safe", label: tcol("done") },
  } as const;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <BackLink href="/admin/users">{tr("back")}</BackLink>
      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={u.name} src={u.avatarUrl} size="xl" />
          <div className="min-w-[min(100%,14rem)] flex-1">
            <h1 className="font-display text-display font-bold text-balance wrap-break-word">{u.name}</h1>
            <p className="mt-1 text-body text-ink-muted">{u.jobTitle ?? "—"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="brand">{tc(`roles.${u.role}`)}</Pill>
              <Pill tone={u.status === "active" ? "safe" : u.status === "invited" ? "brand" : "neutral"}>{tc(`userStatus.${u.status}`)}</Pill>
              {u.totpEnabled ? <Pill tone="safe">{tr("twoFactorOn")}</Pill> : null}
            </div>
            <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1 text-caption text-ink-muted">
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" />
                <bdi className="min-w-0 truncate">{u.email}</bdi>
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="size-4 shrink-0" />
                {person.dept ?? tc("noDepartment")}
              </li>
              <li>{tr("joined", { date: format.dateTime(u.createdAt, { dateStyle: "medium" }) })}</li>
            </ul>
          </div>
          {allowed(v, "people.write") ? (
            <div className="flex max-w-full flex-wrap justify-end gap-2 sm:ms-auto sm:max-w-sm [&>button]:max-w-full [&>button]:whitespace-normal">
              <PersonActions
                isSelf={u.id === v.user.id}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                locales={v.tenant.settings.locales}
                person={{ id: u.id, name: u.name, jobTitle: u.jobTitle, phone: u.phone, locale: u.locale, role: u.role, status: u.status, departmentId: u.departmentId, totpEnabled: u.totpEnabled }}
              />
            </div>
          ) : null}
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-xs sm:grid-cols-3 xl:grid-cols-6">
        <div className="bg-surface p-4">
          <p className="text-tab font-semibold text-ink-muted">{tr("riskScore")}</p>
          <p className={cn("mt-1.5 text-title font-bold tabular-nums", band === "low" ? "text-safe-700" : band === "medium" ? "text-warn-700" : "text-risk-600")}>{u.riskScore}</p>
          <Pill className="mt-2" tone={band === "low" ? "safe" : band === "medium" ? "warn" : "risk"}>
            <ShieldAlert />
            {tc(`risk.${band}`)}
          </Pill>
          <Sparkline className="mt-3 h-6 w-full max-w-28" tone={band === "low" ? "safe" : band === "medium" ? "warn" : "risk"} points={riskTrend} caption={tr("riskTrend")} headers={[tc("chart.date"), tr("riskScore")]} />
        </div>
        <div className="bg-surface p-4">
          <p className="text-tab font-semibold text-ink-muted">{tr("xp")}</p>
          <p className="mt-1.5 text-title font-bold tabular-nums">{format.number(u.xp)}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-tab font-semibold text-ink-muted">{tr("level")}</p>
          <p className="mt-1.5 text-title font-bold tabular-nums">{lvl.level}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-tab font-semibold text-ink-muted">{tr("streak")}</p>
          <p className="mt-1.5 text-title font-bold tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <Flame className={cn("size-5", streak ? "text-reward-500" : "text-ink-subtle")} />
              {streak}
            </span>
          </p>
          <p className="text-tab text-ink-subtle">{tr("longest", { count: u.streakLongest })}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-tab font-semibold text-ink-muted">{tr("badges")}</p>
          <p className="mt-1.5 text-title font-bold tabular-nums">{badges.length}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-tab font-semibold text-ink-muted">{tr("certificates")}</p>
          <p className="mt-1.5 text-title font-bold tabular-nums">{Number(certs[0].n)}</p>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={tr("learning")} />
          <CardBody className="grid gap-3 pt-3">
            <div className="grid grid-cols-3 divide-x divide-line rounded-lg bg-sunken wrap-break-word">
              <div className="p-3">
                <p className="text-title font-bold text-safe-700">{completed}</p>
                <p className="text-tab text-ink-muted">{tr("completed")}</p>
              </div>
              <div className="p-3">
                <p className="text-title font-bold text-brand-700">{inProgress}</p>
                <p className="text-tab text-ink-muted">{tr("inProgress")}</p>
              </div>
              <div className="p-3">
                <p className="text-title font-bold text-reward-ink">{awaiting}</p>
                <p className="text-tab text-ink-muted">{tr("awaiting")}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-caption">
              <dt className="text-ink-muted">{tr("lessonsCompleted")}</dt>
              <dd className="text-end font-semibold">{Number(lessonsAgg[0].n)}</dd>
              <dt className="text-ink-muted">{tr("timeSpent")}</dt>
              <dd className="text-end font-semibold">{hours ? tr("hours", { hours: format.number(hours, { maximumFractionDigits: 1 }) }) : tr("notYet")}</dd>
              <dt className="text-ink-muted">{tr("firstActive")}</dt>
              <dd className="text-end font-semibold">{firstActive ? format.relativeTime(firstActive) : tr("notYet")}</dd>
              <dt className="text-ink-muted">{tr("lastActive")}</dt>
              <dd className="text-end font-semibold">{u.lastActiveAt ? format.relativeTime(u.lastActiveAt) : tr("notYet")}</dd>
              <dt className="text-ink-muted">{tr("activeDays")}</dt>
              <dd className="text-end font-semibold">{tr("ofThirty", { count: activeDays })}</dd>
            </dl>
          </CardBody>
        </Card>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <CardHeader title={tr("answers")} description={tr("answersSub")} />
            <CardBody className="pt-3">{firstTry !== null ? <p className="text-numeral font-bold">{tc("units.percent", { value: format.number(firstTry) })}</p> : <p className="text-caption text-ink-muted">{tr("noAnswers")}</p>}</CardBody>
          </Card>
          <Card>
            <CardHeader title={tr("simulations")} />
            <CardBody className="grid gap-4 pt-3">
              <p className="text-caption text-ink-muted">
                {Object.keys(outcome).length ? tr("simOutcomes", { safe: outcome.safe ?? 0, risky: outcome.risky ?? 0, compromised: outcome.compromised ?? 0 }) : tr("simulationsEmpty")}
              </p>
              <div>
                <p className="text-caption font-semibold">{tr("phishing")}</p>
                <p className="text-caption text-ink-muted">{tr("phishingStats", { sent: Number(ph.sent), clicked: Number(ph.clicked), reported: Number(ph.reported) })}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tr("qrScans")} />
            <CardBody className="pt-3">
              {qrScans.length ? (
                <ul className="grid gap-2">
                  {qrScans.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-caption">
                      <QrCode className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      <span>{tr("qrScan", { campaign: s.campaign, date: format.dateTime(s.at!, { dateStyle: "medium", timeStyle: "short" }) })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-ink-muted">{tr("qrScansEmpty")}</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={tr("xp30")} />
          <CardBody>
            <BarChart points={days} caption={tr("xp30")} headers={[tc("chart.date"), tc("chart.xp")]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("activity")} description={tp("activeDays", { count: activeDays })} />
          <CardBody>
            <Heatmap days={days} caption={tr("activity")} headers={[tc("chart.date"), tc("chart.xp")]} />
            {days.every((d) => !d.value) ? <p className="mt-3 text-caption text-ink-muted">{tr("noActivity30")}</p> : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={tr("weakAreas")} description={tr("weakAreasSub")} />
          <CardBody className="grid gap-2.5 pt-3">
            {weak.length ? (
              weak.map((w) => (
                <div key={w.category}>
                  <div className="flex justify-between text-caption">
                    <span>{tc(`categories.${w.category as "email"}`)}</span>
                    <b>{tc("units.percent", { value: format.number(w.rate) })}</b>
                  </div>
                  <ProgressBar decorative value={w.rate} size="sm" tone={w.rate < 60 ? "risk" : w.rate < 80 ? "warn" : "safe"} className="mt-1" />
                </div>
              ))
            ) : (
              <p className="text-caption text-ink-muted">{tr("weakAreasEmpty")}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("riskParts")} />
          <CardBody className="grid gap-2.5 pt-3">
            {breakdown
              ? (["training", "overdue", "simulations", "openRisks", "knowledge"] as const).map((k) => {
                  const max = { training: 30, overdue: 10, simulations: 35, openRisks: 30, knowledge: 16 }[k];
                  const val = breakdown.parts[k];
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-tab">
                        <span>{ts(`why.${k}`)}</span>
                        <b className="tabular-nums">+{val}</b>
                      </div>
                      <ProgressBar decorative value={(val / max) * 100} size="sm" tone={val === 0 ? "safe" : val / max > 0.5 ? "risk" : "warn"} className="mt-1" />
                    </div>
                  );
                })
              : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("openRisks")} />
          <CardBody className="pt-3">
            {risks.length ? (
              <ul className="grid gap-2">
                {risks.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 rounded-md bg-sunken px-3 py-2 text-caption">
                    <Pill tone={r.severity === "high" || r.severity === "critical" ? "risk" : "warn"}>{tc(`severity.${r.severity}`)}</Pill>
                    {/* A system title carries every language and is shown in the console's; a plain one (typed by a person: an incident, a material) as it is. */}
                    <span>
                      <b>{ts(`kind.${r.kind}`)}</b> · {riskTitle(r.title, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{tr("noRisks")}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr("moduleProgress")} />
          <CardBody className="grid max-h-96 grid-cols-[minmax(0,1fr)] gap-2 overflow-y-auto pt-3">
            {[...moduleBySlug.values()].map((m) => {
              const p = progressById.get(m.id);
              const status = STATUS[p?.status ?? "not_started"];
              return (
                <div key={m.slug} className="flex items-center gap-3 text-caption">
                  <Link href={`/learn/${m.slug}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                    {pick(m.title, locale)}
                  </Link>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  <span className="w-12 shrink-0 text-end tabular-nums">{tc("units.percent", { value: format.number(p?.percent ?? 0) })}</span>
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("confirmations")} />
          <CardBody className="pt-3">
            {attests.length ? (
              <ul className="grid gap-2">
                {attests.map((a) => (
                  <li key={a.a.id} className="flex items-start gap-2 text-caption">
                    <Award className="mt-0.5 size-4 shrink-0 text-reward-600" />
                    <span className="flex-1">
                      <b>{pick(a.title, locale)}</b> · {format.dateTime(a.a.at, { dateStyle: "medium", timeStyle: "short" })} · {isLocale(a.a.locale) ? tc(`languages.${a.a.locale}`) : a.a.locale}
                      <span className="block text-ink-subtle">{tr("quotedText", { text: a.a.text })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{tr("noConfirmations")}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={tcol("path")} />
          <CardBody className="pt-3">
            {paths.length ? (
              <ul className="grid gap-2.5">
                {paths.map((path) => (
                  <li key={path.id} className="text-caption">
                    <p className="font-semibold">{pick(path.title, locale)}</p>
                    <p className="text-ink-muted">{tr("pathProgress", { done: path.moduleSlugs.filter((s) => completedSlugs.has(s)).length, total: path.moduleSlugs.length })}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{tr("noPath")}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("badges")} />
          <CardBody className="pt-3">
            {badges.length ? (
              <ul className="grid gap-2">
                {badges.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-caption font-semibold">
                    <Award className="size-4 shrink-0 text-reward-600" />
                    {tp(`badge.${b}`)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{tr("noBadges")}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("recentActivity")} />
          <CardBody className="pt-3">
            {recent.length ? (
              <ul className="grid gap-1.5">
                {recent.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 text-caption">
                    <Check className="size-3.5 text-safe-600" />
                    <span className="flex-1">
                      {XP_REASONS.includes(x.reason as (typeof XP_REASONS)[number]) ? tr(`xpReason.${x.reason as (typeof XP_REASONS)[number]}`) : x.reason} · +{format.number(x.amount)} XP
                    </span>
                    <span className="text-ink-subtle">{format.relativeTime(x.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{tr("noActivity")}</p>
            )}
          </CardBody>
        </Card>
      </div>
      {allowed(v, "people.write") ? (
        <div className="flex justify-start">
          <DeletePersonButton person={{ id: u.id, name: u.name }} isSelf={u.id === v.user.id} />
        </div>
      ) : null}
    </div>
  );
}
