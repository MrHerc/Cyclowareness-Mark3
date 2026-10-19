"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, FlaskConical, Home, LayoutGrid, LifeBuoy, Radio, ShieldCheck, TrendingUp, Trophy, User, Route } from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; key: "home" | "learn" | "paths" | "lab" | "league" | "progress" | "security" | "profile" | "sessions" | "help"; icon: typeof Home };

const PRIMARY: Item[] = [
  { href: "/", key: "home", icon: Home },
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
  { href: "/", key: "home", icon: Home },
  { href: "/learn", key: "learn", icon: BookOpen },
  { href: "/league", key: "league", icon: Trophy },
  { href: "/progress", key: "progress", icon: TrendingUp },
  { href: "/profile", key: "profile", icon: User },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
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
            active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-sunken hover:text-ink",
          )}
        >
          <i.icon className={cn("size-5", active ? "text-brand-600" : "text-ink-subtle")} strokeWidth={active ? 2.25 : 2} />
          {t(i.key)}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={t("main")} className="flex min-h-0 flex-1 flex-col">
      <ul className="grid gap-1">{PRIMARY.filter((i) => !hidden.includes(i.key)).map(link)}</ul>
      <ul className="mt-4 grid gap-1 border-t border-line pt-4">{SECONDARY.filter((i) => !hidden.includes(i.key)).map(link)}</ul>
      {showAdmin ? (
        <div className="mt-auto pt-4">
          <Link href="/admin" className="flex h-11 items-center gap-3 rounded-pill px-4 text-body-sm font-semibold text-ink-muted hover:bg-sunken hover:text-ink">
            <LayoutGrid className="size-5 text-ink-subtle" />
            {t("admin")}
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
                <span className={cn("grid h-8 w-14 place-items-center rounded-pill transition-colors", active && "bg-brand-50")}>
                  <i.icon className={cn("size-5", active ? "text-brand-600" : "text-ink-subtle")} strokeWidth={active ? 2.25 : 2} />
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

