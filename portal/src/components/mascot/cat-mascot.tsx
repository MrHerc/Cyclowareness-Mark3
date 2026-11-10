"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/lib/cn";
// Types only: the 234 KB engine is loaded after mount (below), so it stays out of the first load of the
// sign-in and landing pages; the server renders an empty box either way.
import type { CatBehaviour, CatInstance } from "./cat/engine";
import { ACT_TO_CAT, BOUNCE_MS, FIRE_TO_CAT, GESTURE_TO_CAT, HOPS, HOP_MS, bounceKeyframes, catMood, fireDue, heldGesture, hopKeyframes, lookDirection, mirrorForRtl, motionOff, talkLevel } from "./cat/props";
import type { MascotAct, MascotGesture, MascotMood, MascotTopic } from "./mapping";
import type { MascotAim, MascotFire, MascotGuide } from "./rive-mascot";

// The same prop types as the Rive mascot (type-only: nothing of the Rive runtime is loaded).
export type { MascotAim, MascotFire, MascotGuide, MascotTrigger } from "./rive-mascot";

/** Angle in degrees (0 = right, 90 = up) from the centre of `from` to the centre of `to`, for the `aim` prop. */
export function angleBetween(from: Element, to: Element): number {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  // Screen y grows downwards; the aim angle grows anticlockwise.
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  return (Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360;
}

// Motion off: the viewer's "still" preference on <html> (set at once by the motion pickers) or the OS setting.
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
function readMotionOff(): boolean {
  return motionOff(false, document.documentElement.dataset.motion, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// The acts the engine's own idle scheduler can pick (setAuto), which a narration interrupts; filled when the
// engine loads, before any cat exists.
let autoActs = new Set<string>();

// Read in effects only (the server renders an empty box), so it cannot cause a hydration mismatch.
const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** Moves the whole cat (a hop in place or toward a side) with the Web Animations API on its host element. */
function jump(el: HTMLElement | null, frames: Keyframe[], ms: number) {
  if (el && typeof el.animate === "function") el.animate(frames, { duration: ms, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" });
}

/**
 * The Cyclowareness mascot: AI Sel as the grey tabby-and-white cat (a Canvas 2D rig, ./cat/engine.js,
 * started in the browser after mount). Same props as the Rive mascot; ./cat/props.ts maps them onto the
 * engine. The server renders an empty box of the same size, so nothing shifts when the cat appears.
 */
export function Mascot({
  mood = "idle",
  talking = false,
  gesture,
  gestureKey,
  className,
  label,
  onPoke,
  still = false,
  aimAt,
  aim,
  act,
  guide,
  fire,
  facing,
  onCat,
  auto = false,
}: {
  mood?: MascotMood;
  talking?: boolean;
  gesture?: MascotGesture;
  /** Changes to replay the same gesture. */
  gestureKey?: string | number;
  /** Accepted for the Rive mascot's topic props; the cat has none. */
  topic?: MascotTopic;
  className?: string;
  label?: string;
  onPoke?: () => void;
  still?: boolean;
  /** Where to look, as a direction from the mascot's centre (x, y in -1..1; y grows downwards); unset looks straight ahead. */
  aimAt?: { x: number; y: number } | null;
  /** Where to point (the cat points left, right or down and looks there); null or unset lowers the paw. */
  aim?: MascotAim;
  /** What the mascot does while idle; leaving "nap" wakes it. */
  act?: MascotAct;
  guide?: MascotGuide;
  fire?: MascotFire;
  /** Which way the cat sits (default right; the other way in a right-to-left page); the drawing is mirrored for "left". The Rive robot ignores it. */
  facing?: "left" | "right";
  /** Receives the engine instance once it runs (and null when it is destroyed), for hosts that drive it directly, e.g. jump(). */
  onCat?: (cat: CatInstance | null) => void;
  /**
   * Decorative placements only (Home, landing, sign-in panel, security overview): the cat lives on its own, sleeping
   * after a long idle, stretching, grooming, kneading, yawning, playing (calm keeps to the quiet acts; still stays
   * frozen). Narration placements (player, tours, tutor) leave it off. Turning it off brings the cat back to sitting.
   */
  auto?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState<CatInstance | null>(null);
  const off = useSyncExternalStore(subscribeMotion, readMotionOff, () => false) || still;
  // For the one-shot effects below, which must not replay when only the motion setting changes.
  const offRef = useRef(off);
  useEffect(() => {
    offRef.current = off;
  });

  // A language switch refreshes the page without remounting, so the cat is rebuilt to face the new direction.
  const locale = useLocale();
  // The engine draws on a canvas, so it starts after mount and is destroyed on unmount.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let made: CatInstance | null = null;
    let gone = false;
    void import("./cat/engine").then(({ createCat, mascotAutoWeights }) => {
      if (gone) return;
      autoActs = new Set(Object.keys(mascotAutoWeights({ stage: true, idle: Infinity })).filter((k) => k !== "present"));
      made = createCat(el, { mode: "mascot", aria: false, facing: mirrorForRtl(facing ?? "right", isRtl(el)) });
      setCat(made);
    });
    return () => {
      gone = true;
      made?.destroy();
    };
  }, [facing, locale]);

  // Kept in a ref so a new callback each render does not re-run the effect.
  const onCatRef = useRef(onCat);
  useEffect(() => {
    onCatRef.current = onCat;
  });
  useEffect(() => {
    if (!cat) return;
    onCatRef.current?.(cat);
    return () => onCatRef.current?.(null);
  }, [cat]);

  // First, so the gesture and act effects below already see a still cat.
  useEffect(() => {
    cat?.setStill(off);
  }, [cat, off]);

  const wasAuto = useRef(false);
  useEffect(() => {
    if (!cat) return;
    cat.setAuto(auto);
    if (wasAuto.current && !auto && !offRef.current && autoActs.has(cat.state.behaviour ?? "")) cat.do("present");
    wasAuto.current = auto;
  }, [cat, auto]);

  const { listen, whisper, peer, travel } = guide ?? {};
  const moodName = catMood(mood, { listen });
  useEffect(() => {
    cat?.setMood(moodName);
  }, [cat, moodName]);

  const level = talkLevel({ whisper });
  useEffect(() => {
    cat?.setTalking(talking, level);
  }, [cat, talking, level]);

  // Idle acts are behaviours; none while motion is off (as with the Rive mascot), and a change only starts one.
  const behaviour = ACT_TO_CAT[act ?? "rest"];
  const lastBehaviour = useRef<CatBehaviour>("present");
  useEffect(() => {
    if (!cat || off || behaviour === lastBehaviour.current) return;
    lastBehaviour.current = behaviour;
    cat.do(behaviour);
  }, [cat, off, behaviour]);

  useEffect(() => {
    if (!cat || !gesture) return;
    const g = GESTURE_TO_CAT[gesture];
    if (g) cat.play(mirrorForRtl(g, !!host.current && isRtl(host.current)));
    if (HOPS.has(gesture) && !offRef.current) jump(host.current, bounceKeyframes(), BOUNCE_MS);
  }, [cat, gesture, gestureKey]);

  // Pointing at an element (aim), peering or listening keeps the pose until it is unset.
  const held = heldGesture(aim, { peer, listen });
  useEffect(() => {
    if (!cat || !held) return;
    cat.hold(held);
    return () => {
      cat.hold(null);
    };
  }, [cat, held]);

  const travelDir = off ? null : (travel ?? null);
  const look = lookDirection(aimAt, aim, travelDir);
  const lookX = look ? look.x : null;
  const lookY = look ? look.y : 0;
  useEffect(() => {
    cat?.lookToward(lookX, lookY);
  }, [cat, lookX, lookY]);

  // The travel walk becomes a small hop in place toward that side (the look above turns the head).
  useEffect(() => {
    if (cat && travelDir) jump(host.current, hopKeyframes(travelDir), HOP_MS);
  }, [cat, travelDir]);

  // One-shot moves: on every change of the key, and when the cat has loaded with key 0 (see fireDue); none
  // while motion is off.
  const fireName = fire?.name;
  const fireKey = fire?.key;
  const seenFire = useRef<{ key: number | undefined } | null>(null);
  useEffect(() => {
    if (!cat) return;
    const first = seenFire.current === null;
    const prevKey = seenFire.current?.key;
    seenFire.current = { key: fireKey };
    if (!fireName || fireKey === undefined || !fireDue(first, prevKey, fireKey) || offRef.current) return;
    const cue = FIRE_TO_CAT[fireName];
    if ("play" in cue) cat.play(cue.play);
    else if ("do" in cue) cat.do(cue.do);
    else if ("hop" in cue) jump(host.current, bounceKeyframes(), BOUNCE_MS);
    else cat.poke();
  }, [cat, fireName, fireKey]);

  // Named only where it stands alone; next to visible text it is decorative. A press pets the cat (the engine
  // listens on its own element) and calls onPoke.
  return (
    <div
      className={cn("relative", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerDown={onPoke ? () => onPoke() : undefined}
    >
      <div ref={host} className="absolute inset-0" />
    </div>
  );
}
