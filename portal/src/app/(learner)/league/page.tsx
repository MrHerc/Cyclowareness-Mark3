import { getTranslations } from "next-intl/server";
import { BookOpen, Flag, Trophy } from "lucide-react";
import { requireFeature } from "@/server/auth/viewer";
import { myLeagueRow } from "@/server/queries/learner";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/layout";
import { daysLeftInMonth } from "@/lib/domain/league";
import { REPORT_BONUS_XP } from "@/lib/domain/gamification";
import { cn } from "@/lib/cn";
import { TrendMark } from "./trend";

export async function generateMetadata() {
  const t = await getTranslations("learner.league");
  return { title: t("title") };
}

export default async function LeaguePage() {
  const v = await requireFeature("league");
  const [t, tc] = await Promise.all([getTranslations("learner.league"), getTranslations("common")]);
  const { rows, mine } = await myLeagueRow(v);
  const top = rows.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 lg:col-span-2">
        <div>
          <h1 className="text-headline font-bold">{t("title")}</h1>
          <p className="mt-1.5 text-body-sm text-ink-muted">{t("sub")}</p>
        </div>
        <Pill tone="reward" className="px-3.5 py-1.5 text-caption">
          {tc("time.daysLeft", { count: daysLeftInMonth(new Date()) })}
        </Pill>
      </header>

      {rows.length === 0 ? (
        <Card className="lg:col-span-2">
          <EmptyState icon={<Trophy />} title={t("empty")} />
        </Card>
      ) : (
        <>
          <div className="grid min-w-0 gap-6">
            <section aria-labelledby="podium">
              <h2 id="podium" className="sr-only">
                {t("top")}
              </h2>
              <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
                {podium.map((r) => {
                  const first = r.place === 1;
                  return (
                    <div key={r.id} className="flex flex-col items-center text-center">
                      {first ? <Trophy className="mb-2 size-9 fill-laurel-500 text-laurel-600" /> : null}
                      <p className={cn("line-clamp-2 text-caption font-semibold sm:text-body-sm", r.id === mine?.id && "text-reward-ink")}>{r.name}</p>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-numeral font-bold tabular-nums">{r.points}</span>
                        <TrendMark trend={r.trend} label={t(`trend_${r.trend}`)} />
                      </span>
                      <div
                        className={cn(
                          "mt-2 grid w-full place-items-start justify-center rounded-t-xl pt-3 text-title font-bold",
                          first ? "h-36 bg-brand-600 text-brand-on" : r.place === 2 ? "h-28 bg-brand-100 text-brand-700" : "h-20 bg-brand-100 text-brand-700",
                          r.id === mine?.id && "ring-4 ring-reward-400",
                        )}
                      >
                        {r.place}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {rows.length > 3 ? (
              <section aria-labelledby="others">
                <h2 id="others" className="sr-only">
                  {t("others")}
                </h2>
                <ol className="grid gap-2.5">
                  {rows.slice(3).map((r) => {
                    const me = r.id === mine?.id;
                    return (
                      <li key={r.id} className={cn("flex items-center gap-4 rounded-xl border bg-surface p-4 shadow-xs", me ? "border-reward-400 ring-2 ring-reward-200" : "border-line")}>
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full font-bold", me ? "bg-reward-500 text-(--accent-on)" : "bg-sunken text-ink-muted")}>{r.place}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-semibold">{r.name}</p>
                          <p className="text-tab text-ink-subtle">{me ? t("yourDepartment") : tc("units.learners", { count: r.learners })}</p>
                          <ProgressBar value={r.points} tone={me ? "reward" : "brand"} size="sm" className="mt-2" />
                        </div>
                        <span className="text-title-sm font-bold tabular-nums">{r.points}</span>
                        <TrendMark trend={r.trend} label={t(`trend_${r.trend}`)} />
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)] lg:self-start">
            <Card className="p-6">
              <h2 className="text-title-sm font-semibold">{t("howTitle")}</h2>
              <div className="mt-4 grid gap-4">
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600">
                    <BookOpen className="size-5" />
                  </span>
                  <div>
                    <p className="text-body-sm font-semibold">{t("howFinish")}</p>
                    <p className="text-caption text-ink-muted">{t("howFinishBody", { value: mine?.completion ?? 0 })}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-reward-100 text-reward-500">
                    <Flag className="size-5" />
                  </span>
                  <div>
                    <p className="text-body-sm font-semibold">{t("howReport")}</p>
                    <p className="text-caption font-semibold text-reward-ink">{t("howReportBonus", { xp: REPORT_BONUS_XP })}</p>
                    <p className="text-caption text-ink-muted">{t("howReportBody", { value: mine?.reportRate ?? 0 })}</p>
                  </div>
                </div>
              </div>
              <p className="mt-5 border-t border-line pt-4 text-caption text-ink-subtle">{t("formula")}</p>
            </Card>
          </aside>
        </>
      )}
    </div>
  );
}
