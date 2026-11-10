import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { Flame, Snowflake, Zap } from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer, allowed } from "@/server/auth/viewer";
import { RailNav, TabBar } from "@/components/shell/learner-nav";
import { NotificationsButton } from "@/components/shell/notifications";
import { Protection, Watermark } from "@/components/shell/protection";
import { BrandMark, TenantMark, isVendorLogo } from "@/components/brand";
import { Avatar } from "@/components/ui/avatar";
import { ReportButton } from "@/components/learner/report-button";
import { Tour } from "@/components/learner/tour";
import { LanguageSwitcher } from "@/components/language-switcher";
import { IntlScope } from "@/components/intl-scope";
import { dayKey, liveStreak } from "@/lib/domain/gamification";

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const [tr, tp, format] = await Promise.all([getTranslations("common"), getTranslations("learner.progress"), getFormatter()]);
  const [notes, [mark]] = await Promise.all([
    db().select().from(t.notifications).where(eq(t.notifications.userId, v.user.id)).orderBy(desc(t.notifications.createdAt)).limit(8),
    v.tenant.settings.protection.watermark
      ? db().select({ code: t.watermarkCodes.code }).from(t.watermarkCodes).where(and(eq(t.watermarkCodes.userId, v.user.id), eq(t.watermarkCodes.sessionId, v.sessionId))).limit(1)
      : Promise.resolve([] as { code: string }[]),
  ]);
  const streak = liveStreak(v.user.streakCurrent, v.user.streakLastDay, dayKey(new Date(), v.tenant.settings.timeZone), v.user.streakFreezes);
  const freezes = v.user.streakFreezes;
  const hidden = [
    ...(!v.tenant.features.has("lab") ? ["lab"] : []),
    ...(!v.tenant.features.has("paths") ? ["paths"] : []),
    ...(!v.tenant.features.has("league") ? ["league"] : []),
    ...(!v.tenant.features.has("live_sessions") ? ["sessions"] : []),
  ];

  return (
    <IntlScope surface="learner">
      <div className="protected min-h-dvh lg:ps-(--rail-width)">
        <a href="#main" className="sr-only z-90 rounded-pill bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:start-3">
          {tr("skip")}
        </a>

        <aside className="fixed inset-y-0 start-0 z-30 hidden w-(--rail-width) flex-col overflow-y-auto border-e border-line bg-surface px-4 pt-6 pb-5 lg:flex">
          <BrandMark href="/app" className="mb-8 px-3" byline />
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
          {/* gap-1.5 below sm: with the language picker, six pills must fit a 320 px phone. */}
          <div className="mx-auto flex h-(--topbar-height) max-w-(--container-content) items-center gap-1.5 px-4 sm:gap-3 sm:px-6 lg:px-10">
            {/* The vendor's own wordmark already sits in the rail lockup; below the rail breakpoint the product mark takes its place. */}
            {isVendorLogo(v.tenant.branding.logoUrl) ? (
              <span className="flex min-w-0 flex-1">
                <BrandMark href="/app" className="h-8 min-w-0 flex-wrap overflow-hidden lg:hidden" />
              </span>
            ) : (
              <TenantMark name={v.tenant.name} logoUrl={v.tenant.branding.logoUrl} className="min-w-0 flex-1" />
            )}
            <LanguageSwitcher locales={v.tenant.settings.locales} className="h-10" />
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
              <span className="relative grid place-items-center">
                {streak ? <span aria-hidden className="pointer-events-none absolute -inset-1.5 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_40%,transparent),transparent)] opacity-60 print:hidden" /> : null}
                <Flame className={streak ? "relative size-4.5 fill-reward-400 text-reward-600" : "size-4.5 text-ink-subtle"} />
              </span>
              {streak}
              {freezes ? (
                <span className="hidden items-center gap-0.5 border-s border-line ps-1.5 text-brand-700 sm:inline-flex">
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
              {format.number(v.user.xp)}
            </Link>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-(--container-content) px-4 pt-6 pb-[calc(var(--tabbar-height)+var(--safe-bottom)+2rem)] sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          {children}
        </main>

        <TabBar hidden={hidden} />
        <Protection enabled={v.tenant.settings.protection.contentProtection} />
        <Watermark code={mark?.code ?? null} />
        {!v.user.tourDone ? <Tour org={v.tenant.name} goal={v.tenant.settings.learning.dailyGoalXp} league={v.tenant.features.has("league")} still={v.user.motion === "still"} /> : null}
      </div>
    </IntlScope>
  );
}
