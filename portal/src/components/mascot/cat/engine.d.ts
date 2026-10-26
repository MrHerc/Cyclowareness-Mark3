/**
 * Types for engine.js, the vendored Canvas 2D cat rig (origin: design/mascot-cat/source, README there).
 * Only the public API is typed; everything else in the engine is internal.
 */

export type CatMood =
  | "idle"
  | "talk"
  | "happy"
  | "think"
  | "alert"
  | "sad"
  | "celebrate"
  | "surprised"
  | "proud"
  | "curious"
  | "worried"
  | "excited"
  | "sleepy"
  | "laughing";

/** One-shot gestures (overlays on the current behaviour), as accepted by play() and hold(). */
export type CatGesture = "wave" | "nod" | "shake" | "cheer" | "think" | "point-left" | "point-right" | "point-down" | "shrug" | "lean-in" | "shield-up" | "bow";

/** Behaviours for do(); in mascot mode walk/turn/trot/rub/chase stay in the box (present, pet, lean-in). do("jump", opts) is jump(opts). */
export type CatBehaviour =
  | "sit"
  | "walk"
  | "turn"
  | "trot"
  | "rub"
  | "groom"
  | "sleep"
  | "wake"
  | "stretch"
  | "yawn"
  | "chase"
  | "pet"
  | "knead"
  | "look"
  | "flick"
  | "present"
  | "jump";

/**
 * A jump for a host that carries the cat's box along an arc (the cat itself stays in its box, with a little
 * lift): crouch 280 ms → takeoff stretch 120 ms → airborne `hang` ms (a tuck, then the front paws reach for
 * the landing: down, or up for a jump up) → landing squash 160 ms → settle back to sitting 600 ms.
 */
export type CatJumpOptions = {
  /** Where the landing is: "down" (default) reaches down with the front paws, "up" reaches up and forward. */
  dir?: "down" | "up";
  /** Airborne time in ms (150 to 2000, default 450): how long the host's arc takes. */
  hang?: number;
  /** The feet leave the floor: start moving the box. */
  onTakeoff?: () => void;
  /** Touchdown: the box should be at the landing spot. */
  onLand?: () => void;
  /** Settled and sitting again (the cat goes back to its present loop). */
  onDone?: () => void;
};

/**
 * When the jump's moments happen, in ms from the call (land = takeoff + hang). All 0 when the cat is still
 * (still / reduced motion) or asleep: then nothing animates and every callback has already run, so the
 * host should move the box without an arc. `done` resolves with onDone (also when the jump is replaced by
 * another jump or the cat is destroyed); callbacks fire from the frame that reaches them, backed by a
 * timer 120 ms later when no frame runs.
 */
export type CatJump = { takeoff: number; land: number; end: number; done: Promise<void> };

/** Where a pointer is for a mascot box (catchZone). */
export type CatZone = {
  zone: "far" | "near" | "reach";
  /** 0 at the box centre, 1 on the edge of the box grown to 1.5x. */
  near: number;
  /** How much the cat watches it: 1 within near 0.85, 0 beyond 1.25. */
  interest: number;
  /** Screen side of the pointer from the reach centre: -1 left, 1 right. */
  side: -1 | 1;
};

export type CatOptions = {
  /** "mascot" stays inside its box (sitting, presenting); "roam" walks a stage. */
  mode?: "mascot" | "roam";
  /** Mascot box size in px (sets the element's width and height); leave unset to fill the element. */
  size?: number;
  facing?: "right" | "left";
  /** Accessible name the engine sets on the element (mascot mode). */
  label?: string;
  /** false: leave role and aria-label to the host element. */
  aria?: boolean;
};

export interface CatInstance {
  readonly behaviours: CatBehaviour[];
  readonly moods: CatMood[];
  readonly gestures: CatGesture[];
  readonly state: { behaviour: CatBehaviour | null; mood: CatMood; auto: boolean; still: boolean; talking: boolean };
  /** Starts a behaviour; also leaves "still" unless the OS asks for reduced motion. */
  do(name: CatBehaviour, opts?: Record<string, unknown>): boolean;
  setAuto(on: boolean): void;
  getAuto(): boolean;
  setMood(mood: CatMood): void;
  getMood(): CatMood;
  /** `level` scales the mouth: 1 full voice, lower for a whisper. */
  setTalking(on: boolean, level?: number): void;
  /** Plays a gesture once; false when still, unknown, or a point while a point is held (the held target wins). */
  play(gesture: CatGesture): boolean;
  /** Keeps a gesture at its peak until hold(null); a held point replaces a running point at once. */
  hold(gesture: CatGesture | null): boolean;
  /** Looks at a viewport point for a few seconds. */
  lookAt(clientX: number, clientY: number): void;
  /** Keeps looking in a screen direction (x, y in -1..1, y down); null looks ahead. */
  lookToward(x: number | null, y?: number): void;
  /** Pet: a head tilt and a purr (a purr in place while asleep); the cat does not bat at the hand for 2.2 s. */
  poke(): void;
  /**
   * Jumps (see CatJumpOptions); the returned times let the host start its arc at takeoff and end it at land.
   * A still cat does not animate and returns zeros. Pointer catching pauses during the jump.
   */
  jump(opts?: CatJumpOptions): CatJump;
  /** Still: no behaviours, gestures or talking; only blinks, redrawn on demand. A held gesture and a kept look stay as a static pose. */
  setStill(on: boolean): void;
  isStill(): boolean;
  setSize(px: number): void;
  destroy(): void;
}

export const MOOD_NAMES: readonly CatMood[];
export const GESTURE_NAMES: readonly CatGesture[];
export const BEHAVIOUR_NAMES: readonly CatBehaviour[];

export function createCat(el: HTMLElement, opts?: CatOptions): CatInstance;

/**
 * Pointer catching (mascot mode; one shared window listener for every cat): a pointer near the box is
 * watched (head, pupils, ears forward, a small crouch, the tail tip twitching); within paw reach it is batted
 * at with the paw on its side, a fast pass (crossing the box in about a quarter second) gets a quick swipe,
 * and a pointer resting in reach gets a stare and then a pounce of the paw. Only while the cat sits in its
 * present loop with no gesture held or played and no talking; a press on the cat pets it instead; calm
 * motion (html[data-motion=calm]) bats but never swipes or pounces; still / reduced motion only moves the
 * eyes toward a pointer near by. The helpers below are its pure maths.
 */
/** Where (x, y) (local px of a W x H mascot box) is: far, near (box grown to 1.5x) or within `reach` (a circle in local px). */
export function catchZone(x: number, y: number, W: number, H: number, reach: { x: number; y: number; r: number } | null): CatZone;
/** A wrist target (body frame, cat units, y up) kept within the reach of shoulder S: forward paw out front, near paw across and behind. */
export function reachTarget(bx: number, by: number, S: readonly [number, number] | number[], fwd: boolean): [number, number];
/** Seconds of each strike: [anticipation, strike, hold, return]. */
export const SWAT_PHASES: Readonly<Record<"bat" | "swipe" | "pounce", readonly [number, number, number, number]>>;
