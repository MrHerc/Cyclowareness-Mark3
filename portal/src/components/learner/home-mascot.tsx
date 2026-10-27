"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LocateFixed, Rat, Volleyball } from "lucide-react";
import { Mascot } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import type { CatInstance } from "@/components/mascot/cat/engine";
import { TutorPanel } from "@/components/player/tutor-panel";
import { useNarrator } from "@/components/player/narrator";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { runKeyframes, runPlan } from "./home-play";

const REACTIONS: { mood: MascotMood; gesture: MascotGesture }[] = [
  { mood: "happy", gesture: "wave" },
  { mood: "excited", gesture: "hop" },
  { mood: "proud", gesture: "shield-up" },
  { mood: "laughing", gesture: "cheer" },
  { mood: "curious", gesture: "ponder" },
];

// The tap reaction plays before the tutor dialog (and its backdrop) covers the mascot.
const OPEN_DELAY_MS = 600;
// The dash across the card: the first one a minute or so after arriving, then at most one every three to five minutes.
const FIRST_RUN_MS = 60_000;
const RUN_GAP_MS = 180_000;

type Motion = "full" | "calm" | "still";

// The viewer's motion preference on <html> (the pickers change it live) and the OS setting.
function subscribeMotion(fn: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", fn);
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", fn);
    mo.disconnect();
  };
}
function readMotion(): Motion {
  const m = document.documentElement.dataset.motion;
  return m === "still" || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "still" : m === "calm" ? "calm" : "full";
}

function PlayButton({ label, pressed, describedBy, onClick, children }: { label: string; pressed?: boolean; describedBy?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-describedby={describedBy}
      onClick={onClick}
      className={buttonClass("ghost", "icon-sm", "bg-surface/85 text-ink-muted shadow-xs ring-1 ring-line hover:bg-surface aria-pressed:bg-brand-600 aria-pressed:text-brand-on aria-pressed:ring-brand-600")}
    >
      {children}
    </button>
  );
}

/**
 * Home greeting mascot: the cat on its own little card. It waves on arrival, lives on its own (the engine's idle acts:
 * it naps, stretches, grooms, kneads, plays), now and then dashes across the card, reacts when tapped and opens the
 * voice tutor. "Play with Sel" starts a toy mouse, a yarn ball or a laser dot for the pointer (full motion only).
 */
export function HomeMascot({
  label,
  motion: serverMotion = "full",
  tutor,
  soundOn,
  tutorVoice = true,
}: {
  label: string;
  /** The viewer's saved motion preference, for the first render (the page's own setting and the OS one take over after). */
  motion?: Motion;
  /** The lesson the tutor answers about; `contentLocale` is the language of its text when known (default: the interface's). */
  tutor?: { slug: string; lessonKey: string; contentLocale?: string };
  soundOn?: boolean;
  /** The tenant's "tutor_voice" feature: microphone input and spoken answers. */
  tutorVoice?: boolean;
}) {
  const t = useTranslations("learner.home");
  const motion = useSyncExternalStore(subscribeMotion, readMotion, () => serverMotion);
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [laser, setLaser] = useState(false);
  const [side, setSide] = useState<"end" | "start">("end");
  const [running, setRunning] = useState(false);
  const locale = useLocale();
  const narrator = useNarrator({ enabled: soundOn ?? true, rate: 1, lang: locale });
  const opening = useRef<number | null>(null);
  const cat = useRef<CatInstance | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const runAnim = useRef<Animation | null>(null);
  const nextRun = useRef(0);
  const hintId = useId();
  const playable = motion === "full";
  // Opt-in, for this visit only; off under calm and still motion and behind the open dialog.
  const laserOn = laser && playable && !open;

  useEffect(() => {
    const id = setTimeout(() => setTick(1), 600);
    nextRun.current = performance.now() + FIRST_RUN_MS + Math.random() * 30_000;
    return () => {
      clearTimeout(id);
      if (opening.current !== null) window.clearTimeout(opening.current);
    };
  }, []);

  // Without motion there is no reaction to wait for: the dialog opens at once.
  const openTutor = () => {
    if (opening.current !== null) return;
    if (motion === "still") return setOpen(true);
    opening.current = window.setTimeout(() => {
      opening.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  // The laser: Escape turns it off; when it goes off the dot is gone for the cat too.
  useEffect(() => {
    if (!laserOn) {
      cat.current?.laser(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLaser(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [laserOn]);

  /** The dot at the pointer (in the card) and the cat's target (in its own box, which is the button's). */
  const aimLaser = (e: ReactPointerEvent) => {
    if (!laserOn || running || !card.current || !box.current || !dot.current) return;
    const k = card.current.getBoundingClientRect();
    const b = box.current.getBoundingClientRect();
    const rtl = document.documentElement.dir === "rtl";
    dot.current.style.insetInlineStart = `${rtl ? k.right - e.clientX : e.clientX - k.left}px`;
    dot.current.style.top = `${e.clientY - k.top}px`;
    dot.current.hidden = false;
    cat.current?.laser({ x: e.clientX - b.left, y: e.clientY - b.top });
  };
  const dropLaser = (e: ReactPointerEvent) => {
    // A finger leaves on every lift: its dot stays where it was tapped.
    if (!laserOn || e.pointerType === "touch") return;
    if (dot.current) dot.current.hidden = true;
    cat.current?.laser(null);
  };

  const playToy = (toy: "mouse" | "yarn") => {
    if (running) return;
    setLaser(false);
    cat.current?.play(toy);
  };

  // Now and then (full motion, card on screen, the cat sitting idle) it dashes to the card's other side and sits there.
  useEffect(() => {
    if (!playable || open || laserOn || running) return;
    const id = window.setInterval(() => {
      const c = cat.current;
      const b = box.current;
      const tr = track.current;
      if (!c || !b || !tr || document.hidden || performance.now() < nextRun.current || c.state.behaviour !== "present") return;
      const br = b.getBoundingClientRect();
      if (br.bottom < 0 || br.top > window.innerHeight) return;
      const plan = runPlan(tr.getBoundingClientRect(), br);
      if (plan.distancePx < 40) return;
      const r = c.run(plan);
      nextRun.current = performance.now() + RUN_GAP_MS + Math.random() * 120_000;
      if (!r.end) return; // no gallop (the engine said no): the cat stays where it is
      setRunning(true);
      runAnim.current = b.animate(runKeyframes(r), { duration: r.end, fill: "forwards" });
      void r.done.then(() => {
        setRunning(false);
        setSide((s) => (s === "end" ? "start" : "end"));
      });
    }, 5_000);
    return () => window.clearInterval(id);
  }, [playable, open, laserOn, running]);
  // The box now sits on the other side: drop the finished move before the frame is painted.
  useLayoutEffect(() => {
    runAnim.current?.cancel();
    runAnim.current = null;
  }, [side]);

  const r = REACTIONS[i % REACTIONS.length];
  return (
    <>
      <div
        ref={card}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") aimLaser(e);
        }}
        onPointerDown={aimLaser}
        onPointerLeave={dropLaser}
        className="relative h-44 w-full shrink-0 overflow-hidden rounded-2xl bg-brand-50/70 ring-1 ring-brand-100 sm:h-48 lg:w-[min(28rem,55%)]"
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-brand-100/60 to-transparent" />
        {playable ? (
          <div role="group" aria-label={t("play")} className="absolute start-2 top-2 z-10 flex items-center gap-1">
            <span aria-hidden className="ps-1.5 pe-1 text-tab-sm font-semibold text-ink-muted max-sm:sr-only">
              {t("play")}
            </span>
            <PlayButton label={t("playMouse")} onClick={() => playToy("mouse")}>
              <Rat aria-hidden />
            </PlayButton>
            <PlayButton label={t("playYarn")} onClick={() => playToy("yarn")}>
              <Volleyball aria-hidden />
            </PlayButton>
            <PlayButton label={t("playLaser")} pressed={laserOn} describedBy={hintId} onClick={() => setLaser((on) => !on)}>
              <LocateFixed aria-hidden />
            </PlayButton>
            <span id={hintId} className="sr-only">
              {t("laserHint")}
            </span>
          </div>
        ) : null}
        {/* The track the cat sits and runs on; its box is half again as wide as tall, a stage the engine plays across. */}
        <div ref={track} className="absolute inset-x-1 inset-y-0">
          <button
            ref={box}
            type="button"
            aria-label={label}
            aria-haspopup={tutor ? "dialog" : undefined}
            onClick={() => {
              setI((x) => x + 1);
              setTick((x) => x + 1);
              if (tutor) openTutor();
            }}
            className={cn(
              "absolute bottom-0 h-32 w-48 cursor-pointer rounded-2xl focus-visible:-outline-offset-2 sm:h-36 sm:w-54",
              side === "end" ? "end-0" : "start-0",
              running && "pointer-events-none",
            )}
          >
            {/* Behind the open dialog the cat holds still (one animation loop less). */}
            <Mascot
              mood={tick ? r.mood : "idle"}
              gesture={tick ? r.gesture : undefined}
              gestureKey={tick}
              className="size-full"
              still={motion === "still" || open}
              auto
              onCat={(c) => {
                cat.current = c;
              }}
            />
          </button>
        </div>
        {laserOn ? <span ref={dot} hidden aria-hidden className="pointer-events-none absolute z-20 -ms-1.5 -mt-1.5 size-3 rounded-full bg-[#ff4a3d] shadow-[0_0_6px_3px_rgb(255_60_60/0.45)] ring-2 ring-[#ff4a3d]/30" /> : null}
      </div>
      {tutor ? (
        <TutorPanel
          open={open}
          onClose={() => {
            narrator.stop();
            setOpen(false);
          }}
          slug={tutor.slug}
          lessonKey={tutor.lessonKey}
          sceneId={null}
          contentLocale={tutor.contentLocale}
          speak={(text, lang) => narrator.speak(text, { lang })}
          speaking={narrator.speaking}
          voice={tutorVoice}
          soundOn={soundOn ?? true}
        />
      ) : null}
    </>
  );
}
