import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Award, BookCheck, Eye, Flame, FlaskConical, Footprints, Route, ShieldCheck, Signature, Snowflake, Zap } from "lucide-react";
import { requireViewer } from "@/server/auth/viewer";
import { getCatalog } from "@/server/queries/catalog";
import { xpByDay } from "@/server/queries/learner";
import { badgesFor } from "@/server/queries/badges";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar, Ring } from "@/components/ui/progress";
import { BarChart, Heatmap } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/layout";
import { ModuleIcon } from "@/components/learner/module-icon";
import { BADGES, dayKey, levelFor, liveStreak } from "@/lib/domain/gamification";
import { riskBand } from "@/lib/domain/risk";
import { cn } from "@/lib/cn";

const BADGE_ICON = { first_step: Footprints, module_master: BookCheck, sharp_eye: Eye, streak_7: Flame, policy_keeper: Signature, lab_explorer: FlaskConical, certified_5: Award, path_finisher: Route } as const;

export async function generateMetadata() {
  const t = await getTranslations("learner.progress");
  return { title: t("title") };
}

export default async function ProgressPage() {
  const v = await requireViewer();
  const locale = await getLocale();
  const [t, tc, format, catalog, days, badges] = await Promise.all([getTranslations("learner.progress"), getTranslations("common"), getFormatter(), getCatalog(v, locale), xpByDay(v), badgesFor(v.user.id, v.tenant.id)]);
  // Chart labels in the UI language (the screen-reader tables and the heatmap tooltips); the day is a Baku day.
  const points = days.map((d) => ({ value: d.value, label: format.dateTime(new Date(`${d.label}T12:00:00+04:00`), { day: "numeric", month: "short" }) }));
  const lvl = levelFor(v.user.xp);
  const streak = liveStreak(v.user.streakCurrent, v.user.streakLastDay, dayKey(new Date()), v.user.streakFreezes);
  const band = riskBand(v.user.riskScore);
  const started = catalog.filter((m) => m.status !== "not_started").sort((a, b) => b.percent - a.percent);
  const completed = catalog.filter((m) => m.status === "completed").length;
  const activeDays = days.filter((d) => d.value > 0).length;

  return (
    <div className="grid gap-6">
      <h1 className="text-headline font-bold">{t("title")}</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
        <section className="flex flex-col items-center justify-center rounded-2xl bg-brand-600 p-8 text-center text-brand-on shadow-raised">
          <Ring value={lvl.progress} size={140} stroke={12} tone="white" label={`${t("level")} ${lvl.level}`}>
            <span className="text-display leading-none font-bold">{lvl.level}</span>
          </Ring>
          <p className="mt-4 text-body font-bold">{t("level")}</p>
          <p className="mt-0.5 text-caption opacity-90">{lvl.next === null ? t("maxLevel") : t("toNext", { percent: Math.round(lvl.progress * 100) })}</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <span className="grid size-10 place-items-center rounded-sm bg-brand-50 text-brand-600">
              <Zap className="size-5" />
            </span>
            <p className="mt-3 text-numeral font-bold tabular-nums">{format.number(v.user.xp)}</p>
            <p className="text-caption text-ink-muted">{t("xp")}</p>
          </Card>
          <Card className="p-5">
            <span className={cn("grid size-10 place-items-center rounded-sm", streak ? "bg-reward-100 text-reward-600" : "bg-sunken text-ink-subtle")}>
              <Flame className="size-5" />
            </span>
            <p className="mt-3 text-numeral font-bold tabular-nums">{streak}</p>
            <p className="text-caption text-ink-muted">{t("streak")}</p>
            <p className="mt-0.5 text-tab text-ink-subtle">{t("longest", { count: v.user.streakLongest })}</p>
            {v.user.streakFreezes > 0 ? (
              <p className="mt-1.5 inline-flex items-center gap-1 text-tab font-semibold text-brand-700" title={t("freezesHint")}>
                <Snowflake className="size-3.5" />
                {t("freezes", { count: v.user.streakFreezes })}
              </p>
            ) : null}
          </Card>
          <Link href="/security" className="rounded-xl border border-line bg-surface p-5 shadow-xs hover:shadow-raised sm:col-span-2">
            <span className={cn("grid size-10 place-items-center rounded-sm", band === "low" ? "bg-safe-50 text-safe-600" : band === "medium" ? "bg-warn-50 text-warn-700" : "bg-risk-50 text-risk-600")}>
              <ShieldCheck className="size-5" />
            </span>
            <p className="mt-3 text-numeral font-bold tabular-nums">{v.user.riskScore}</p>
            <p className="text-caption text-ink-muted">{t("risk")}</p>
            <p className="mt-0.5 text-tab text-ink-subtle">{band === "low" ? t("riskLow") : band === "medium" ? t("riskMedium") : t("riskHigh")}</p>
          </Link>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-title-sm font-semibold">{t("modules")}</h2>
          <p className="text-caption text-ink-muted">{t("completedOf", { done: completed, total: catalog.length })}</p>
        </div>
        {started.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {started.map((m) => (
              <li key={m.slug}>
                <Link href={`/learn/${m.slug}`} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-raised">
                  <ModuleIcon slug={m.slug} category={m.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold">{m.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar decorative value={m.percent} tone={m.status === "completed" ? "safe" : "reward"} size="sm" />
                      <span className="text-tab font-bold tabular-nums">{m.percent}%</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <EmptyState title={t("noneStarted")} />
          </Card>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("xp30")} />
          <CardBody>
            <BarChart points={points} caption={t("xp30")} headers={[tc("chart.date"), tc("chart.xp")]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("activity")} description={t("activeDays", { count: activeDays })} />
          <CardBody>
            <Heatmap days={points} caption={t("activity")} headers={[tc("chart.date"), tc("chart.xp")]} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("badges")} />
        <CardBody>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BADGES.map((b) => {
              const Icon = BADGE_ICON[b];
              const earned = badges.includes(b);
              return (
                <li key={b} className={cn("flex flex-col items-center rounded-xl p-4 text-center", earned ? "bg-reward-100/60" : "bg-sunken opacity-70")}>
                  <span className={cn("grid size-14 place-items-center rounded-full", earned ? "bg-reward-500 text-(--accent-on) shadow-raised" : "bg-surface text-ink-disabled")}>
                    <Icon className="size-7" />
                  </span>
                  <p className="mt-2.5 text-caption font-bold">{t(`badge.${b}`)}</p>
                  <p className="mt-0.5 text-tab text-ink-muted">{t(`badge.${b}_body`)}</p>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
