"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Alignment, DeprecationKeys, Fit, Layout, Rive, RuntimeLoader, useRive, type StateMachineInput } from "@rive-app/react-canvas";
import { cn } from "@/lib/cn";
import {
  ACT_INDEX,
  AIM_HAND,
  GESTURE_INDEX,
  MOOD_INDEX,
  POKE_ZONE_INDEX,
  TOPIC_INDEX,
  TRAVEL_DIR,
  type MascotAct,
  type MascotAimHand,
  type MascotGesture,
  type MascotMood,
  type MascotPokeZone,
  type MascotTopic,
  type MascotTravelDir,
} from "./mapping";

// The runtime is served from our own origin (CSP: no third-party scripts or wasm). The fallback build
// (for browsers without wasm SIMD) must be local too, or the runtime would try the CDN and be blocked.
RuntimeLoader.setWasmUrl("/rive/rive.wasm");
RuntimeLoader.setWasmFallbackUrl("/rive/rive_fallback.wasm");
// mascot.riv drives its state machine with classic inputs (no data-binding view models), so this notice is expected.
Rive.suppressDeprecationWarnings = [DeprecationKeys.stateMachineInputs];

const SM = "Main";

/** Where the mascot points or looks: degrees around it (0 = right, 90 = up); the hand follows the target's side unless given. */
export type MascotAim = { angle: number; hand?: MascotAimHand } | null;

/** The guide poses of the "Main" state machine (bools) and the travel walk with its depart/arrive triggers. */
export type MascotGuide = {
  wait?: boolean;
  listen?: boolean;
  perch?: boolean;
  whisper?: boolean;
  peer?: boolean;
  trace?: boolean;
  travel?: MascotTravelDir | null;
};

export type MascotTrigger = "bounce" | "knock" | "touch" | "wipe" | "huff" | "tap" | "poke";

/** A one-shot trigger, fired whenever `key` changes (and once when the mascot loads with it); `zone` applies to poke. */
export type MascotFire = { name: MascotTrigger; key: number; zone?: MascotPokeZone };

/** Angle in degrees (0 = right, 90 = up) from the centre of `from` to the centre of `to`, for the `aim` prop. */
export function angleBetween(from: Element, to: Element): number {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  // Screen y grows downwards; the aim angle grows anticlockwise.
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  return (Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360;
}

/** Poke zone from the vertical position inside the canvas: antenna on top, then head, face and body (inferred split). */
function pokeZoneAt(fraction: number): MascotPokeZone {
  return fraction < 0.2 ? "antenna" : fraction < 0.45 ? "head" : fraction < 0.7 ? "face" : "body";
}

// Reduced motion (the viewer's "still" preference on <html>, or the OS setting) keeps the one-shot moves, acts and the travel walk off.
function subscribeMotion(fn: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
function readStill(): boolean {
  return document.documentElement.dataset.motion === "still" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The Cyclowareness mascot (Rive). Inputs of the "Main" state machine: mood, talking, gesture +
 * gesture-play, topic, lookX/lookY, aimOn/aimAngle/aimHand, idleAct + idle-play/wake, the guide
 * bools (wait, listen, perch, whisper, peer, trace), travel/travelDir + depart/arrive, pokeZone and the
 * one-shot triggers. Unknown inputs are ignored safely.
 */
export function Mascot({
  mood = "idle",
  talking = false,
  gesture,
  gestureKey,
  topic,
  className,
  label,
  onPoke,
  still = false,
  aimAt,
  aim,
  act,
  guide,
  fire,
}: {
  mood?: MascotMood;
  talking?: boolean;
  gesture?: MascotGesture;
  /** Changes to replay the same gesture. */
  gestureKey?: string | number;
  topic?: MascotTopic;
  className?: string;
  label?: string;
  onPoke?: () => void;
  still?: boolean;
  /** Where to look, as a direction from the mascot's centre (x, y in -1..1; y grows downwards); unset looks straight ahead. */
  aimAt?: { x: number; y: number } | null;
  /** Where to point with a hand (aimOn/aimAngle/aimHand); null or unset lowers the hand. */
  aim?: MascotAim;
  /** What the mascot does while idle; leaving "nap" wakes it. */
  act?: MascotAct;
  guide?: MascotGuide;
  fire?: MascotFire;
}) {
  const { rive, RiveComponent } = useRive({
    src: "/rive/mascot.riv",
    artboard: "Mascot",
    stateMachine: SM,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  });
  const inputs = useRef<Map<string, StateMachineInput>>(new Map());
  const calm = useSyncExternalStore(subscribeMotion, readStill, () => false);

  useEffect(() => {
    if (!rive) return;
    const map = new Map<string, StateMachineInput>();
    for (const i of rive.stateMachineInputs(SM) ?? []) map.set(i.name, i);
    inputs.current = map;
  }, [rive]);

  // Only inputs the file has are touched; the helpers read the ref, so the effects below need no extra dependencies.
  const set = (name: string, value: number | boolean) => {
    const input = inputs.current.get(name);
    if (input) input.value = value;
  };
  const trigger = (name: string) => inputs.current.get(name)?.fire();

  useEffect(() => {
    if (rive) set("mood", MOOD_INDEX[mood] ?? 0);
  }, [rive, mood]);
  useEffect(() => {
    if (rive) set("talking", talking);
  }, [rive, talking]);
  useEffect(() => {
    if (rive && topic) set("topic", TOPIC_INDEX[topic] ?? 0);
  }, [rive, topic]);
  useEffect(() => {
    if (!rive || !gesture) return;
    set("gesture", GESTURE_INDEX[gesture] ?? 0);
    trigger("gesture-play");
  }, [rive, gesture, gestureKey]);
  useEffect(() => {
    if (!rive) return;
    if (still) rive.pause();
    else rive.play();
  }, [rive, still]);
  // The look inputs run 0..2 with 1 straight ahead (the pointer handler below uses the same scale).
  const aimX = aimAt ? Math.max(-1, Math.min(1, aimAt.x)) : 0;
  const aimY = aimAt ? Math.max(-1, Math.min(1, aimAt.y)) : 0;
  useEffect(() => {
    if (!rive) return;
    set("lookX", 1 + aimX);
    set("lookY", 1 + aimY);
  }, [rive, aimX, aimY]);

  // Pointing: the right hand covers the poses R270..R90 (through 0), the left hand L90..L270.
  const aimOn = !!aim;
  const aimAngle = aim ? ((aim.angle % 360) + 360) % 360 : 0;
  const aimHand: MascotAimHand = aim?.hand ?? (aimAngle > 90 && aimAngle < 270 ? "left" : "right");
  useEffect(() => {
    if (!rive) return;
    set("aimOn", aimOn);
    if (!aimOn) return;
    set("aimAngle", aimAngle);
    set("aimHand", AIM_HAND[aimHand]);
  }, [rive, aimOn, aimAngle, aimHand]);

  // Idle acts: idle-play starts the chosen act; a nap ends with the wake trigger (inferred from act_nap_in/loop/wake).
  const idleAct: MascotAct = calm ? "rest" : (act ?? "rest");
  const lastAct = useRef<MascotAct>("rest");
  useEffect(() => {
    if (!rive) return;
    const leavingNap = lastAct.current === "nap" && idleAct !== "nap";
    lastAct.current = idleAct;
    set("idleAct", ACT_INDEX[idleAct]);
    if (leavingNap) trigger("wake");
    if (idleAct !== "rest") trigger("idle-play");
  }, [rive, idleAct]);

  const { wait = false, listen = false, perch = false, whisper = false, peer = false, trace = false, travel = null } = guide ?? {};
  useEffect(() => {
    if (!rive) return;
    set("wait", wait);
    set("listen", listen);
    set("perch", perch);
    set("whisper", whisper);
    set("peer", peer);
    set("trace", trace);
  }, [rive, wait, listen, perch, whisper, peer, trace]);

  // The travel walk: depart when it starts, arrive when it ends.
  const travelDir: MascotTravelDir | null = calm ? null : travel;
  const lastTravel = useRef<MascotTravelDir | null>(null);
  useEffect(() => {
    if (!rive) return;
    const was = lastTravel.current;
    lastTravel.current = travelDir;
    if (travelDir) {
      set("travelDir", TRAVEL_DIR[travelDir]);
      set("travel", true);
      if (!was) trigger("depart");
    } else {
      set("travel", false);
      if (was) trigger("arrive");
    }
  }, [rive, travelDir]);

  // One-shot moves: fired on every change of the key (and once when the file has loaded with one).
  const fireName = fire?.name;
  const fireKey = fire?.key;
  const fireZone = fire?.zone;
  useEffect(() => {
    if (!rive || calm || !fireName || fireKey === undefined) return;
    if (fireName === "poke") set("pokeZone", POKE_ZONE_INDEX[fireZone ?? "body"]);
    trigger(fireName);
  }, [rive, calm, fireName, fireKey, fireZone]);

  // Named only where it stands alone; next to visible text it is decorative.
  return (
    <div className={cn("relative", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <div aria-hidden className="absolute inset-x-[22%] bottom-[2%] h-[6%] rounded-[50%] bg-ink/10 blur-[2px]" />
      <RiveComponent
        className="relative size-full"
        onPointerMove={(e) => {
          const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
          set("lookX", Math.max(0, Math.min(2, ((e.clientX - r.left) / r.width) * 2)));
          set("lookY", Math.max(0, Math.min(2, ((e.clientY - r.top) / r.height) * 2)));
        }}
        onPointerDown={(e) => {
          const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
          set("pokeZone", POKE_ZONE_INDEX[pokeZoneAt((e.clientY - r.top) / Math.max(1, r.height))]);
          trigger("poke");
          onPoke?.();
        }}
      />
    </div>
  );
}
