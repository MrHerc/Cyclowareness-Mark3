import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BookOpen, ChevronRight, Clock, FileText, Flame, Play, Radio, ShieldAlert, ShieldCheck, Target, Zap, Award } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/viewer";
import { db, t as schema } from "@/server/db";
import { pickLessonContent } from "@/lib/content/lesson-locale";
import { getCatalog, continueModule, yourPath, nextLesson } from "@/server/queries/catalog";
import { getPolicies, myLeagueRow, nextLiveSession, openRiskCount, todayXp } from "@/server/queries/learner";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar, Ring } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { ModuleArt } from "@/components/learner/module-icon";
import { HomeMascot } from "@/components/learner/home-mascot";
import { PathTimeline } from "@/components/learner/path-timeline";
import { levelFor, dayKey, liveStreak } from "@/lib/domain/gamification";
import { riskBand } from "@/lib/domain/risk";
import { todayIn } from "@/lib/time";
import { cn } from "@/lib/cn";
import { TrendMark } from "../league/trend";

export async function generateMetadata() {
  const t = await getTranslations("common.nav");
  return { title: t("home") };
}

export default async function HomePage() {
  const v = await requireViewer();
  const locale = await getLocale();
  const [t, tc, tl, format] = await Promise.all([getTranslations("learner.home"), getTranslations("common"), getTranslations("learner.league"), getFormatter()]);
  const [catalog, policies, league, xpToday, risks, session] = await Promise.all([
    getCatalog(v, locale),
    getPolicies(v, locale),
    v.tenant.features.has("league") ? myLeagueRow(v) : Promise.resolve({ rows: [], mine: null }),
    todayXp(v),
    openRiskCount(v),
    v.tenant.features.has("live_sessions") ? nextLiveSession(v) : Promise.resolve(null),
  ]);
  const toSign = policies.filter((p) => !p.signedAt);
  const current = continueModule(catalog);
  const path = yourPath(catalog);
  const awaiting = catalog.find((m) => m.status === "awaiting_attestation");
  const goal = v.tenant.settings.learning.dailyGoalXp;
  const lvl = levelFor(v.user.xp);
  const streak = liveStreak(v.user.streakCurrent, v.user.streakLastDay, dayKey(new Date(), v.tenant.settings.timeZone), v.user.streakFreezes);
  const band = riskBand(v.user.riskScore);
  const firstName = v.user.name.split(" ")[0];
  // The lesson the home tutor answers about, with the language of the text the learner would get (studio lessons may exist in one language only).
  const tutorLesson = v.tenant.features.has("ai_tutor") && current ? nextLesson(current) : null;
  const tutorRows = tutorLesson ? await db().select({ locale: schema.lessonContents.locale }).from(schema.lessonContents).where(eq(schema.lessonContents.lessonId, tutorLesson.id)) : [];
  const tutor = current && tutorLesson ? { slug: current.slug, lessonKey: tutorLesson.key, contentLocale: pickLessonContent(tutorRows, locale)?.locale } : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
      <div className="grid min-w-0 content-start gap-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-headline font-bold text-balance">{t("greeting", { name: firstName })}</h1>
            <p className="mt-2 text-lead text-ink-muted">{t("sub")}</p>
          </div>
          <HomeMascot
            label={tutor ? t("talk") : t("mascot")}
            motion={v.user.motion}
            soundOn={v.user.soundOn}
            tutor={tutor}
            tutorVoice={v.tenant.features.has("tutor_voice")}
          />
        </section>

        {toSign.length ? (
          <Card className="border-brand-100 bg-brand-50/70 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-600 text-brand-on">
                <FileText className="size-5" />
              </span>
              <div>
                <p className="text-body font-semibold">{t("policiesToSign", { count: toSign.length })}</p>
                <p className="text-caption text-ink-muted">{t("policiesBody")}</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2">
              {toSign.map((p) => (
                <li key={p.versionId}>
                  <Link href={`/policies/${p.policyId}?from=%2Fapp`} className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 shadow-xs hover:shadow-raised">
                    <FileText className="size-5 shrink-0 text-ink-subtle" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold">{p.title}</span>
                      <span className="text-tab text-ink-subtle">{t("version", { version: p.version })}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center text-caption font-semibold text-brand-600">
                      {t("sign")}
                      <ChevronRight className="size-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {awaiting ? (
          <Link href={`/learn/${awaiting.slug}?confirm=1`} className="flex items-center gap-4 rounded-xl border border-reward-200 bg-reward-100/60 p-4 hover:bg-reward-100">
            <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-reward-500 text-(--accent-on)">
              <Award className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold">{t("awaiting")}: {awaiting.title}</span>
              <span className="block text-caption text-ink-muted">{t("awaitingBody")}</span>
            </span>
            <ChevronRight className="size-5 text-reward-ink" />
          </Link>
        ) : null}

        {current ? (
          <section data-tour="continue" className="light-on-brand relative isolate scroll-mt-[calc(var(--topbar-height)+1rem)] overflow-hidden rounded-2xl bg-brand-600 p-6 text-brand-on shadow-raised sm:p-8">
            <div aria-hidden className="aurora" />
            <div className="relative flex items-center gap-6">
              <div className="min-w-0 flex-1">
                <Pill className="bg-white/18 text-white">
                  <Play className="fill-current" />
                  {t("continue")}
                </Pill>
                <h2 className="mt-4 text-display font-bold text-balance">{current.title}</h2>
                <p className="mt-2 text-body opacity-85">{current.subtitle}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-caption opacity-90">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {tc("units.min", { count: current.minutes })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="size-4" />
                    {tc("units.lessons", { count: current.lessons.length })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="size-4" />
                    {tc("units.xp", { count: current.xp })}
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <ProgressBar value={current.percent} tone="white" className="max-w-xs" label={t("moduleProgress", { title: current.title })} />
                  <span aria-hidden className="text-caption font-bold tabular-nums">
                    {tc("units.percent", { value: format.number(current.percent) })}
                  </span>
                </div>
                <ButtonLink
                  href={current.status === "awaiting_attestation" ? `/learn/${current.slug}?confirm=1` : `/learn/${current.slug}/${nextLesson(current).key}`}
                  variant="accent"
                  size="lg"
                  className="mt-6"
                  iconRight={<ChevronRight />}
                >
                  {current.status === "awaiting_attestation" ? t("awaiting") : current.percent ? t("continue") : t("start")}
                </ButtonLink>
              </div>
              <ModuleArt slug={current.slug} category={current.category} className="hidden w-44 shrink-0 sm:grid" />
            </div>
          </section>
        ) : (
          <Card className="p-6">
            <p className="text-title-sm font-semibold">{t("allDoneTitle")}</p>
            <p className="mt-1 text-body-sm text-ink-muted">{t("allDoneBody")}</p>
            <ButtonLink href="/learn" className="mt-4" variant="secondary">
              {t("browse")}
            </ButtonLink>
          </Card>
        )}

        {risks ? (
          <Link href="/security" className="flex items-center gap-4 rounded-xl border border-risk-100 bg-risk-50 p-4 hover:bg-risk-100/70">
            <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-risk-600 text-white">
              <ShieldAlert className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold text-risk-700">{t("openRisks", { count: risks })}</span>
              <span className="block text-caption text-risk-700/80">{t("openRisksBody")}</span>
            </span>
            <ChevronRight className="size-5 text-risk-600" />
          </Link>
        ) : null}

        {league.mine ? (
          <Link href="/league" className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-raised">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-reward-500 text-body font-bold text-(--accent-on)">{league.mine.place}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-caption text-ink-muted">{t("placeOf", { place: league.mine.place, total: league.rows.length })}</span>
              <span className="block truncate text-body-sm font-semibold text-ink">{league.mine.name}</span>
              <span className="block text-caption font-semibold text-reward-ink">
                {league.mine.toNext ? t("toNext", { count: league.mine.toNext }) : t("leading")}
              </span>
            </span>
            <TrendMark trend={league.mine.trend} label={tl(`trend_${league.mine.trend}`)} />
            <ChevronRight className="size-5 text-ink-subtle" />
          </Link>
        ) : null}

        <section aria-labelledby="path-title" data-tour="path" className="scroll-mt-[calc(var(--topbar-height)+1rem)]">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="path-title" className="text-title font-bold">
              {t("yourPath")}
            </h2>
            <p className="text-caption text-ink-muted">
              {t("pathDone", { done: path.filter((m) => m.status === "completed").length, total: path.length })}
            </p>
          </div>
          <PathTimeline
            today={todayIn(v.tenant.settings.timeZone)}
            items={path.map((m) => ({
              slug: m.slug,
              category: m.category,
              title: m.title,
              subtitle: m.subtitle,
              minutes: m.minutes,
              lessons: m.lessons.length,
              xp: m.xp,
              percent: m.percent,
              status: m.status,
              assigned: m.assigned,
              due: m.due,
              current: current?.slug === m.slug,
            }))}
          />
        </section>
      </div>

      <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Card className="flex items-center gap-4 p-5">
          <Ring value={goal ? xpToday / goal : 0} size={112} stroke={10} label={t("goalOf", { value: xpToday, goal })}>
            <span className="grid justify-items-center gap-0.5">
              <Target aria-hidden className="size-5 text-reward-600" />
              <span className="text-title-sm font-bold tabular-nums">{xpToday}</span>
            </span>
          </Ring>
          <div>
            <p className="text-body font-bold">{t("dailyGoal")}</p>
            <p className="mt-1 text-caption text-ink-muted tabular-nums">{t("goalOf", { value: Math.min(xpToday, 9999), goal })}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="relative grid size-28 shrink-0 place-items-center rounded-full bg-reward-100">
            {/* A live streak keeps a warm glow behind the flame that breathes (still under Calm and Still). */}
            {streak ? <span aria-hidden className="pointer-events-none absolute inset-2 animate-breathe rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_45%,transparent),transparent)] opacity-60 print:hidden" /> : null}
            <Flame className={cn("relative size-14", streak ? "fill-reward-400 text-reward-600" : "text-ink-subtle")} strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-numeral font-bold tabular-nums">{streak}</p>
            <p className="text-caption text-ink-muted">{t("streak")}</p>
          </div>
        </Card>
        <Card className="grid grid-cols-2 divide-x divide-line p-5">
          <div className="min-w-0 pe-4">
            <p className="flex items-center gap-1.5 text-title font-bold tabular-nums">
              <Zap className="size-5 fill-brand-600 text-brand-600" />
              {format.number(v.user.xp)}
            </p>
            <p className="text-tab text-ink-muted">{t("totalXp")}</p>
            <Pill tone="brand" className="mt-2">
              {tc("level", { level: lvl.level })}
            </Pill>
          </div>
          <Link href="/security" className="min-w-0 ps-4">
            <p className="flex items-center gap-1.5 text-title font-bold tabular-nums">
              <ShieldCheck className={cn("size-5", band === "low" ? "text-safe-600" : band === "medium" ? "text-warn-500" : "text-risk-600")} />
              {v.user.riskScore}
            </p>
            <p className="text-tab text-ink-muted">{t("riskScore")}</p>
          </Link>
        </Card>
        {session ? (
          <Link href="/sessions" className="rounded-xl border border-line bg-surface p-5 shadow-xs hover:shadow-raised">
            <p className="flex items-center gap-2 text-caption font-semibold text-ink-muted">
              <Radio className="size-4 text-risk-500" />
              {t("nextSession")}
            </p>
            <p className="mt-2 text-body-sm font-semibold">{session.title}</p>
            {/* ICU's short Azerbaijani weekdays ("C.", "Ç.") are not read as days: spell them out there. */}
            <p className="mt-1 text-caption text-ink-muted">{format.dateTime(session.startsAt, { weekday: locale === "az" ? "long" : "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </Link>
        ) : null}
      </aside>
    </div>
  );
}

