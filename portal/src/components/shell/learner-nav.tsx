"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, FlaskConical, Home, LayoutGrid, LifeBuoy, Loader2, Radio, ShieldCheck, TrendingUp, Trophy, User, Route } from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; key: "home" | "learn" | "paths" | "lab" | "league" | "progress" | "security" | "profile" | "sessions" | "help"; icon: typeof Home };

const PRIMARY: Item[] = [
  { href: "/app", key: "home", icon: Home },
  { href: "/learn", key: "learn", icon: BookOpen },
  { href: "/paths", key: "paths", icon: Route },
  { href: "/lab", key: "lab", icon: FlaskConical },
  { href: "/league", key: "league", icon: Trophy },
  { href: "/progress", key: "progress", icon: TrendingUp },
  { href: "/security", key: "security", icon: ShieldCheck },
  { href: "/profile", key: "profile", icon: User },
];
const SECONDARY: Item[] = [
  { href: "/sessions", key: "sessions", icon: Radio },
  { href: "/help", key: "help", icon: LifeBuoy },
];
const TABS: Item[] = [
  { href: "/app", key: "home", icon: Home },
  { href: "/learn", key: "learn", icon: BookOpen },
  { href: "/league", key: "league", icon: Trophy },
  { href: "/progress", key: "progress", icon: TrendingUp },
  { href: "/profile", key: "profile", icon: User },
];

// The active pill's light: a hairline of brand and a soft brand shadow under it (static, so no motion setting applies).
const ACTIVE_GLOW =
  "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_14%,transparent),0_0.5rem_1.25rem_-0.75rem_color-mix(in_oklab,var(--brand)_60%,transparent)]";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The learner area has no shared loading.tsx: that Suspense boundary would stream the shell with HTTP 200
 * before a page's feature and id checks run, so their notFound() could no longer answer 404. Each route
 * carries its own loading.tsx instead, below a layout that runs those checks first; the clicked item shows
 * that the navigation is under way until that layout has answered and the skeleton arrives.
 */
function PendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-ink-subtle" /> : null;
}

/** The tab's icon, replaced by a spinner while its navigation is pending. */
function TabIcon({ icon: Icon, active }: { icon: typeof Home; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 aria-hidden className="size-5 animate-spin text-ink-subtle" />;
  return <Icon className={cn("size-5", active ? "text-brand-600" : "text-ink-subtle")} strokeWidth={active ? 2.25 : 2} />;
}

export function RailNav({ showAdmin, hidden = [] }: { showAdmin: boolean; hidden?: string[] }) {
  const pathname = usePathname();
  const t = useTranslations("common.nav");
  const link = (i: Item) => {
    const active = isActive(pathname, i.href);
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          data-tour={`nav-${i.key}`}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-11 items-center gap-3 rounded-pill px-4 text-body-sm font-semibold transition-colors",
            active ? ["bg-brand-50 text-brand-700", ACTIVE_GLOW] : "text-ink-muted hover:bg-sunken hover:text-ink",
          )}
        >
          <i.icon className={cn("size-5 shrink-0", active ? "text-brand-600" : "text-ink-subtle")} strokeWidth={active ? 2.25 : 2} />
          <span className="min-w-0 flex-1 truncate">{t(i.key)}</span>
          <PendingMark />
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={t("main")} className="flex flex-1 flex-col">
      <ul className="grid gap-1">{PRIMARY.filter((i) => !hidden.includes(i.key)).map(link)}</ul>
      <ul className="mt-4 grid gap-1 border-t border-line pt-4">{SECONDARY.filter((i) => !hidden.includes(i.key)).map(link)}</ul>
      {showAdmin ? (
        <div className="mt-auto pt-4">
          <Link href="/admin" className="flex h-11 items-center gap-3 rounded-pill px-4 text-body-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink">
            <LayoutGrid className="size-5 shrink-0 text-ink-subtle" />
            <span className="min-w-0 flex-1 truncate">{t("admin")}</span>
            <PendingMark />
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

export function TabBar({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  const t = useTranslations("common.nav");
  const tabs = TABS.filter((i) => !hidden.includes(i.key));
  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-(--safe-bottom) shadow-bar backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-(--tabbar-height) max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} data-tour={`nav-${i.key}`} aria-current={active ? "page" : undefined} className="flex h-full flex-col items-center justify-center gap-1">
                <span className={cn("grid h-8 w-14 place-items-center rounded-pill transition-colors", active && ["bg-brand-50", ACTIVE_GLOW])}>
                  <TabIcon icon={i.icon} active={active} />
                </span>
                <span className={cn("text-tab-sm font-semibold", active ? "text-brand-700" : "text-ink-muted")}>{t(i.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
