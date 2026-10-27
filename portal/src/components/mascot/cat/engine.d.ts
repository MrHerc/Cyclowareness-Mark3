/**
 * Types for engine.js, the Canvas 2D cat rig (the single source of the cat; design/mascot-cat/README.md).
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

/**
 * Behaviours for do(); in mascot mode walk/turn/trot/rub/chase stay in the box (present, pet, lean-in). do("jump", opts) is
 * jump(opts), do("run", { distancePx, ... }) is run(opts) (without a distance: a gallop on the spot).
 * The acts added on 2026-10-27 (mascot mode): doze (a loaf doze), blink (a slow "cat kiss"), tilt (a curious head tilt),
 * stretch (front stretch with a yawn, then the back stretch), roll (on the back, paws in the air), chase-tail (sitting, it
 * bats and pins the tip of its own tail), pounce (a stalk, a sprung leap, a peek under the paw, a lick of the paw), mouse
 * and yarn (play with a toy; also play("mouse"), play("yarn")), laser (see laser()), run (see run()); knead treads a
 * little blanket in a box of 80 px or more. The
 * roomy ones are framed to fit their box: side-on with room to move in a box wider than tall, a compact 3/4 version in a
 * square box. Still / reduced motion: stretch, run, mouse, yarn, laser, chase-tail, roll and pounce do not start (do()
 * returns false); calm: only the laser (watching and crouching, no wiggle or pounce).
 */
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
  | "jump"
  | "doze"
  | "blink"
  | "tilt"
  | "run"
  | "mouse"
  | "yarn"
  | "laser"
  | "chase-tail"
  | "roll"
  | "pounce";

/**
 * A toy for play(): a grey toy mouse (the cat creeps up, springs on it, bats it, carries it home in its mouth, sets it
 * down as a gift and pats it away out of the box) or a red yarn ball (hooked, flipped, pounced on and dribbled, then
 * batted away; the cat licks a paw, flicks its tail and strolls back to its spot).
 */
export type CatToy = "mouse" | "yarn";

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

/**
 * A run across the page: the cat gallops in place in its box while the host moves the box (pattern: jump() with ScrollCat).
 * Moments in ms from the call: rise 400 ms → `start` (move the box) → the gallop (it speeds up and slows down with the cat)
 * → `stop` → settle and sit → `end`.
 */
export type CatRunOptions = {
  /** Screen direction of the run (default right); a mirrored (facing left) cat still runs that way on screen. */
  dir?: "left" | "right";
  /** How far the host moves the box, in px; the gallop's footfalls match it. */
  distancePx: number;
  onStart?: () => void;
  onStop?: () => void;
  onDone?: () => void;
};
/**
 * `offset(ms)`: px the box should be moved (signed: negative to the left) `ms` after run() was called; 0 before `start`,
 * the whole distance after `stop`. Still, reduced motion, calm, asleep or no distance: all moments 0, every callback has
 * already run and offset is the whole distance (move the box without the run). `done` resolves with onDone (also when a
 * new run or jump replaces this one or the cat is destroyed).
 */
export type CatRun = { start: number; stop: number; end: number; done: Promise<void>; offset(ms: number): number };

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
  /** Plays a gesture once; false when still, unknown, or a point while a point is held (the held target wins). A toy ("mouse", "yarn") starts that play (do(toy)). */
  play(gesture: CatGesture | CatToy): boolean;
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
  /** Gallops across: see CatRunOptions and CatRun. */
  run(opts: CatRunOptions): CatRun;
  /**
   * The laser dot at a point in the cat's box (px from its top left; outside the box too, the cat looks there), null when it
   * is gone. The engine draws the dot while it is inside the box: steady, never blinking. Sitting, the cat follows it with
   * head and eyes; on the floor near by it crouches and turns to it, and a dot that rests gets a butt wiggle and a pounce (a
   * stage box lets it leap across). A lost dot: a puzzled look round, then back to its spot. Calm: no wiggle or pounce.
   * Still / reduced motion: only the eyes follow it. Feed it pointer positions (it is cheap to call on every move).
   */
  laser(target: { x: number; y: number } | null): void;
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

/**
 * The auto scheduler's weights (setAuto(true): decorative placements). calm: sitting, blink, groom, knead (and sleep
 * after a long idle); bust (a head crop below 80 px): no body acts; stage (wider than tall): the toys too; idle: seconds
 * since anyone was near (over 90: sleep and doze).
 */
export function mascotAutoWeights(o?: { calm?: boolean; stage?: boolean; bust?: boolean; idle?: number }): Partial<Record<CatBehaviour, number>>;
/** Whether an act may start under a motion preference (still also stands for reduced motion). */
export function actAllowed(name: CatBehaviour, motion: "full" | "calm" | "still"): boolean;
/** A toy's position: x0 moved by kicks [time s, velocity] and slowed by linear drag k (1/s), at time t. */
export function toyX(x0: number, kicks: ReadonlyArray<readonly [number, number]>, k: number, t: number): number;
/** The laser logic's state (act units: x across the box, y up from the floor). */
export type CatLaserState = {
  x: number; th: number; thC: number; both: boolean; sit: boolean; cr: number; tgt: { x: number; y: number } | null; still: number; lost: number;
  pounce: { t: number; x0: number; x1: number } | null; cool: number; t: number; done: boolean;
};
/** thC: the crouch's heading; both: it may also crouch facing -x (a stage box); sit: it only watches (the head crop). */
export function laserState(thC?: number, both?: boolean, sit?: boolean): CatLaserState;
/** One step of the laser logic; room: where a pounce may land facing +x (r) or -x (l). */
export function laserStep(L: CatLaserState, dt: number, target: { x: number; y: number } | null, calm: boolean, room?: { r: [number, number]; l: [number, number] }): CatLaserState;
/** How far (0..1) the host has moved the box t seconds after run(), for the moments of a run. */
export function runProgress(t: number, at: { start: number; stop: number; r: number }): number;
type CatGait = { duty: number; S: number; T: number; lf: number; lh: number; off: Record<"nf" | "ff" | "nh" | "fh", number> };
/** The gaits (distance-driven footfalls): walk, trot and the gallop of run(). */
export const GAITS: Readonly<Record<"walk" | "trot" | "gallop", CatGait>>;
/** The leap's moments (s from its start): the load ends, the paws leave the floor, the paws land, the landing settles. */
export const LEAP: Readonly<{ load: number; off: number; land: number; end: number }>;
/** How far (0..1) from where it springs to where it lands the root is, tl seconds into the leap. */
export function leapProg(tl: number): number;
/** The leap's height tl seconds in, for an arc H high (0 on the floor). */
export function leapLift(tl: number, H: number): number;
/** One leg's footholds for Phi gait cycles: swings in phase (a..b) and floor x (xa → xb); end: where the last one is left from the standing pose. */
export function planLeg(off: number, G: CatGait, Phi: number): { swings: { a: number; b: number; xa: number; xb: number }[]; end: number };
