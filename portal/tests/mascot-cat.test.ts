import { describe, expect, it } from "vitest";
// Imported in Node with no DOM: the engine must not touch window or document at module load.
import { BEHAVIOUR_NAMES, GESTURE_NAMES, MOOD_NAMES, SWAT_PHASES, catchZone, createCat, reachTarget } from "@/components/mascot/cat/engine";
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
    expect(ACT_TO_CAT).toEqual({ rest: "present", nap: "sleep", apple: "groom", read: "look" });
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
