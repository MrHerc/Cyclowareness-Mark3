import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// Imported in Node with no DOM: the engine must not touch window or document at module load.
import {
  BEHAVIOUR_NAMES,
  GAITS,
  GESTURE_NAMES,
  LEAP,
  MOOD_NAMES,
  SWAT_PHASES,
  actAllowed,
  catchZone,
  createCat,
  laserState,
  laserStep,
  leapLift,
  leapProg,
  mascotAutoWeights,
  planLeg,
  reachTarget,
  runProgress,
  toyX,
  type CatBehaviour,
} from "@/components/mascot/cat/engine";
import {
  ACT_TO_CAT,
  FIRE_TO_CAT,
  GESTURE_TO_CAT,
  HOPS,
  MOOD_TO_CAT,
  aimDirection,
  aimGesture,
  bounceKeyframes,
  catMood,
  fireDue,
  heldGesture,
  hopKeyframes,
  lookDirection,
  mirrorForRtl,
  motionOff,
  talkLevel,
} from "@/components/mascot/cat/props";
import { ACT_INDEX, GESTURE_INDEX, MOOD_INDEX, type MascotAct, type MascotGesture, type MascotMood } from "@/components/mascot/mapping";
import type { MascotTrigger } from "@/components/mascot/mascot";

const moods = Object.keys(MOOD_INDEX) as MascotMood[];
const gestures = Object.keys(GESTURE_INDEX) as MascotGesture[];
const acts = Object.keys(ACT_INDEX) as MascotAct[];
const triggers: MascotTrigger[] = ["bounce", "knock", "touch", "wipe", "huff", "tap", "poke"];

describe("cat engine module", () => {
  it("loads without a browser and lists what its API accepts", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof createCat).toBe("function");
    expect(MOOD_NAMES).toHaveLength(14);
    expect(GESTURE_NAMES).toEqual(expect.arrayContaining(["wave", "nod", "shake", "cheer", "think", "point-left", "point-right", "point-down", "shrug", "lean-in", "shield-up", "bow"]));
    expect(GESTURE_NAMES.some((g) => g.startsWith("_"))).toBe(false);
    expect(BEHAVIOUR_NAMES).toEqual(expect.arrayContaining(["present", "sleep", "groom", "look", "pet", "jump"]));
    expect(BEHAVIOUR_NAMES).toEqual(expect.arrayContaining(["doze", "blink", "tilt", "stretch", "knead", "run", "mouse", "yarn", "laser", "chase-tail", "roll", "pounce"]));
  });

  it("draws shapes only, never text, on the canvas (the UI is in 10 languages)", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/mascot/cat/engine.js"), "utf8");
    expect(src).not.toMatch(/fillText|strokeText|\.font\s*=/);
  });
});

describe("mood mapping", () => {
  it("maps every MascotMood to the engine mood of the same name", () => {
    expect(moods).toHaveLength(14);
    for (const m of moods) {
      expect(MOOD_NAMES).toContain(MOOD_TO_CAT[m]);
      expect(MOOD_TO_CAT[m]).toBe(m);
    }
  });

  it("shows curious while listening and keeps the mood otherwise", () => {
    expect(catMood("talk", { listen: true })).toBe("curious");
    expect(catMood("happy", { listen: false })).toBe("happy");
    expect(catMood("think", undefined)).toBe("think");
  });
});

describe("gesture mapping", () => {
  it("maps every MascotGesture to an engine gesture, except rest", () => {
    expect(gestures).toHaveLength(28);
    for (const g of gestures) {
      const cat = GESTURE_TO_CAT[g];
      if (g === "rest") expect(cat).toBeNull();
      else expect(GESTURE_NAMES).toContain(cat);
    }
  });

  it("keeps the gestures the cat has and picks the closest for the rest", () => {
    for (const same of ["point-left", "point-right", "point-down", "wave", "nod", "shake", "cheer", "shrug", "lean-in", "shield-up", "bow"] as const) expect(GESTURE_TO_CAT[same]).toBe(same);
    expect(GESTURE_TO_CAT.recite).toBe("nod");
    expect(GESTURE_TO_CAT.lecture).toBe("point-right");
    expect(GESTURE_TO_CAT.explain).toBe("point-right");
    expect(GESTURE_TO_CAT.hop).toBe("cheer");
    expect(GESTURE_TO_CAT.eureka).toBe("cheer");
    expect(GESTURE_TO_CAT.ponder).toBe("think");
    expect(GESTURE_TO_CAT.inspect).toBe("lean-in");
    expect(GESTURE_TO_CAT.facepalm).toBe("shake");
    expect(GESTURE_TO_CAT.toss).toBe("shrug");
    expect(GESTURE_TO_CAT["tap-left"]).toBe("point-left");
    expect(GESTURE_TO_CAT["tap-right"]).toBe("point-right");
  });

  it("sits and points the other way in a right-to-left page, and changes nothing else", () => {
    expect(mirrorForRtl("point-left", true)).toBe("point-right");
    expect(mirrorForRtl("point-right", true)).toBe("point-left");
    expect(mirrorForRtl("right", true)).toBe("left");
    expect(mirrorForRtl("left", true)).toBe("right");
    expect(mirrorForRtl("point-down", true)).toBe("point-down");
    expect(mirrorForRtl("wave", true)).toBe("wave");
    expect(mirrorForRtl("point-left", false)).toBe("point-left");
  });
});

describe("aim", () => {
  it("points right, left or down from the angle (0 = right, 90 = up)", () => {
    expect(aimGesture(0)).toBe("point-right");
    expect(aimGesture(45)).toBe("point-right");
    expect(aimGesture(90)).toBe("point-right");
    expect(aimGesture(330)).toBe("point-right");
    expect(aimGesture(91)).toBe("point-left");
    expect(aimGesture(180)).toBe("point-left");
    expect(aimGesture(225)).toBe("point-left");
    expect(aimGesture(226)).toBe("point-down");
    expect(aimGesture(270)).toBe("point-down");
    expect(aimGesture(314)).toBe("point-down");
    expect(aimGesture(315)).toBe("point-right");
  });

  it("normalises angles outside 0..360", () => {
    expect(aimGesture(-90)).toBe("point-down");
    expect(aimGesture(540)).toBe("point-left");
    expect(aimGesture(720)).toBe("point-right");
  });

  it("looks the way it points, in screen space (y down)", () => {
    expect(aimDirection(0)).toEqual({ x: 1, y: 0 });
    expect(aimDirection(90)).toEqual({ x: 0, y: -1 });
    expect(aimDirection(180)).toEqual({ x: -1, y: 0 });
    expect(aimDirection(270)).toEqual({ x: 0, y: 1 });
  });

  it("keeps looking at the aim, then a travel, then aimAt", () => {
    expect(lookDirection({ x: 0.5, y: 0 }, { angle: 180 }, "right")).toEqual({ x: -1, y: 0 });
    expect(lookDirection({ x: 0.5, y: 0 }, null, "right")).toEqual({ x: 1, y: 0 });
    expect(lookDirection({ x: 3, y: -2 }, null, null)).toEqual({ x: 1, y: -1 });
    expect(lookDirection(null, undefined, null)).toBeNull();
  });

  it("holds the point while aiming, leans in while peering or listening", () => {
    expect(heldGesture({ angle: 200 }, undefined)).toBe("point-left");
    expect(heldGesture({ angle: 270 }, { peer: true })).toBe("point-down");
    expect(heldGesture({ angle: 0 }, { listen: true })).toBe("point-right");
    expect(heldGesture(null, { peer: true })).toBe("lean-in");
    expect(heldGesture(null, { listen: true })).toBe("lean-in");
    expect(heldGesture(null, {})).toBeNull();
  });
});

describe("one-shot triggers", () => {
  it("maps every trigger to a move the engine accepts", () => {
    expect(Object.keys(FIRE_TO_CAT).sort()).toEqual([...triggers].sort());
    for (const t of triggers) {
      const cue = FIRE_TO_CAT[t];
      if ("play" in cue) expect(GESTURE_NAMES).toContain(cue.play);
      else if ("do" in cue) expect(BEHAVIOUR_NAMES).toContain(cue.do);
      else if ("hop" in cue) expect(cue.hop).toBe(true);
      else expect(cue.poke).toBe(true);
    }
  });

  it("maps each trigger to its closest move", () => {
    expect(FIRE_TO_CAT.bounce).toEqual({ hop: true });
    expect(FIRE_TO_CAT.huff).toEqual({ play: "shake" });
    expect(FIRE_TO_CAT.poke).toEqual({ poke: true });
    expect(FIRE_TO_CAT.touch).toEqual({ poke: true });
    expect(FIRE_TO_CAT.knock).toEqual({ play: "point-down" });
    expect(FIRE_TO_CAT.tap).toEqual({ play: "point-down" });
    expect(FIRE_TO_CAT.wipe).toEqual({ do: "groom" });
  });

  it("fires on mount only with key 0, then on every change of the key", () => {
    expect(fireDue(true, undefined, 0)).toBe(true); // FeedbackCard, RecapScene
    expect(fireDue(true, undefined, 3)).toBe(false); // a remounted dock with the guide's last move
    expect(fireDue(false, undefined, 1)).toBe(true); // the first move after mounting without one
    expect(fireDue(false, 3, 4)).toBe(true);
    expect(fireDue(false, 4, 4)).toBe(false);
  });

  it("hops for the hop gesture (on top of its paw move) and lands where it started", () => {
    expect(HOPS.has("hop")).toBe(true);
    expect(HOPS.has("cheer")).toBe(false);
    expect(GESTURE_TO_CAT.hop).toBe("cheer");
    const f = bounceKeyframes();
    expect(f[0]).toEqual({ transform: "none" });
    expect(f[f.length - 1]).toEqual({ transform: "none" });
    expect(f.some((k) => String(k.transform).startsWith("translateY(-"))).toBe(true);
  });
});

describe("acts, voice and motion", () => {
  it("maps every idle act to a behaviour", () => {
    for (const a of acts) expect(BEHAVIOUR_NAMES).toContain(ACT_TO_CAT[a]);
    expect(ACT_TO_CAT).toMatchObject({ rest: "present", nap: "sleep", apple: "groom", read: "look" });
    expect(ACT_TO_CAT).toMatchObject({ sleep: "sleep", stretch: "stretch", "play-mouse": "mouse", "play-yarn": "yarn", laser: "laser", "chase-tail": "chase-tail", roll: "roll", run: "run" });
  });

  it("gives the Rive robot one of its four idle acts for every act", () => {
    for (const a of acts) expect([0, 1, 2, 3]).toContain(ACT_INDEX[a]);
    expect(ACT_INDEX.sleep).toBe(ACT_INDEX.nap);
  });

  it("whispers with a smaller mouth", () => {
    expect(talkLevel(undefined)).toBe(1);
    expect(talkLevel({ whisper: true })).toBeLessThan(1);
    expect(talkLevel({ whisper: true })).toBeGreaterThan(0);
  });

  it("turns motion off for the still prop, data-motion=still or reduced motion", () => {
    expect(motionOff(false, "full", false)).toBe(false);
    expect(motionOff(false, "calm", false)).toBe(false);
    expect(motionOff(false, undefined, false)).toBe(false);
    expect(motionOff(true, "full", false)).toBe(true);
    expect(motionOff(false, "still", false)).toBe(true);
    expect(motionOff(false, "full", true)).toBe(true);
  });

  it("hops toward the travel side and lands where it started", () => {
    const right = hopKeyframes("right");
    const left = hopKeyframes("left");
    expect(right[0]).toEqual({ transform: "none" });
    expect(right[right.length - 1]).toEqual({ transform: "none" });
    expect(right[1].transform).toContain("translate(4%");
    expect(left[1].transform).toContain("translate(-4%");
  });
});

describe("pointer catching maths", () => {
  const box = 200;
  const reach = { x: 110, y: 150, r: 80 };

  it("tells far, near (the box grown to 1.5x) and paw reach apart", () => {
    expect(catchZone(100, 40, box, box, reach)).toMatchObject({ zone: "near", near: 0.4, interest: 1 });
    expect(catchZone(150, 150, box, box, reach).zone).toBe("reach");
    // just inside and just outside the 1.5x box (half-extent 150 px from the centre)
    expect(catchZone(100 + 149, 20, box, box, reach).zone).toBe("near");
    expect(catchZone(100 + 151, 20, box, box, reach).zone).toBe("far");
    expect(catchZone(600, 100, box, box, reach)).toMatchObject({ zone: "far", interest: 0 });
  });

  it("ramps the interest smoothly across the edge of the near zone", () => {
    const at = (x: number) => catchZone(x, 100, box, box, null).interest;
    expect(at(100 + 0.85 * 150)).toBeCloseTo(1, 5);
    expect(at(100 + 1.05 * 150)).toBeCloseTo(0.5, 5);
    expect(at(100 + 1.25 * 150)).toBeCloseTo(0, 5);
    for (let x = 100; x < 400; x += 5) expect(at(x + 5)).toBeLessThanOrEqual(at(x));
  });

  it("names the pointer's side from the reach centre, or the box centre without one", () => {
    expect(catchZone(60, 150, box, box, reach).side).toBe(-1);
    expect(catchZone(130, 150, box, box, reach).side).toBe(1);
    expect(catchZone(90, 150, box, box, null).side).toBe(-1);
    // a head-only crop has no reach: never a strike zone
    expect(catchZone(110, 150, box, box, null).zone).toBe("near");
  });

  it("keeps a paw target within the shoulder's reach, off the floor and below the cheek", () => {
    const S: [number, number] = [10, 41];
    const len = (t: number[]) => Math.hypot(t[0] - S[0], t[1] - S[1]);
    for (const [bx, by] of [[200, 41], [10, -50], [200, 200], [-200, 10], [12, 41]]) {
      for (const fwd of [true, false]) {
        const t = reachTarget(bx, by, S, fwd);
        expect(len(t)).toBeLessThanOrEqual(38 + 1e-9);
        expect(t[1]).toBeGreaterThanOrEqual(6.2);
        expect(t[1]).toBeLessThanOrEqual(S[1] + 8);
        // the forward paw strikes out front, the near paw across and behind
        expect(fwd ? t[0] > S[0] : t[0] < S[0]).toBe(true);
      }
    }
    expect(reachTarget(30, 30, S, true)).toEqual([30, 30]);
  });

  it("times every strike as anticipation, strike, hold and return", () => {
    for (const k of ["bat", "swipe", "pounce"] as const) {
      expect(SWAT_PHASES[k]).toHaveLength(4);
      expect(SWAT_PHASES[k].every((d) => d > 0)).toBe(true);
    }
    // a swipe is the quickest to strike, a pounce winds up longest and pins longest
    expect(SWAT_PHASES.swipe[0]).toBeLessThan(SWAT_PHASES.bat[0]);
    expect(SWAT_PHASES.pounce[0]).toBeGreaterThan(SWAT_PHASES.bat[0]);
    expect(SWAT_PHASES.pounce[2]).toBeGreaterThan(SWAT_PHASES.bat[2]);
  });
});

describe("the cat's own acts", () => {
  const lively: CatBehaviour[] = ["stretch", "run", "mouse", "yarn", "laser", "chase-tail", "roll", "pounce"];
  const calmSet = new Set(["present", "blink", "groom", "knead", "sleep", "doze"]);

  it("starts none of the lively acts while still, only the laser under calm, all of them in full motion", () => {
    for (const a of lively) {
      expect(actAllowed(a, "still")).toBe(false);
      expect(actAllowed(a, "calm")).toBe(a === "laser");
      expect(actAllowed(a, "full")).toBe(true);
    }
    for (const a of ["present", "sleep", "doze", "groom", "knead", "blink"] as CatBehaviour[]) {
      expect(actAllowed(a, "still")).toBe(true);
      expect(actAllowed(a, "calm")).toBe(true);
    }
  });

  it("schedules only sitting, blinks, grooming, kneading and sleep under calm", () => {
    for (const idle of [0, 500]) for (const stage of [false, true]) {
      const w = mascotAutoWeights({ calm: true, stage, idle });
      for (const k of Object.keys(w)) expect(calmSet.has(k)).toBe(true);
      expect(w.present).toBeGreaterThan(0);
    }
  });

  it("naps only after a long idle, plays with toys only in a wide box and keeps body acts out of a head crop", () => {
    expect(mascotAutoWeights({ idle: 10 }).sleep).toBeUndefined();
    expect(mascotAutoWeights({ idle: 200 }).sleep).toBeGreaterThan(0);
    expect(mascotAutoWeights({ calm: true, idle: 200 }).sleep).toBeGreaterThan(0);
    expect(mascotAutoWeights({ stage: false }).mouse).toBeUndefined();
    expect(mascotAutoWeights({ stage: true }).mouse).toBeGreaterThan(0);
    expect(mascotAutoWeights({ stage: true }).yarn).toBeGreaterThan(0);
    const bust = mascotAutoWeights({ bust: true });
    for (const a of ["stretch", "roll", "pounce", "chase-tail", "mouse", "yarn"]) expect(bust[a as CatBehaviour]).toBeUndefined();
    for (const w of [mascotAutoWeights(), mascotAutoWeights({ stage: true, idle: 200 })]) for (const k of Object.keys(w)) expect(BEHAVIOUR_NAMES).toContain(k);
  });

  it("slides a kicked toy to rest under drag (closed form)", () => {
    const kicks: [number, number][] = [[1, 64], [2, -32]];
    expect(toyX(10, kicks, 3.2, 0.5)).toBe(10);
    expect(toyX(10, kicks, 3.2, 1e3)).toBeCloseTo(10 + 64 / 3.2 - 32 / 3.2, 6);
    let prev = toyX(10, [[0, 50]], 3.2, 0);
    for (let t = 0.05; t < 4; t += 0.05) {
      const x = toyX(10, [[0, 50]], 3.2, t);
      expect(x).toBeGreaterThanOrEqual(prev);
      expect(x - prev).toBeLessThan(50 * 0.05 + 1e-9); // never faster than the kick
      prev = x;
    }
  });

  const runLaser = (track: (t: number) => { x: number; y: number } | null, secs: number, calm = false) => {
    const L = laserState();
    let pounced = false;
    for (let t = 0; t < secs; t += 1 / 60) {
      laserStep(L, 1 / 60, track(t), calm);
      if (L.pounce) pounced = true;
    }
    return { L, pounced };
  };

  it("crouches at a dot on the floor near by and pounces once it rests (never under calm)", () => {
    const resting = () => ({ x: 60, y: 0 });
    const full = runLaser(resting, 3);
    expect(full.pounced).toBe(true);
    expect(full.L.cr).toBeGreaterThan(0.9);
    expect(full.L.x).toBeGreaterThan(20); // it leapt toward the dot
    const calm = runLaser(resting, 6, true);
    expect(calm.pounced).toBe(false);
    expect(calm.L.cr).toBeGreaterThan(0.9); // it still watches, crouched
    expect(calm.L.x).toBe(0);
  });

  it("sits and watches a dot up on the wall, and looks round for a lost one before it is done", () => {
    expect(runLaser(() => ({ x: 40, y: 80 }), 3).L.cr).toBe(0);
    const lost = runLaser((t) => (t < 1 ? { x: 40, y: 0 } : null), 2.5);
    expect(lost.L.lost).toBeGreaterThan(0);
    expect(lost.L.done).toBe(false);
    expect(runLaser((t) => (t < 1 ? { x: 40, y: 0 } : null), 4.2).L.done).toBe(true);
  });

  it("moves the host box with the gallop: nothing before the start, all of it after the stop, never backwards", () => {
    const at = { start: 0.4, stop: 2.2, r: 0.2 };
    expect(runProgress(0, at)).toBe(0);
    expect(runProgress(0.4, at)).toBe(0);
    expect(runProgress(2.2, at)).toBe(1);
    expect(runProgress(9, at)).toBe(1);
    let prev = 0;
    for (let t = 0; t < 3; t += 0.01) {
      const v = runProgress(t, at);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  it("plans gallop footfalls that only step forward and end near the standing pose", () => {
    const G = GAITS.gallop;
    expect(G.duty).toBeLessThan(0.5); // airborne phases: each paw is down less than half the stride
    for (const k of ["nf", "ff", "nh", "fh"] as const) {
      const plan = planLeg(G.off[k], G, 6);
      expect(plan.swings.length).toBeGreaterThanOrEqual(5);
      for (const sw of plan.swings) {
        expect(sw.b).toBeGreaterThan(sw.a);
        expect(sw.xb).toBeGreaterThanOrEqual(sw.xa);
      }
      expect(Math.abs(plan.end)).toBeLessThan(G.S);
    }
  });

  it("springs on a skewed arc: on the floor through the load, up fast, travelling only while it springs", () => {
    expect(leapLift(LEAP.load, 10)).toBe(0);
    expect(leapLift(LEAP.land, 10)).toBe(0);
    let top = 0, topAt = 0, prev = 0;
    for (let t = 0; t <= LEAP.end; t += 0.005) {
      const h = leapLift(t, 10);
      if (h > top) { top = h; topAt = t; }
      const x = leapProg(t);
      expect(x).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = x;
    }
    expect(top).toBeCloseTo(10, 1);
    expect(topAt).toBeLessThan((LEAP.off + LEAP.land) / 2); // the top comes early (fast up)
    expect(leapProg(LEAP.load)).toBe(0);
    expect(leapProg(LEAP.land)).toBe(1);
  });
});
