/**
 * The pure maths of the landing's travelling cat (scroll-cat.tsx): where it sits on a perch, which perch it
 * jumps to when its own leaves the view, and the arc of the jump. Sizes and positions are in CSS px.
 */

/** Where the sitting cat's feet are in its mascot box, as fractions of the box size (measured on the canvas). */
export const FOOT_X = 0.56;
export const FOOT_Y = 0.95;
/** The cat's drawn body inside its box (fractions), for the check that it covers no text or control. */
export const BODY = { left: 0.2, right: 0.88, top: 0.08, bottom: 0.9 } as const;

export type Rect = { left: number; right: number; top: number; bottom: number };

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Where along a perch's top edge (left..right) the feet may go, best first. `at` is a fraction of the edge
 * (data-perch-at); otherwise a heading's line keeps the cat over its last letters and a card puts it on its
 * top-right corner, with a step inwards and outwards as alternatives.
 */
export function footCandidates(edge: { left: number; right: number }, size: number, kind: "text" | "card", at?: number): number[] {
  if (at !== undefined) return [edge.left + clamp(at, 0, 1) * (edge.right - edge.left)];
  // On a heading the front paws may rest on the last letter with the cat just past it (a short centred
  // line leaves room only there, beside the eyebrow above it).
  return kind === "text" ? [edge.right - 0.14 * size, edge.right + 0.06 * size, edge.right + 0.2 * size] : [edge.right - 0.4 * size, edge.right - 0.22 * size, edge.right - 0.62 * size];
}

/**
 * The mascot box (top-left) for feet at (footX, edgeTop), kept `margin` px inside the viewport width; null
 * when keeping it inside moves the feet off the edge (past its right end by more than `overhang` x size).
 */
export function boxFor(footX: number, edge: { left: number; right: number; top: number }, size: number, viewportWidth: number, overhang = -0.04, margin = 8): { x: number; y: number } | null {
  const x = clamp(footX - FOOT_X * size, margin, viewportWidth - size - margin);
  const feet = x + FOOT_X * size;
  if (feet < edge.left + 0.08 * size || feet > edge.right + overhang * size) return null;
  return { x, y: edge.top - FOOT_Y * size };
}

/** The drawn body of a cat whose box is at (x, y). */
export function bodyRect(x: number, y: number, size: number): Rect {
  return { left: x + BODY.left * size, right: x + BODY.right * size, top: y + BODY.top * size, bottom: y + BODY.bottom * size };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.right - a.left > 0 && a.bottom - a.top > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * The perch to jump to, given the candidates in view (`feet`: viewport y of each perch edge) and where the
 * current perch's edge is now (null: it is gone). The current one left the view at the top (the page went
 * down) or at the bottom (it went up); the cat takes the next perch that way, or, when the page moves fast
 * (or motion is calm), the furthest one in view, skipping the ones in between.
 */
export function pickPerch<T>(candidates: readonly { item: T; feet: number }[], from: number | null, quick: boolean, mid: number): T | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => a.feet - b.feet);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (from !== null && from <= first.feet) return (quick ? last : first).item;
  if (from !== null && from >= last.feet) return (quick ? first : last).item;
  const target = from ?? mid;
  return sorted.reduce((best, c) => (Math.abs(c.feet - target) < Math.abs(best.feet - target) ? c : best)).item;
}

/** A jump's flight: straight across at a constant speed, up and down under gravity. */
export type Arc = { x0: number; y0: number; dx: number; dy: number; lift: number; ms: number };

/**
 * The flight from one box position to another for a cat of `size` px. A jump down rises a little first and
 * peaks at a fifth of the flight; a jump up peaks at four fifths, a little above the landing; a level hop
 * clears a third of the cat's height. Gravity scales with the cat (about 30 cat-sizes per s²), which gives
 * the airborne time, kept between 0.3 and 0.85 s. `drop`: the cat comes in from the edge of the view, so a
 * jump down is a fall from rest (no rise back out of sight).
 */
export function planArc(x0: number, y0: number, x1: number, y1: number, size: number, drop = false): Arc {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lift = drop && dy > 0 ? dy / 4 : Math.max(Math.abs(dy) / 2.4, 0.24 * size + 0.12 * Math.abs(dx));
  const seconds = clamp(Math.sqrt((8 * lift) / (30 * size)), 0.3, 0.85);
  return { x0, y0, dx, dy, lift, ms: Math.round(seconds * 1000) };
}

/** The box position at flight progress t (0 at takeoff, 1 at touchdown). */
export function arcAt(a: Arc, t: number): { x: number; y: number } {
  const u = clamp(t, 0, 1);
  return { x: a.x0 + a.dx * u, y: a.y0 + a.dy * u - 4 * a.lift * u * (1 - u) };
}
