import type { CatRun } from "@/components/mascot/cat/engine";

/**
 * A run across the Home card: from the side the cat's box sits on to the other side of the track. Both rects are
 * measured on screen, so a right-to-left page (the cat starts on the left there) needs nothing special.
 */
export function runPlan(track: { left: number; width: number }, box: { left: number; width: number }): { dir: "left" | "right"; distancePx: number } {
  const onRight = box.left + box.width / 2 > track.left + track.width / 2;
  return { dir: onRight ? "left" : "right", distancePx: Math.max(0, Math.round(track.width - box.width)) };
}

/** The box's move for animate(), sampled from the run's own offset so the box keeps step with the footfalls. */
export function runKeyframes(run: Pick<CatRun, "end" | "offset">, steps = 48): Keyframe[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({ offset: i / steps, transform: `translateX(${Math.round(run.offset((run.end * i) / steps) * 10) / 10}px)` }));
}
