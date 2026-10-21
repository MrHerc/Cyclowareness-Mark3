import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { Flame, Snowflake, Zap } from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer, allowed } from "@/server/auth/viewer";
import { RailNav, TabBar } from "@/components/shell/learner-nav";
import { NotificationsButton } from "@/components/shell/notifications";
import { Protection, Watermark } from "@/components/shell/protection";
import { BrandMark, TenantMark } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { ReportButton } from "@/components/learner/report-button";
import { Tour } from "@/components/learner/tour";
import { dayKey, liveStreak } from "@/lib/domain/gamification";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [tr, tp] = await Promise.all([getTranslations("common"), getTranslations("learner.progress")]);
  const [notes, [mark]] = await Promise.all([
    db().select().from(t.notifications).where(eq(t.notifications.userId, v.user.id)).orderBy(desc(t.notifications.createdAt)).limit(8),
    v.tenant.settings.protection.watermark
      ? db().select({ code: t.watermarkCodes.code }).from(t.watermarkCodes).where(and(eq(t.watermarkCodes.userId, v.user.id), eq(t.watermarkCodes.sessionId, v.sessionId))).limit(1)
      : Promise.resolve([] as { code: string }[]),
  ]);
  const streak = liveStreak(v.user.streakCurrent, v.user.streakLastDay, dayKey(new Date()), v.user.streakFreezes);
  const freezes = v.user.streakFreezes;
  const hidden = [
    ...(!v.tenant.features.has("lab") ? ["lab"] : []),
    ...(!v.tenant.features.has("paths") ? ["paths"] : []),
    ...(!v.tenant.features.has("league") ? ["league"] : []),
    ...(!v.tenant.features.has("live_sessions") ? ["sessions"] : []),
  ];

  return (
    <div className="protected min-h-dvh lg:pl-(--rail-width)">
      <a href="#main" className="sr-only z-90 rounded-pill bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {tr("skip")}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-(--rail-width) flex-col overflow-y-auto border-r border-line bg-surface px-4 pt-6 pb-5 lg:flex">
        <BrandMark className="mb-8 px-3" byline />
        <RailNav showAdmin={allowed(v, "admin.access")} hidden={hidden} />
        <Link href="/profile" className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-sunken">
          <Avatar name={v.user.name} src={v.user.avatarUrl} size="sm" className="bg-safe-50 text-safe-700" />
          <span className="min-w-0">
            <span className="block truncate text-caption font-semibold text-ink">{v.user.name}</span>
            <span className="block truncate text-tab text-ink-subtle">{v.tenant.name}</span>
          </span>
        </Link>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line/70 pt-(--safe-top)">
        {/* The blur sits on a layer, not the header: backdrop-filter would make the header the box every fixed popover inside it is placed in. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-canvas/85 backdrop-blur-xl" />
        <div className="mx-auto flex h-(--topbar-height) max-w-(--container-content) items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-10">
          <TenantMark name={v.tenant.name} logoUrl={v.tenant.branding.logoUrl} className="min-w-0 flex-1" />
          <ReportButton className="pointer-coarse:h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center" />
          <NotificationsButton
            items={notes.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt.toISOString(), read: !!n.readAt }))}
          />
          <Link
            href="/progress"
            data-tour="streak"
            aria-label={freezes ? `${tr("streakAria", { count: streak })}, ${tp("freezes", { count: freezes })}` : tr("streakAria", { count: streak })}
            title={freezes ? tp("freezesHint") : undefined}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-line bg-surface px-3 text-caption font-bold text-ink tabular-nums hover:bg-sunken pointer-coarse:h-11"
          >
            <Flame className={streak ? "size-4.5 fill-reward-400 text-reward-600" : "size-4.5 text-ink-subtle"} />
            {streak}
            {freezes ? (
              <span className="hidden items-center gap-0.5 border-l border-line pl-1.5 text-brand-700 sm:inline-flex">
                <Snowflake className="size-4" />
                {freezes}
              </span>
            ) : null}
          </Link>
          <Link
            href="/progress"
            data-tour="xp"
            aria-label={tr("xpAria", { count: v.user.xp })}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-line bg-surface px-3 text-caption font-bold text-ink tabular-nums hover:bg-sunken pointer-coarse:h-11"
          >
            <Zap className="size-4.5 fill-brand-600 text-brand-600" />
            {v.user.xp}
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-(--container-content) px-4 pt-6 pb-[calc(var(--tabbar-height)+var(--safe-bottom)+2rem)] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
        {children}
      </main>

      <TabBar hidden={hidden} />
      <Protection enabled={v.tenant.settings.protection.contentProtection} />
      <Watermark code={mark?.code ?? null} />
      {!v.user.tourDone ? <Tour org={v.tenant.name} still={v.user.motion === "still"} /> : null}
    </div>
  );
}
