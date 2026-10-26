"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Building2,
  ChevronDown,
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
  Loader2,
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

/**
 * The console has no admin-wide loading.tsx: that Suspense boundary would stream the shell with HTTP 200
 * before a page's permission and id checks run, so their notFound() could no longer answer 404. While the
 * next page renders, the clicked item shows that the navigation is under way instead.
 */
function PendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-ink-subtle" /> : null;
}

/* Collapsed headed groups, remembered on this device in a cookie so the server renders them collapsed too (no
 * flash of open groups on a full page load). Without cookies the last value lives in memory for this tab. */
const ADMIN_NAV_COOKIE = "cw-admin-nav"; // read by the admin layout under the same name
const COLLAPSED_EVENT = "cw:admin-nav";
let collapsedMemory: string | null = null;

function readCollapsed(): string {
  if (collapsedMemory !== null) return collapsedMemory;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${ADMIN_NAV_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(ADMIN_NAV_COOKIE.length + 1)) : "";
}

function writeCollapsed(keys: string[]) {
  collapsedMemory = keys.join(",");
  document.cookie = `${ADMIN_NAV_COOKIE}=${encodeURIComponent(collapsedMemory)}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  return () => window.removeEventListener(COLLAPSED_EVENT, onChange);
}

export function AdminNav({ groups, collapsedInitial = "", onNavigate }: { groups: AdminNavGroup[]; collapsedInitial?: string; onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const id = useId();
  // The server renders from the cookie the layout read, so hydration starts from the same state.
  const stored = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => collapsedInitial);
  const collapsed = stored ? stored.split(",") : [];
  // The current page's group always opens on arrival; collapsing it there holds only until the next page.
  const [closedHere, setClosedHere] = useState<{ group: string; path: string } | null>(null);

  return (
    <nav aria-label={t("workspace")} className="grid gap-3">
      {groups.map((g) => {
        const headed = g.heading !== false;
        const hasActive = g.items.some((i) => active(pathname, search, i.href));
        const open = !headed || (hasActive ? !(closedHere?.group === g.key && closedHere.path === pathname) : !collapsed.includes(g.key));
        const badgeSum = g.items.reduce((n, i) => n + (i.badge ?? 0), 0);
        const listId = `${id}-${g.key}`;
        const toggle = () => {
          const rest = collapsed.filter((k) => k !== g.key);
          if (open) {
            writeCollapsed([...rest, g.key]);
            if (hasActive) setClosedHere({ group: g.key, path: pathname });
          } else {
            writeCollapsed(rest);
            if (hasActive) setClosedHere(null);
          }
        };
        return (
          <div key={g.key} data-tour={`admin-group-${g.key}`}>
            {headed ? (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-controls={listId}
                className="mb-0.5 flex min-h-8 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-tab-sm leading-tight font-bold tracking-wider text-ink-subtle uppercase transition-colors hover:bg-sunken hover:text-ink pointer-coarse:min-h-11"
              >
                <span className="min-w-0 flex-1">{t(g.key as "workspace")}</span>
                {!open && hasActive ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand-600" /> : null}
                {!open && badgeSum ? <span className="grid min-w-5 place-items-center rounded-pill bg-reward-500 px-1.5 text-tab-sm font-bold tracking-normal text-(--accent-on) tabular-nums normal-case">{badgeSum}</span> : null}
                <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform duration-(--duration-fast)", !open && "-rotate-90")} />
              </button>
            ) : null}
            <ul id={listId} hidden={!open} className="grid gap-0.5">
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
                        "flex h-10 items-center gap-3 rounded-pill px-3 text-body-sm font-semibold transition-colors pointer-coarse:h-11",
                        on ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100 ring-inset" : "text-ink-muted hover:bg-sunken hover:text-ink",
                      )}
                    >
                      <Icon aria-hidden className={cn("size-[1.15rem] shrink-0", on ? "text-brand-600" : "text-ink-subtle")} />
                      <span className="min-w-0 flex-1 truncate">{t(i.key as "overview")}</span>
                      <PendingMark />
                      {i.badge ? <span className="grid min-w-5 place-items-center rounded-pill bg-reward-500 px-1.5 text-tab-sm font-bold text-(--accent-on) tabular-nums">{i.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Below lg the console nav lives in a left drawer. It is a native modal <dialog>, so it renders in the top layer:
 * no ancestor (the sticky, blurred header) can clip or re-anchor it, and focus trap, Escape, an inert page and
 * focus returning to the menu button come with it.
 */
export function AdminMobileMenu({ groups, collapsedInitial, children }: { groups: AdminNavGroup[]; collapsedInitial?: string; children?: React.ReactNode }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  // The menu remembers the page it was opened on, so navigating anywhere closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (v: boolean) => setOpenedOn(v ? pathname : null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.openMenu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tour="admin-menu"
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface lg:hidden pointer-coarse:size-11"
      >
        <Menu className="size-5" />
      </button>
      <dialog
        ref={ref}
        aria-label={t("nav.menu")}
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className="inset-y-0 right-auto left-0 m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none overflow-y-auto overscroll-contain border-0 bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/30 backdrop:backdrop-blur-sm open:animate-rise"
      >
        {open ? (
          <div className="flex min-h-full flex-col px-4 pt-[calc(var(--safe-top)+1rem)] pb-[calc(var(--safe-bottom)+1rem)]">
            <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="mb-3 ml-auto grid size-10 shrink-0 place-items-center rounded-full hover:bg-sunken pointer-coarse:size-11">
              <X className="size-5" />
            </button>
            <AdminNav groups={groups} collapsedInitial={collapsedInitial} onNavigate={() => setOpen(false)} />
            {children}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
