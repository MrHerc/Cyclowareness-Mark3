"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dirOf } from "@/i18n/config";
import { ChevronLeft, ListChecks, Maximize2, Minimize2, Minus, MonitorSmartphone, SignalHigh, Volume2, Wifi, X, BatteryFull, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClientFormat, useOrgTimeZone } from "@/lib/client-format";
import type { AppId } from "../model/labs";
import { APP_ORDER, APP_SIZE, clampWindow, fitWindow, type WmAction, type WmState } from "../model/wm";
import { useSeconds, zonedClock } from "./hooks";

export type VmApp = { id: AppId; label: string; icon: ReactNode; tile: string; content: ReactNode; badge?: number };

const WALLPAPER =
  "radial-gradient(110% 80% at 0% 0%, #4c3bb8 0%, transparent 55%), radial-gradient(80% 70% at 100% 100%, #0e7490 0%, transparent 60%), radial-gradient(60% 50% at 75% 20%, #7c3aed55 0%, transparent 70%), linear-gradient(155deg, #1c1745 0%, #101a38 100%)";

function Clock({ stacked }: { stacked?: boolean }) {
  const t = useTranslations("learner.lab.vm");
  const format = useClientFormat();
  const secs = useSeconds();
  const timeZone = useOrgTimeZone();
  if (!secs) return null;
  const { time } = zonedClock(secs, timeZone);
  // The organisation's day in the UI language's numeric order (az/ru 25.10.2026, en 10/25/2026).
  const date = format.dateTime(secs * 1000, { day: "numeric", month: "numeric", year: "numeric" });
  return (
    <span className={cn("text-right leading-tight tabular-nums", stacked ? "grid" : "")}>
      <span className="sr-only">{t("clock")} </span>
      <span className="font-semibold">{time}</span>
      {stacked ? <span className="text-[0.6875rem] opacity-80">{date}</span> : null}
    </span>
  );
}

/** One app window: title bar (drag with a mouse or pen), minimise, maximise, close. */
function AppWindow({ app, wm, act, desk }: { app: VmApp; wm: WmState; act: (a: WmAction) => void; desk: { w: number; h: number } }) {
  const t = useTranslations("learner.lab.vm");
  const win = wm.wins[app.id];
  const focused = wm.focus === app.id;
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const size = APP_SIZE[app.id];
  // Leave the desktop icons in view when there is room, and never overflow the desktop.
  const w = Math.max(280, Math.min(size.w, desk.w - 16, Math.max(520, desk.w - 100)));
  const h = Math.max(220, Math.min(size.h, desk.h - 16));
  const pos = win.moved ? clampWindow(win.x, win.y, w, desk.w, desk.h) : fitWindow(win.x, win.y, w, h, desk.w, desk.h);

  // Focus follows the window manager, without stealing focus from a control already inside the window.
  useEffect(() => {
    const el = ref.current;
    if (focused && el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [focused, win.z]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || win.max || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const c = clampWindow(d.x + e.clientX - d.px, d.y + e.clientY - d.py, w, desk.w, desk.h);
    act({ type: "move", app: app.id, x: c.x, y: c.y });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const btn = "grid size-8 place-items-center rounded-md text-ink-muted hover:bg-black/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600 pointer-coarse:size-11 [&_svg]:size-4";
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={app.label}
      hidden={win.min}
      onPointerDownCapture={() => act({ type: "focus", app: app.id })}
      onFocusCapture={() => act({ type: "focus", app: app.id })}
      className={cn(
        "absolute flex animate-rise flex-col overflow-clip border bg-surface text-ink outline-none",
        win.max ? "rounded-none border-transparent" : "rounded-[0.75rem] border-black/10",
        focused ? "shadow-overlay" : "shadow-raised",
      )}
      style={win.max ? { inset: 0, zIndex: win.z } : { left: pos.x, top: pos.y, width: w, height: h, zIndex: win.z }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) act({ type: "toggleMax", app: app.id });
        }}
        className={cn("flex h-10 shrink-0 touch-none items-center gap-2 border-b border-line pr-1 pl-3 select-none pointer-coarse:h-12", focused ? "bg-[#f1f0f7]" : "bg-[#f7f7fa] text-ink-muted", !win.max && "cursor-grab active:cursor-grabbing")}
      >
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-[5px] text-white [&_svg]:size-3", app.tile)} aria-hidden>
          {app.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-tab font-semibold">{app.label}</span>
        <button type="button" className={btn} aria-label={t("win.minimise")} onClick={() => act({ type: "minimise", app: app.id })}>
          <Minus />
        </button>
        <button type="button" className={btn} aria-label={win.max ? t("win.restore") : t("win.maximise")} onClick={() => act({ type: "toggleMax", app: app.id })}>
          {win.max ? <Minimize2 /> : <Maximize2 />}
        </button>
        <button type="button" className={cn(btn, "hover:bg-risk-600 hover:text-white")} aria-label={t("win.close")} onClick={() => act({ type: "close", app: app.id })}>
          <X />
        </button>
      </div>
      <div className="@container relative min-h-0 flex-1 overflow-clip">{app.content}</div>
    </section>
  );
}

function Desktop({ apps, wm, act, host }: { apps: VmApp[]; wm: WmState; act: (a: WmAction) => void; host: string }) {
  const t = useTranslations("learner.lab.vm");
  const deskRef = useRef<HTMLDivElement>(null);
  const [desk, setDesk] = useState({ w: 800, h: 520 });
  useLayoutEffect(() => {
    const el = deskRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setDesk({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const byId = new Map(apps.map((a) => [a.id, a]));
  return (
    <div className="relative flex h-[clamp(30rem,calc(100dvh-18.5rem),42rem)] flex-col overflow-clip rounded-[0.9rem]" style={{ background: WALLPAPER }}>
      <div ref={deskRef} className="relative min-h-0 flex-1 overflow-clip" aria-label={t("desktop")} role="group">
        <ul className="absolute top-3 left-1.5 grid gap-1">
          {apps.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => act({ type: "open", app: a.id })}
                className="group grid w-[4.5rem] justify-items-center gap-1.5 rounded-lg px-1 py-2 text-white hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
              >
                <span className={cn("relative grid size-11 place-items-center rounded-[0.8rem] shadow-raised ring-1 ring-white/15 [&_svg]:size-5.5", a.tile)}>
                  {a.icon}
                  {a.badge ? <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-risk-500 text-[0.625rem] font-bold">{a.badge}</span> : null}
                </span>
                <span className="w-full truncate text-center text-tab-sm font-medium [text-shadow:0_1px_2px_#0008]">{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p aria-hidden className="pointer-events-none absolute right-4 bottom-3 text-right font-mono text-[0.6875rem] leading-tight text-white/40">
          {host}
          <br />
          Lumen Freight · VM
        </p>
        {APP_ORDER.map((id) => {
          const a = byId.get(id);
          return a && wm.wins[id].open ? <AppWindow key={id} app={a} wm={wm} act={act} desk={desk} /> : null;
        })}
      </div>
      <nav aria-label={t("taskbar")} className="flex h-12 shrink-0 items-center gap-1 border-t border-white/10 bg-[#0d1024]/80 px-2 text-white backdrop-blur-md">
        <span aria-hidden className="mr-1 grid size-9 place-items-center rounded-md text-white/80 [&_svg]:size-4.5">
          <LayoutGrid />
        </span>
        {apps.map((a) => {
          const win = wm.wins[a.id];
          const active = wm.focus === a.id && win.open && !win.min;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => act({ type: "taskbar", app: a.id })}
              aria-label={a.label}
              aria-pressed={active}
              title={a.label}
              className={cn("relative grid size-10 place-items-center rounded-md hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white pointer-coarse:size-11 [&_svg]:size-5", active && "bg-white/15")}
            >
              {a.icon}
              <span aria-hidden className={cn("absolute bottom-0.5 h-0.75 rounded-pill transition-[width,background-color]", win.open ? (active ? "w-4 bg-[#a5b4fc]" : "w-1.5 bg-white/60") : "w-0")} />
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-3 pr-1 text-tab-sm">
          <span aria-hidden className="flex items-center gap-2 text-white/80 [&_svg]:size-4">
            <Wifi />
            <Volume2 />
          </span>
          <Clock stacked />
          <button type="button" onClick={() => act({ type: "home" })} aria-label={t("showDesktop")} title={t("showDesktop")} className="h-9 w-2 rounded-xs border-l border-white/25 hover:bg-white/15 pointer-coarse:w-4" />
        </span>
      </nav>
    </div>
  );
}

/** The phone layout: one full-screen app at a time and an app switcher at the bottom (with the mission as "Tasks"). */
function Phone({ apps, wm, act, panel, tasksBadge }: { apps: VmApp[]; wm: WmState; act: (a: WmAction) => void; panel: ReactNode; tasksBadge?: string }) {
  const t = useTranslations("learner.lab.vm");
  const locale = useLocale();
  const [tasks, setTasks] = useState(false);
  const current = wm.focus ? apps.find((a) => a.id === wm.focus) : undefined;
  const title = tasks ? t("apps.tasks") : (current?.label ?? t("home"));
  return (
    <div className="flex h-[max(34rem,calc(100dvh-var(--topbar-height)-var(--tabbar-height)-var(--safe-bottom)-3rem))] flex-col overflow-clip rounded-[1.6rem] bg-surface">
      <div className="flex h-7 shrink-0 items-center justify-between bg-[#0d1024] px-5 text-tab-sm text-white">
        <Clock />
        <span aria-hidden className="flex items-center gap-1.5 [&_svg]:size-3.5">
          <SignalHigh />
          <Wifi />
          <BatteryFull />
        </span>
      </div>
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line bg-[#f7f7fa] px-1.5">
        {tasks || current ? (
          <button
            type="button"
            onClick={() => (tasks ? setTasks(false) : act({ type: "home" }))}
            aria-label={t("home")}
            className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-sunken [&_svg]:size-5"
          >
            <ChevronLeft />
          </button>
        ) : (
          <span aria-hidden className="grid size-11 place-items-center text-ink-subtle [&_svg]:size-5">
            <MonitorSmartphone />
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate text-body-sm font-semibold">{title}</h2>
        {current && !tasks ? (
          <button type="button" onClick={() => act({ type: "close", app: current.id })} aria-label={t("win.close")} className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-sunken [&_svg]:size-5">
            <X />
          </button>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        {/* The mission panel is the portal's own page, so it keeps the page's direction. */}
        {tasks ? (
          <div dir={dirOf(locale)} className="absolute inset-0 overflow-y-auto">
            {panel}
          </div>
        ) : null}
        {apps.map((a) =>
          wm.wins[a.id].open ? (
            <section key={a.id} aria-label={a.label} hidden={tasks || wm.focus !== a.id} className="@container absolute inset-0 overflow-clip">
              {a.content}
            </section>
          ) : null,
        )}
        {!tasks && !current ? (
          <div className="absolute inset-0 overflow-y-auto p-5" style={{ background: WALLPAPER }}>
            <ul className="grid grid-cols-3 gap-y-5">
              {apps.map((a) => (
                <li key={a.id} className="grid justify-items-center">
                  <button type="button" onClick={() => act({ type: "open", app: a.id })} className="grid min-h-11 justify-items-center gap-1.5 rounded-lg px-2 py-1 text-white focus-visible:outline-2 focus-visible:outline-white">
                    <span className={cn("relative grid size-14 place-items-center rounded-[1rem] shadow-raised ring-1 ring-white/15 [&_svg]:size-6.5", a.tile)}>
                      {a.icon}
                      {a.badge ? <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-risk-500 text-tab-sm font-bold">{a.badge}</span> : null}
                    </span>
                    <span className="text-tab font-medium [text-shadow:0_1px_2px_#0008]">{a.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <nav aria-label={t("switcher")} className="grid h-16 shrink-0 grid-cols-5 border-t border-line bg-surface">
        {apps.map((a) => {
          const active = !tasks && wm.focus === a.id;
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setTasks(false);
                act({ type: "open", app: a.id });
              }}
              className={cn("grid place-items-center content-center gap-0.5 text-[0.6875rem] font-semibold [&_svg]:size-5", active ? "text-brand-700" : "text-ink-muted")}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-pill", active && "bg-brand-100")}>{a.icon}</span>
              <span className="max-w-full truncate px-0.5">{a.label}</span>
            </button>
          );
        })}
        <button type="button" aria-pressed={tasks} onClick={() => setTasks(!tasks)} className={cn("relative grid place-items-center content-center gap-0.5 text-[0.6875rem] font-semibold [&_svg]:size-5", tasks ? "text-brand-700" : "text-ink-muted")}>
          <span className={cn("relative grid h-7 w-12 place-items-center rounded-pill", tasks && "bg-brand-100")}>
            <ListChecks />
            {tasksBadge ? <span className="absolute -top-1.5 -right-1 rounded-pill bg-brand-600 px-1 text-[0.625rem] leading-4 font-bold text-brand-on tabular-nums">{tasksBadge}</span> : null}
          </span>
          <span className="max-w-full truncate px-0.5">{t("apps.tasks")}</span>
        </button>
      </nav>
    </div>
  );
}

/**
 * The virtual machine: a monitor with a desktop, app windows and a taskbar; on phones (under 640 px) a
 * phone with one full-screen app and a bottom app switcher, where the mission panel becomes the Tasks app.
 */
export function VmShell({ apps, wm, act, panel, phone, host, label, tasksBadge }: { apps: VmApp[]; wm: WmState; act: (a: WmAction) => void; panel: ReactNode; phone: boolean; host: string; label: string; tasksBadge?: string }) {
  // A simulated left-to-right OS in every language: windows are placed by physical x, and only the content panes
  // (mail body, web page, the phone's Tasks) take the learner's direction.
  if (phone)
    return (
      <div role="region" aria-label={label} dir="ltr" className="rounded-[2rem] bg-[#0f1222] p-1.5 shadow-overlay">
        <Phone apps={apps} wm={wm} act={act} panel={panel} tasksBadge={tasksBadge} />
      </div>
    );
  return (
    <div role="region" aria-label={label} dir="ltr" className="min-w-0">
      <div className="relative rounded-[1.4rem] bg-[#0f1222] p-2.5 pt-4 shadow-overlay">
        <span aria-hidden className="absolute top-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-white/20" />
        <Desktop apps={apps} wm={wm} act={act} host={host} />
      </div>
      <div aria-hidden className="mx-auto h-3 w-1/4 rounded-b-xl bg-gradient-to-b from-[#1b1f36] to-[#2a2f4d]" />
    </div>
  );
}
