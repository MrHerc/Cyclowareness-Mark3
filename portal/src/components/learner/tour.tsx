"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import { Button } from "@/components/ui/button";
import { markTourDoneAction } from "@/server/actions/profile";
import { cn } from "@/lib/cn";

type StepKey = "welcome" | "home" | "learn" | "league" | "progress" | "profile" | "streak" | "xp" | "continue" | "path";
type Step = {
  key: StepKey;
  /** `data-tour` value of the element to spotlight; none for the centred welcome. */
  anchor: string | null;
  /** Scroll the anchor into view first (page content; the rail, header and tab bar are fixed). */
  scroll?: ScrollLogicalPosition;
  mood: MascotMood;
  gesture: MascotGesture;
};

/** Every stop of the tour; a stop whose anchor is not on screen (hidden feature, nothing to continue) is skipped. */
const STEPS: Step[] = [
  { key: "welcome", anchor: null, mood: "happy", gesture: "wave" },
  { key: "home", anchor: "nav-home", mood: "talk", gesture: "point-left" },
  { key: "learn", anchor: "nav-learn", mood: "curious", gesture: "lecture" },
  { key: "league", anchor: "nav-league", mood: "excited", gesture: "cheer" },
  { key: "progress", anchor: "nav-progress", mood: "proud", gesture: "present" },
  { key: "profile", anchor: "nav-profile", mood: "talk", gesture: "explain" },
  { key: "streak", anchor: "streak", mood: "excited", gesture: "hop" },
  { key: "xp", anchor: "xp", mood: "happy", gesture: "count" },
  { key: "continue", anchor: "continue", scroll: "center", mood: "talk", gesture: "point-down" },
  { key: "path", anchor: "path", scroll: "start", mood: "proud", gesture: "reassure" },
];

const PAD = 6; // spotlight padding around the anchor
const GAP = 12; // bubble distance from the spotlight
const MARGIN = 16; // viewport gutter
const START_DELAY = 700; // lets the page reveal finish first

/** The first on-screen element carrying data-tour="…": the rail and the tab bar both render the nav. */
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

/**
 * Onboarding coach marks on Home: the mascot and a caption bubble walk through the navigation,
 * the streak and XP pills, the Continue card and "Your path". Mounted by the learner layout while
 * `users.tourDone` is false; finishing or skipping marks it done.
 */
export function Tour({ org, still = false }: { org: string; still?: boolean }) {
  const onHome = usePathname() === "/";
  const t = useTranslations("learner.tour");
  const id = useId();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const spotRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Starts after the page reveal; restarts from the top when the person comes back to Home mid-tour.
  useEffect(() => {
    if (!onHome || finished) return;
    const timer = setTimeout(() => {
      setSteps(available());
      setIndex(0);
    }, START_DELAY);
    return () => clearTimeout(timer);
  }, [onHome, finished]);

  const step = onHome && steps ? steps[index] : undefined;

  // Spotlight and bubble follow the anchor; measured again on resize and scroll.
  useLayoutEffect(() => {
    if (!step) return;
    const reduced = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      if (el) {
        const r = el.getBoundingClientRect();
        const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
        Object.assign(spot.style, { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px`, opacity: "1" });
        const right = box.left + box.width;
        const bottom = box.top + box.height;
        if (right < vw / 3 && right + GAP + bw + MARGIN <= vw) {
          // Beside a rail item.
          top = box.top + box.height / 2 - bh / 2;
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
      bubble.style.top = `${Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - bh - MARGIN))}px`;
      bubble.style.left = `${Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - bw - MARGIN))}px`;
      bubble.style.visibility = "visible";
    };
    if (step.scroll) findAnchor(step.anchor!)?.scrollIntoView({ block: step.scroll, behavior: reduced ? "auto" : "smooth" });
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
    setFinished(true);
    setSteps(null);
    void markTourDoneAction();
  };
  const go = (delta: 1 | -1) => {
    // Anchors are checked again: the page may have finished loading since the tour started.
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
  const title = step.key === "welcome" ? t("steps.welcome.title", { org }) : t(`steps.${step.key}.title`);

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
          <Mascot mood={step.mood} gesture={still ? undefined : step.gesture} gestureKey={index} still={still} className="size-16 shrink-0" />
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-tab-sm font-semibold text-ink-subtle uppercase">
              {t("label")} · {t("stepOf", { current: index + 1, total })}
            </p>
            <h2 id={`${id}-title`} className="mt-0.5 text-body font-bold text-balance">
              {title}
            </h2>
            <p id={`${id}-body`} className="mt-1 text-caption text-ink-muted">
              {t(`steps.${step.key}.body`)}
            </p>
          </div>
          <button type="button" onClick={finish} aria-label={t("skip")} className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink">
            <X className="size-4.5" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={finish} className={cn(last && "invisible")}>
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
