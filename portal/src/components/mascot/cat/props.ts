/**
 * How the Mascot props (the Rive API in mapping.ts and rive-mascot.tsx) drive the cat engine: pure
 * tables and functions, so they can be tested without a browser. The cat has the same 14 moods, 12
 * gestures, behaviours instead of idle acts and no topic props; everything else maps to its closest move.
 */
import type { CatBehaviour, CatGesture, CatMood } from "./engine";
import type { MascotAct, MascotGesture, MascotMood, MascotTravelDir } from "../mapping";
import type { MascotAim, MascotGuide, MascotTrigger } from "../rive-mascot";

/** The moods have the same names in the engine. */
export const MOOD_TO_CAT: Record<MascotMood, CatMood> = {
  idle: "idle",
  talk: "talk",
  happy: "happy",
  think: "think",
  alert: "alert",
  sad: "sad",
  celebrate: "celebrate",
  surprised: "surprised",
  proud: "proud",
  curious: "curious",
  worried: "worried",
  excited: "excited",
  sleepy: "sleepy",
  laughing: "laughing",
};

/**
 * The 28 Rive gestures on the cat's 12. "rest" is no gesture. The engine has no upward point
 * (point-up raises the paw beside the cheek, as in wave) and no separate offering pose (present
 * reaches the near paw forward, like pointing ahead).
 */
export const GESTURE_TO_CAT: Record<MascotGesture, CatGesture | null> = {
  rest: null,
  "point-left": "point-left",
  "point-right": "point-right",
  "point-up": "wave",
  "point-down": "point-down",
  wave: "wave",
  nod: "nod",
  shake: "shake",
  cheer: "cheer",
  shrug: "shrug",
  "lean-in": "lean-in",
  "shield-up": "shield-up",
  inspect: "lean-in",
  lecture: "point-right",
  eureka: "cheer",
  reassure: "nod",
  toss: "shrug",
  bow: "bow",
  attention: "nod",
  recite: "nod",
  hop: "cheer",
  facepalm: "shake",
  count: "nod",
  explain: "point-right",
  "tap-left": "point-left",
  "tap-right": "point-right",
  ponder: "think",
  present: "point-right",
};

/**
 * Idle acts as behaviours: a nap dozes (a curl, or sitting up below 80 px), the apple becomes grooming; the cat's own acts
 * have the engine's names (play-mouse and play-yarn are the toys). The lively ones do not start while motion is off (and
 * the wrapper starts no act then); under calm only the laser does.
 */
export const ACT_TO_CAT: Record<MascotAct, CatBehaviour> = {
  rest: "present",
  nap: "sleep",
  apple: "groom",
  read: "look",
  sleep: "sleep",
  stretch: "stretch",
  groom: "groom",
  knead: "knead",
  "play-mouse": "mouse",
  "play-yarn": "yarn",
  laser: "laser",
  "chase-tail": "chase-tail",
  roll: "roll",
  run: "run",
};

/** What a one-shot trigger does: a gesture, a behaviour, a pet (head tilt and purr) or a hop of the whole cat. */
export type CatCue = { play: CatGesture } | { do: CatBehaviour } | { poke: true } | { hop: true };

export const FIRE_TO_CAT: Record<MascotTrigger, CatCue> = {
  bounce: { hop: true },
  huff: { play: "shake" },
  poke: { poke: true },
  touch: { poke: true },
  knock: { play: "point-down" },
  tap: { play: "point-down" },
  wipe: { do: "groom" },
};

const MIRROR: Record<string, string> = { left: "right", right: "left", "point-left": "point-right", "point-right": "point-left" };

/**
 * A right-to-left page mirrors the layout around the cat, so it sits the other way round and points to the
 * other side (the engine's points follow the screen side). Aims stay as they are: they come from real rects.
 */
export function mirrorForRtl<T extends string>(name: T, rtl: boolean): T {
  return rtl ? ((MIRROR[name] as T | undefined) ?? name) : name;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const degrees = (a: number) => ((a % 360) + 360) % 360;

/** The point for an aim angle (0 = right, 90 = up, anticlockwise): down for targets below, else the target's side. */
export function aimGesture(angle: number): "point-left" | "point-right" | "point-down" {
  const a = degrees(angle);
  if (a > 225 && a < 315) return "point-down";
  return a > 90 && a <= 225 ? "point-left" : "point-right";
}

/** The screen direction (y grows downwards) of an aim angle, rounded so tiny changes do not re-render. */
export function aimDirection(angle: number): { x: number; y: number } {
  const r = (degrees(angle) * Math.PI) / 180;
  const round = (v: number) => Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
  return { x: round(Math.cos(r)), y: round(-Math.sin(r)) };
}

/** Where the cat keeps looking: the aim target, then a travel's side, then aimAt; null looks ahead. */
export function lookDirection(aimAt: { x: number; y: number } | null | undefined, aim: MascotAim | undefined, travel: MascotTravelDir | null): { x: number; y: number } | null {
  if (aim) return aimDirection(aim.angle);
  if (travel) return { x: travel === "left" ? -1 : 1, y: 0 };
  if (aimAt) return { x: clamp1(aimAt.x), y: clamp1(aimAt.y) };
  return null;
}

/** The gesture held at its peak: pointing while `aim` is set, leaning in while peering or listening. */
export function heldGesture(aim: MascotAim | undefined, guide: MascotGuide | undefined): CatGesture | null {
  if (aim) return aimGesture(aim.angle);
  return guide?.peer || guide?.listen ? "lean-in" : null;
}

/** Listening shows the curious mood (ears forward, head tilted); otherwise the mood itself. */
export function catMood(mood: MascotMood, guide: MascotGuide | undefined): CatMood {
  return guide?.listen ? "curious" : (MOOD_TO_CAT[mood] ?? "idle");
}

/** Mouth level while talking: a whisper opens it less. */
export function talkLevel(guide: MascotGuide | undefined): number {
  return guide?.whisper ? 0.45 : 1;
}

/** Motion off: the still prop, the viewer's "still" preference on <html>, or the OS reduced-motion setting. */
export function motionOff(still: boolean, dataMotion: string | undefined, reducedMotion: boolean): boolean {
  return still || dataMotion === "still" || reducedMotion;
}

/**
 * A one-shot trigger on its first sight (the cat has just loaded) fires only with key 0, the deliberate
 * on-mount move (FeedbackCard, RecapScene); a counter that was already running when the mascot mounted
 * (the landing guide's moves start at 1) would replay an old move. Later, every change of the key fires.
 */
export function fireDue(first: boolean, prevKey: number | undefined, key: number): boolean {
  return first ? key === 0 : key !== prevKey;
}

/** Gestures that also make the whole cat hop in place (the paws do GESTURE_TO_CAT's move). */
export const HOPS: ReadonlySet<MascotGesture> = new Set<MascotGesture>(["hop"]);

/** The hop (the bounce trigger, the hop gesture): the host element jumps up and lands, for its animate(). */
export const BOUNCE_MS = 560;
export function bounceKeyframes(): Keyframe[] {
  return [
    { transform: "none" },
    { transform: "translateY(-14%)", offset: 0.38 },
    { transform: "none", offset: 0.72 },
    { transform: "translateY(-3%)", offset: 0.86 },
    { transform: "none" },
  ];
}

/** The travel walk in place: a small hop toward the side it goes, for the host element's animate(). */
export const HOP_MS = 520;
export function hopKeyframes(dir: MascotTravelDir): Keyframe[] {
  const s = dir === "left" ? -1 : 1;
  return [
    { transform: "none" },
    { transform: `translate(${4 * s}%, -9%)`, offset: 0.4 },
    { transform: `translate(${2 * s}%, 0)`, offset: 0.75 },
    { transform: "none" },
  ];
}
