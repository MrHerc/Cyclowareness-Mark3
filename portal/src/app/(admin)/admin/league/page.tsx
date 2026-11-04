import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Trophy } from "lucide-react";
import { db } from "@/server/db";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { departmentLeague } from "@/server/services/league";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BackLink, EmptyState } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { daysLeftInMonth } from "@/lib/domain/league";
import { FullscreenButton } from "@/components/admin/fullscreen-button";
import { cn } from "@/lib/cn";
import { TrendMark } from "@/app/(learner)/league/trend";

export async function generateMetadata() {
  const tr = await getTranslations("admin.league");
  return { title: tr("title") };
}

export default async function AdminLeague() {
  const v = await requirePermission("league.read");
  if (!hasFeature(v, "league")) notFound();
  const [tr, tl, tc, format, locale] = await Promise.all([getTranslations("admin.league"), getTranslations("learner.league"), getTranslations("common"), getFormatter(), getLocale()]);
  const rows = await departmentLeague(db(), v.tenant.id);
  const now = new Date();
  // az and ru month names are lowercase ("oktyabr 2026", "октябрь 2026 г."); this one starts the line.
  const month = format.dateTime(now, { month: "long", year: "numeric" });
  return (
    <div id="league-board" className="grid grid-cols-[minmax(0,1fr)] gap-6 bg-canvas">
      <div className="grid gap-3">
        <div>
          <h1 className="text-headline font-bold">{tr("title")}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-body font-semibold text-ink">
            {month.charAt(0).toLocaleUpperCase(locale) + month.slice(1)}
            <Pill tone="brand">
              <CalendarDays />
              {tc("time.daysLeft", { count: daysLeftInMonth(now) })}
            </Pill>
            <span className="inline-flex items-center gap-1.5 text-caption font-normal text-ink-muted">
              <span className="size-2 animate-pulse rounded-full bg-safe-500" />
              {tr("updated", { time: format.dateTime(now, { hour: "2-digit", minute: "2-digit" }) })}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BackLink href="/admin" className="px-1">
            {tr("back")}
          </BackLink>
          <FullscreenButton label={tr("fullscreen")} target="league-board" />
        </div>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Trophy />}
            title={tr("empty")}
            body={tr("emptyBody")}
            action={allowed(v, "departments.write") ? <ButtonLink href="/admin/departments">{tr("toDepartments")}</ButtonLink> : null}
          />
        </Card>
      ) : (
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {rows.map((r) => (
            <li
              key={r.id}
              className={cn(
                "relative isolate flex items-center gap-3 rounded-2xl border bg-surface p-4 sm:gap-8 sm:p-7",
                r.place === 1 ? "border-reward-400 shadow-[0_2px_4px_#16123a0d,0_24px_56px_-22px_color-mix(in_oklab,var(--accent)_60%,transparent)] ring-4 ring-reward-200 [--light:var(--accent)]" : "border-line shadow-raised",
              )}
            >
              {/* The leader in light: one pass across the row as the board opens, and a halo that breathes round the medal. */}
              {r.place === 1 ? <span aria-hidden className="light-sweep [--sweep-delay:0.5s]" /> : null}
              <span className={cn("relative grid size-12 shrink-0 place-items-center rounded-full font-display text-title font-bold sm:size-20 sm:text-headline", r.place === 1 ? "bg-reward-500 text-(--accent-on)" : r.place <= 3 ? "bg-brand-600 text-brand-on" : "bg-sunken text-ink-muted")}>
                {r.place === 1 ? <span aria-hidden className="glow-ring animate-breathe" /> : null}
                {r.place}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-display text-title-sm font-bold sm:truncate sm:text-headline" title={r.name}>
                  {r.name}
                </p>
                <p className="text-body text-ink-muted">{tr("learners", { count: r.learners })}</p>
                <ProgressBar decorative value={r.points} size="lg" tone={r.place === 1 ? "reward" : "brand"} className="mt-3" />
              </div>
              <span className="shrink-0 font-display text-headline font-bold tabular-nums sm:text-display">{r.points}</span>
              <TrendMark trend={r.trend} label={tl(`trend_${r.trend}`)} className="size-6 [&_svg]:size-5" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
