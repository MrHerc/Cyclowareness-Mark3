import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, Minus } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { departmentLeague } from "@/server/services/league";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { daysLeftInMonth } from "@/lib/domain/league";
import { FullscreenButton } from "@/components/admin/fullscreen-button";
import { cn } from "@/lib/cn";

export async function generateMetadata() {
  const tr = await getTranslations("admin.league");
  return { title: tr("title") };
}

export default async function AdminLeague() {
  const v = await requirePermission("league.read");
  const [tr, tc, format] = await Promise.all([getTranslations("admin.league"), getTranslations("common"), getFormatter()]);
  const rows = await departmentLeague(db(), v.tenant.id);
  const now = new Date();
  return (
    <div id="league-board" className="grid gap-6 bg-canvas">
      <div className="grid gap-3">
        <div>
          <h1 className="text-headline font-bold">{tr("title")}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-body font-semibold text-ink">
            {format.dateTime(now, { month: "long", year: "numeric" })}
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
          <Link href="/admin" className="inline-flex items-center gap-1 px-1 text-caption font-semibold text-brand-700 hover:text-brand-900">
            <ArrowLeft className="size-4" />
            {tr("back")}
          </Link>
          <FullscreenButton label={tr("fullscreen")} target="league-board" />
        </div>
      </div>
      <ol className="grid gap-4">
        {rows.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-5 rounded-2xl border bg-surface p-5 shadow-raised sm:gap-8 sm:p-7", r.place === 1 ? "border-reward-400 ring-4 ring-reward-200" : "border-line")}>
            <span className={cn("grid size-16 shrink-0 place-items-center rounded-full font-display text-title font-bold sm:size-20 sm:text-headline", r.place === 1 ? "bg-reward-500 text-(--accent-on)" : r.place <= 3 ? "bg-brand-600 text-brand-on" : "bg-sunken text-ink-muted")}>{r.place}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-title font-bold sm:text-headline">{r.name}</p>
              <p className="text-body text-ink-muted">{tr("learners", { count: r.learners })}</p>
              <ProgressBar value={r.points} size="lg" tone={r.place === 1 ? "reward" : "brand"} className="mt-3" />
            </div>
            <span className="font-display text-display font-bold tabular-nums">{r.points}</span>
            <Minus className="size-6 text-ink-subtle" aria-hidden />
          </li>
        ))}
      </ol>
    </div>
  );
}
