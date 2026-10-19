"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Building2,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Menu,
  MessageSquareHeart,
  Radar,
  Radio,
  Recycle,
  Route,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Trophy,
  TriangleAlert,
  Users,
  Wand2,
  Landmark,
  Globe2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type AdminNavItem = { key: string; href: string; badge?: number };
export type AdminNavGroup = { key: string; heading?: boolean; items: AdminNavItem[] };

const ICONS: Record<string, typeof Users> = {
  overview: LayoutDashboard,
  people: Users,
  departments: Building2,
  assignments: ClipboardList,
  campaigns: Megaphone,
  policies: FileText,
  problems: TriangleAlert,
  ops: Gauge,
  loops: Recycle,
  threats: Inbox,
  approvals: ShieldCheck,
  incidents: Siren,
  sandbox: FlaskConical,
  risk: Activity,
  threatIntel: Radar,
  policyIntel: Landmark,
  studio: Wand2,
  paths: Route,
  sessions: Radio,
  reports: BarChart3,
  leadership: Sparkles,
  league: Trophy,
  audit: ScrollText,
  support: LifeBuoy,
  feedback: MessageSquareHeart,
  settings: Settings,
  tenants: Globe2,
  learnerView: BookOpenCheck,
};

function active(pathname: string, search: string, href: string) {
  const [path, query] = href.split("?");
  if (path === "/admin") return pathname === "/admin";
  if (query) return pathname === path && search.includes(query);
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function AdminNav({ groups, onNavigate }: { groups: AdminNavGroup[]; onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <nav aria-label={t("workspace")} className="grid gap-5">
      {groups.map((g) => (
        <div key={g.key}>
          {g.heading !== false ? <p className="mb-1.5 px-3 text-tab-sm font-bold tracking-wider text-ink-subtle uppercase">{t(g.key as "workspace")}</p> : null}
          <ul className="grid gap-0.5">
            {g.items.map((i) => {
              const Icon = ICONS[i.key] ?? ShieldAlert;
              const on = active(pathname, search, i.href);
              return (
                <li key={i.key}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-pill px-3 text-body-sm font-semibold transition-colors",
                      on ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <Icon className={cn("size-[1.15rem] shrink-0", on ? "text-brand-600" : "text-ink-subtle")} />
                    <span className="min-w-0 flex-1 truncate">{t(i.key as "overview")}</span>
                    {i.badge ? <span className="grid min-w-5 place-items-center rounded-pill bg-reward-500 px-1.5 text-tab-sm font-bold text-(--accent-on) tabular-nums">{i.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminMobileMenu({ groups, children }: { groups: AdminNavGroup[]; children?: React.ReactNode }) {
  const t = useTranslations("common.nav");
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so navigating anywhere closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (v: boolean) => setOpenedOn(v ? pathname : null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("openMenu")} className="grid size-10 place-items-center rounded-full border border-line bg-surface lg:hidden">
        <Menu className="size-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] animate-rise flex-col overflow-y-auto bg-surface p-4 shadow-overlay">
            <button type="button" onClick={() => setOpen(false)} aria-label={t("menu")} className="mb-3 ml-auto grid size-10 place-items-center rounded-full hover:bg-sunken">
              <X className="size-5" />
            </button>
            <AdminNav groups={groups} onNavigate={() => setOpen(false)} />
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
