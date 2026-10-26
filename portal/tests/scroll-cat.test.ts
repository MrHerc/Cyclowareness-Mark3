import { describe, expect, it } from "vitest";
import { FOOT_X, FOOT_Y, arcAt, bodyRect, boxFor, footCandidates, overlaps, pickPerch, planArc } from "@/components/site/perch";

describe("landing scroll cat: perches", () => {
  it("puts the feet on the edge, inside the viewport", () => {
    const edge = { left: 400, right: 900, top: 600 };
    const box = boxFor(850, edge, 112, 1366)!;
    expect(box.x + FOOT_X * 112).toBeCloseTo(850);
    expect(box.y + FOOT_Y * 112).toBeCloseTo(600);
  });

  it("keeps the box inside a phone's width, and refuses a spot that would take the feet off the edge", () => {
    const edge = { left: 16, right: 370, top: 300 };
    const box = boxFor(365, edge, 80, 375)!;
    expect(box.x).toBe(375 - 80 - 8);
    // A narrow edge at the far right: clamped inside the viewport, the feet would land past its left end.
    expect(boxFor(372, { left: 360, right: 374, top: 300 }, 80, 375)).toBeNull();
  });

  it("prefers the end of a heading line and the top-right corner of a card", () => {
    const edge = { left: 100, right: 500 };
    expect(footCandidates(edge, 100, "text")[0]).toBeGreaterThan(footCandidates(edge, 100, "card")[0]);
    expect(footCandidates(edge, 100, "card").every((x) => x > 300)).toBe(true);
    expect(footCandidates(edge, 100, "card", 0.5)).toEqual([300]);
  });

  it("finds what the body would cover", () => {
    const body = bodyRect(100, 100, 100);
    expect(overlaps(body, { left: 0, right: 130, top: 150, bottom: 170 })).toBe(true);
    expect(overlaps(body, { left: 0, right: 110, top: 150, bottom: 170 })).toBe(false);
    expect(overlaps({ left: 0, right: 0, top: 0, bottom: 0 }, body)).toBe(false);
  });

  it("jumps to the next perch the page went, or the furthest one when it moved fast", () => {
    const c = [
      { item: "a", feet: 300 },
      { item: "b", feet: 450 },
      { item: "c", feet: 600 },
    ];
    // The current perch left at the top (the page went down).
    expect(pickPerch(c, 100, false, 400)).toBe("a");
    expect(pickPerch(c, 100, true, 400)).toBe("c");
    // It left at the bottom (the page went up).
    expect(pickPerch(c, 800, false, 400)).toBe("c");
    expect(pickPerch(c, 800, true, 400)).toBe("a");
    // Gone: the one nearest the middle of the view.
    expect(pickPerch(c, null, false, 430)).toBe("b");
    expect(pickPerch([], 100, false, 400)).toBeNull();
  });
});

describe("landing scroll cat: the jump arc", () => {
  it("starts and ends on the perches", () => {
    const a = planArc(1000, 200, 800, 600, 112);
    expect(arcAt(a, 0)).toEqual({ x: 1000, y: 200 });
    expect(arcAt(a, 1)).toEqual({ x: 800, y: 600 });
    expect(arcAt(a, 2)).toEqual({ x: 800, y: 600 });
  });

  it("rises a little before a jump down and clears the landing of a jump up", () => {
    const down = planArc(0, 200, 0, 600, 112);
    const topDown = Math.min(...Array.from({ length: 101 }, (_, i) => arcAt(down, i / 100).y));
    expect(topDown).toBeLessThan(200);
    expect(200 - topDown).toBeLessThan(40);
    const up = planArc(0, 600, 0, 200, 112);
    const topUp = Math.min(...Array.from({ length: 101 }, (_, i) => arcAt(up, i / 100).y));
    expect(topUp).toBeLessThan(200);
    expect(200 - topUp).toBeLessThan(40);
  });

  it("falls from rest when it comes in from the edge of the view", () => {
    const drop = planArc(300, 0, 280, 400, 80, true);
    const ys = Array.from({ length: 101 }, (_, i) => arcAt(drop, i / 100).y);
    expect(Math.min(...ys)).toBe(0);
    expect(ys.every((y, i) => i === 0 || y >= ys[i - 1])).toBe(true);
    expect(arcAt(drop, 1).y).toBe(400);
  });

  it("hops over a level gap and takes longer for a longer fall, within limits", () => {
    const level = planArc(0, 300, 240, 300, 112);
    expect(Math.min(...Array.from({ length: 11 }, (_, i) => arcAt(level, i / 10).y))).toBeLessThan(300 - 0.3 * 112);
    expect(planArc(0, 0, 0, 200, 112).ms).toBeLessThan(planArc(0, 0, 0, 600, 112).ms);
    expect(planArc(0, 0, 0, 5000, 112).ms).toBe(850);
    expect(planArc(0, 0, 4, 0, 112).ms).toBe(300);
  });
});
