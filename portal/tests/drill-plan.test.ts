import { describe, expect, it } from "vitest";
import { DRILL_KINDS, DRILL_LEAD_MS, DRILL_SIM_MINUTES, DRILL_TAIL_MS, drillProgress, msToSim, percent, planDrill, seedFrom, simToMs, type DrillEvent, type DrillTemplateTraits } from "@/lib/drill/plan";
import { dueCount } from "@/server/services/drill";

const RISKS = [30, 40, 25, 55, 62, 70, 35, 20, 45, 50, 58, 66, 72, 28, 33, 44, 47, 52, 61, 38, 29, 41, 55, 68, 74, 22, 36, 48, 57, 63, 39, 51, 46];
const people = RISKS.map((risk, i) => ({ userId: `u${i}`, recipientId: `r${i}`, risk }));
const email: DrillTemplateTraits = { channel: "email", difficulty: "Medium", harvest: true };
const ids = people.map((p) => p.recipientId);
const plan = (seed: number, extra: Partial<DrillTemplateTraits> = {}, who = people) => planDrill(who, { ...email, ...extra }, { seed, durationMs: 90_000 });

describe("drill clock", () => {
  it("maps simulated minutes onto the playback and back", () => {
    expect(simToMs(0, 90_000)).toBe(DRILL_LEAD_MS);
    expect(simToMs(DRILL_SIM_MINUTES, 90_000)).toBe(90_000 - DRILL_TAIL_MS);
    expect(msToSim(0, 90_000)).toBe(0);
    expect(msToSim(90_000, 90_000)).toBe(DRILL_SIM_MINUTES);
    for (const sim of [0.5, 3, 12, 45, 120, 200]) expect(msToSim(simToMs(sim, 90_000), 90_000)).toBeCloseTo(sim, 0);
  });

  it("plays the first minutes slower than the later hours", () => {
    const first10 = simToMs(10, 90_000) - simToMs(0, 90_000);
    const last10 = simToMs(240, 90_000) - simToMs(230, 90_000);
    expect(first10).toBeGreaterThan(last10 * 5);
  });
});

describe("planDrill", () => {
  it("is deterministic for a seed and differs between seeds", () => {
    expect(plan(7)).toEqual(plan(7));
    expect(plan(7)).not.toEqual(plan(8));
    expect(seedFrom("a")).not.toBe(seedFrom("b"));
  });

  it("sorts events in time, inside the playback, with each person's steps in causal order", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const events = plan(seed);
      for (let i = 1; i < events.length; i++) expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
      const byPerson = new Map<string, DrillEvent[]>();
      for (const e of events) {
        expect(e.at).toBeGreaterThanOrEqual(DRILL_LEAD_MS);
        expect(e.at).toBeLessThanOrEqual(90_000 - DRILL_TAIL_MS);
        byPerson.set(e.recipientId, [...(byPerson.get(e.recipientId) ?? []), e]);
      }
      for (const steps of byPerson.values()) {
        const at = Object.fromEntries(steps.map((e) => [e.kind, e.sim]));
        // Every step happens once, after the one it depends on.
        expect(new Set(steps.map((e) => e.kind)).size).toBe(steps.length);
        expect(steps[0].kind).toBe("deliver");
        if (at.open !== undefined) expect(at.open).toBeGreaterThan(at.deliver);
        if (at.click !== undefined) expect(at.click).toBeGreaterThan(at.open);
        if (at.submit !== undefined) expect(at.submit).toBeGreaterThan(at.click);
        if (at.report !== undefined) expect(at.report).toBeGreaterThan(at.open);
        if (at.train !== undefined) expect(at.train).toBeGreaterThan(at.click);
      }
    }
  });

  it("delivers to everyone and always tells the whole story", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { totals } = drillProgress(plan(seed, { difficulty: "Easy" }), Infinity, ids);
      expect(totals.delivered).toBe(people.length);
      expect(totals.clicked).toBeGreaterThan(0);
      expect(totals.reported).toBeGreaterThan(0);
      expect(totals.trained).toBeGreaterThan(0);
    }
  });

  it("keeps the story in tiny audiences too: a report even when every opener clicked", () => {
    for (const size of [2, 3, 4, 5]) {
      for (let seed = 1; seed <= 400; seed++) {
        const who = people.slice(0, size);
        const events = plan(seed, { difficulty: "Hard" }, who);
        const openers = new Set(events.filter((e) => e.kind === "open").map((e) => e.recipientId));
        if (openers.size < 2) continue;
        expect(events.some((e) => e.kind === "report"), `size ${size}, seed ${seed}`).toBe(true);
      }
    }
  });

  it("asks for a password only when the lure has a fake sign-in page", () => {
    for (let seed = 1; seed <= 20; seed++) expect(plan(seed, { harvest: false }).some((e) => e.kind === "submit")).toBe(false);
  });

  it("is calibrated: harder lures and riskier people click more, an average lure stays near the untrained baseline", () => {
    const rate = (difficulty: "Easy" | "Medium" | "Hard", who = people) => {
      let clicked = 0;
      let delivered = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const { totals } = drillProgress(plan(seed, { difficulty }, who), Infinity, who.map((p) => p.recipientId));
        clicked += totals.clicked;
        delivered += totals.delivered;
      }
      return (clicked / delivered) * 100;
    };
    const easy = rate("Easy");
    const medium = rate("Medium");
    const hard = rate("Hard");
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
    expect(medium).toBeGreaterThan(15);
    expect(medium).toBeLessThan(40);
    const careful = people.map((p) => ({ ...p, risk: 15 }));
    const risky = people.map((p) => ({ ...p, risk: 85 }));
    expect(rate("Medium", careful)).toBeLessThan(rate("Medium", risky) / 1.8);
  });

  it("handles a one-person audience and an empty one", () => {
    expect(plan(1, {}, [])).toEqual([]);
    const one = plan(3, {}, people.slice(0, 1));
    expect(one[0].kind).toBe("deliver");
    expect(one.every((e) => DRILL_KINDS.includes(e.kind))).toBe(true);
  });
});

describe("drillProgress", () => {
  it("counts the applied events only and keeps the strongest outcome per person", () => {
    const events: DrillEvent[] = [
      { at: 1, sim: 0.1, kind: "deliver", recipientId: "a", userId: "ua" },
      { at: 2, sim: 0.2, kind: "deliver", recipientId: "b", userId: "ub" },
      { at: 3, sim: 2, kind: "open", recipientId: "a", userId: "ua" },
      { at: 4, sim: 2.5, kind: "click", recipientId: "a", userId: "ua" },
      { at: 5, sim: 3, kind: "open", recipientId: "b", userId: "ub" },
      { at: 6, sim: 6, kind: "report", recipientId: "b", userId: "ub" },
      { at: 7, sim: 9, kind: "report", recipientId: "a", userId: "ua" },
      { at: 8, sim: 50, kind: "train", recipientId: "a", userId: "ua" },
    ];
    const half = drillProgress(events, 4, ["a", "b", "c"]);
    expect(half.totals).toEqual({ audience: 3, delivered: 2, opened: 1, clicked: 1, submitted: 0, reported: 0, trained: 0 });
    expect(half.people.get("c")?.outcome).toBe("pending");
    const all = drillProgress(events, events.length, ["a", "b", "c"]);
    // A click outranks a later report; the report is still counted and flagged.
    expect(all.people.get("a")).toEqual({ outcome: "clicked", reported: true, trained: true });
    expect(all.people.get("b")).toEqual({ outcome: "reported", reported: true, trained: false });
    expect(all.firstClick).toBe(2.5);
    expect(all.firstReport).toBe(6);
  });

  it("finds the due events by time", () => {
    const events = plan(5);
    expect(dueCount(events, 0)).toBe(0);
    expect(dueCount(events, 90_000)).toBe(events.length);
    const mid = events[Math.floor(events.length / 2)].at;
    expect(dueCount(events, mid)).toBe(events.filter((e) => e.at <= mid).length);
  });

  it("rounds percentages and never divides by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
});
