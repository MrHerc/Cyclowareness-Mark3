import { describe, expect, it } from "vitest";
import { runKeyframes, runPlan } from "@/components/learner/home-play";
import { runProgress } from "@/components/mascot/cat/engine";

describe("Home card run", () => {
  it("runs from the side the box sits on to the other end of the track", () => {
    expect(runPlan({ left: 10, width: 400 }, { left: 218, width: 192 })).toEqual({ dir: "left", distancePx: 208 });
    expect(runPlan({ left: 10, width: 400 }, { left: 10, width: 192 })).toEqual({ dir: "right", distancePx: 208 });
    expect(runPlan({ left: 0, width: 100 }, { left: 0, width: 192 }).distancePx).toBe(0);
  });

  it("samples the run's own offset into keyframes for the host box", () => {
    const at = { start: 0.4, stop: 2, r: 0.25 };
    const run = { end: 2600, offset: (ms: number) => -208 * runProgress(ms / 1000, at) };
    const frames = runKeyframes(run, 26);
    expect(frames).toHaveLength(27);
    expect(frames[0]).toEqual({ offset: 0, transform: "translateX(0px)" });
    expect(frames[26]).toEqual({ offset: 1, transform: "translateX(-208px)" });
    const xs = frames.map((f) => Number(/translateX\((-?[\d.]+)px\)/.exec(String(f.transform))?.[1]));
    // Leftwards all the way: never back, and it does move in between.
    xs.slice(1).forEach((x, i) => expect(x).toBeLessThanOrEqual(xs[i]));
    expect(xs[13]).toBeLessThan(0);
    expect(xs[13]).toBeGreaterThan(-208);
  });
});
