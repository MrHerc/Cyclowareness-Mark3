"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type StepKey = "welcome" | "menu" | "training" | "phishing" | "secops" | "insights" | "settings" | "quick" | "setup" | "guide";
type Step = {
  key: StepKey;
  /** `data-tour` value of the element to spotlight; none for the centred welcome. */
  anchor: string | null;
  /** Scroll the anchor into view first (the sidebar and the page scroll; the header is sticky). */
  scroll?: ScrollLogicalPosition;
  mood: MascotMood;
  gesture: MascotGesture;
};

/**
 * Every stop of the admin guide. A stop whose anchor is not on screen is skipped: the sidebar groups only
 * exist from lg up (below that the menu button stands in for them), a group the viewer's role or plan hides
 * is not rendered, and the quick actions and the setup checklist live on the overview only.
 */
const STEPS: Step[] = [
  { key: "welcome", anchor: null, mood: "happy", gesture: "wave" },
  { key: "menu", anchor: "admin-menu", mood: "talk", gesture: "point-up" },
  { key: "training", anchor: "admin-group-training", scroll: "nearest", mood: "talk", gesture: "point-left" },
  { key: "phishing", anchor: "admin-group-phishing", scroll: "nearest", mood: "curious", gesture: "inspect" },
  { key: "secops", anchor: "admin-group-secops", scroll: "nearest", mood: "alert", gesture: "shield-up" },
  { key: "insights", anchor: "admin-group-insights", scroll: "nearest", mood: "proud", gesture: "present" },
  { key: "settings", anchor: "admin-group-organisation", scroll: "nearest", mood: "talk", gesture: "explain" },
  { key: "quick", anchor: "admin-quick", scroll: "center", mood: "excited", gesture: "point-down" },
  { key: "setup", anchor: "admin-setup", scroll: "center", mood: "talk", gesture: "count" },
  { key: "guide", anchor: "admin-guide", mood: "happy", gesture: "reassure" },
];

const DONE_KEY = "cw.adminTour.done";
const OPEN_EVENT = "cw:admin-tour";
const PAD = 6; // spotlight padding around the anchor
const GAP = 12; // bubble distance from the spotlight
const MARGIN = 16; // viewport gutter
const START_DELAY = 700; // lets the page reveal finish first

/** The first on-screen element carrying data-tour="…". */
function findAnchor(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function available(): Step[] {
  return STEPS.filter((s) => !s.anchor || findAnchor(s.anchor));
}

/** The header button that replays the guide. */
export function AdminGuideButton() {
  const t = useTranslations("admin.tour");
  return (
    <button
      type="button"
      data-tour="admin-guide"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label={t("openHint")}
      title={t("openHint")}
      className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-full border border-line bg-surface px-2.5 text-caption font-semibold text-ink-muted hover:text-ink sm:px-3.5 pointer-coarse:h-11 pointer-coarse:min-w-11"
    >
      <Compass aria-hidden className="size-[1.15rem] shrink-0" />
      <span aria-hidden className="hidden sm:inline">
        {t("open")}
      </span>
    </button>
  );
}

/**
 * The admin guide: AI Sel in a coach-mark bubble walks through the nav groups, the quick actions, the setup
 * checklist and the Guide button. It starts by itself on the first console visit on this device (remembered
 * in localStorage; when storage is unavailable it only opens from the Guide button) and replays from there.
 */
export function AdminTour({ still = false }: { still?: boolean }) {
  const t = useTranslations("admin.tour");
  const id = useId();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const spotRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // The cat points at the spotlighted item: the angle is kept with its stop, so a new stop starts without one.
  const [aim, setAim] = useState<{ key: StepKey; angle: number } | null>(null);

  useEffect(() => {
    const start = () => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSteps(available());
      setIndex(0);
    };
    window.addEventListener(OPEN_EVENT, start);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!localStorage.getItem(DONE_KEY)) timer = setTimeout(start, START_DELAY);
    } catch {
      // No storage: the guide could not remember being seen, so it waits for the Guide button.
    }
    return () => {
      window.removeEventListener(OPEN_EVENT, start);
      clearTimeout(timer);
    };
  }, []);

  const step = steps ? steps[index] : undefined;

  // Spotlight and bubble follow the anchor; measured again on resize and scroll.
  useLayoutEffect(() => {
    if (!step) return;
    const reduced = still || document.documentElement.dataset.motion === "still" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const place = () => {
      const spot = spotRef.current;
      const bubble = bubbleRef.current;
      if (!spot || !bubble) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bw = bubble.offsetWidth;
      const bh = bubble.offsetHeight;
      const el = step.anchor ? findAnchor(step.anchor) : null;
      let top: number;
      let left: number;
      let target: { x: number; y: number } | null = null;
      if (el) {
        const r = el.getBoundingClientRect();
        target = { x: r.left + r.width / 2, y: r.top + Math.min(r.height, 120) / 2 };
        const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
        Object.assign(spot.style, { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px`, opacity: "1" });
        const right = box.left + box.width;
        const bottom = box.top + box.height;
        if (right < vw / 3 && right + GAP + bw + MARGIN <= vw) {
          // Beside a sidebar group, level with its top part (a long group runs on below the bubble).
          top = box.top + Math.min(box.height, 160) / 2 - bh / 2;
          left = right + GAP;
        } else if (bottom + GAP + bh + MARGIN <= vh) {
          top = bottom + GAP;
          left = box.left + box.width / 2 - bw / 2;
        } else if (box.top - GAP - bh >= MARGIN) {
          top = box.top - GAP - bh;
          left = box.left + box.width / 2 - bw / 2;
        } else {
          top = vh - bh - MARGIN;
          left = vw / 2 - bw / 2;
        }
      } else {
        Object.assign(spot.style, { top: `${vh / 2}px`, left: `${vw / 2}px`, width: "0px", height: "0px", opacity: "1" });
        top = vh / 2 - bh / 2;
        left = vw / 2 - bw / 2;
      }
      top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - bh - MARGIN));
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - bw - MARGIN));
      bubble.style.top = `${top}px`;
      bubble.style.left = `${left}px`;
      bubble.style.visibility = "visible";
      // Measured from where the mascot ends up (the bubble moves there with a transition), in 5° steps.
      const m = mascotRef.current;
      if (target && m) {
        const dx = target.x - (left + m.offsetLeft + m.offsetWidth / 2);
        const dy = top + m.offsetTop + m.offsetHeight / 2 - target.y;
        const angle = ((Math.round((Math.atan2(dy, dx) * 180) / Math.PI / 5) * 5) % 360 + 360) % 360;
        setAim((a) => (a?.key === step.key && a.angle === angle ? a : { key: step.key, angle }));
      }
    };
    if (step.scroll && step.anchor) findAnchor(step.anchor)?.scrollIntoView({ block: step.scroll, behavior: reduced ? "auto" : "smooth" });
    place();
    nextRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, { capture: true });
    };
  }, [step, still]);

  if (!step || !steps) return null;

  const finish = () => {
    setSteps(null);
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      // Not remembered: without storage it does not start by itself anyway.
    }
    returnFocus.current?.focus({ preventScroll: true });
  };
  const go = (delta: 1 | -1) => {
    // Anchors are checked again: the page may have finished loading since the guide started.
    const avail = available();
    const at = Math.max(0, avail.findIndex((s) => s.key === step.key));
    const next = at + delta;
    if (next >= avail.length) return finish();
    setSteps(avail);
    setIndex(Math.max(0, next));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      finish();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Tab") {
      // Focus stays inside the bubble.
      const items = [...(bubbleRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (!items.length || i === -1 || (!e.shiftKey && i === items.length - 1)) {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.shiftKey && i === 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      }
    }
  };

  const total = steps.length;
  const last = index === total - 1;

  return (
    <div tabIndex={-1} onKeyDown={onKey} className="fixed inset-0 z-[70] outline-none">
      <div
        ref={spotRef}
        aria-hidden
        className="pointer-events-none fixed rounded-2xl shadow-[0_0_0_200vmax_rgba(22,18,58,0.55)] ring-2 ring-white/70 transition-[top,left,width,height,opacity] duration-(--duration-base) ease-(--ease-out-expo)"
        style={{ top: "50%", left: "50%", width: 0, height: 0, opacity: 0 }}
      />
      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        className="fixed w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 text-ink shadow-overlay transition-[top,left] duration-(--duration-base) ease-(--ease-out-expo)"
        style={{ visibility: "hidden" }}
      >
        <div className="flex items-start gap-3">
          {/* 80 px: the full-body framing (below that the cat is a head crop and a pointing paw is cut off). */}
          <div ref={mascotRef} className="size-20 shrink-0">
            <Mascot mood={step.mood} gesture={still ? undefined : step.gesture} gestureKey={index} still={still} aim={aim?.key === step.key ? { angle: aim.angle } : null} className="size-full" />
          </div>
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-tab-sm font-semibold text-ink-subtle uppercase">
              {t("label")} · {t("stepOf", { current: index + 1, total })}
            </p>
            <h2 id={`${id}-title`} className="mt-0.5 text-body font-bold text-balance">
              {t(`steps.${step.key}.title`)}
            </h2>
            <p id={`${id}-body`} className="mt-1 text-caption text-ink-muted">
              {t(`steps.${step.key}.body`)}
            </p>
          </div>
          <button type="button" onClick={finish} aria-label={t("skip")} className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:size-11">
            <X className="size-4.5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={finish} className={cn("mr-auto", last && "hidden")}>
            {t("skip")}
          </Button>
          <div className="flex items-center gap-1.5">
            {index > 0 ? (
              <Button variant="secondary" size="sm" icon={<ChevronLeft />} onClick={() => go(-1)}>
                {t("back")}
              </Button>
            ) : null}
            <Button ref={nextRef} size="sm" iconRight={last ? undefined : <ChevronRight />} onClick={() => go(1)}>
              {last ? t("done") : t("next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
