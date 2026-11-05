import { describe, expect, it } from "vitest";
import type { Scene } from "../src/lib/content/types";
import { MISS, minDwellMs, scoreLesson, tutorAnswerId } from "../src/lib/content/scoring";

const scenes: Scene[] = [
  { type: "intro", id: "start", title: "Start", body: "" },
  { type: "tutor", id: "talk", beats: [{ id: "b1", say: "Hi", mood: "talk" }, { id: "b2", say: "Which?", mood: "think", checkpoint: { prompt: "Which?", options: [{ id: "x", label: "X", correct: false, feedback: "" }, { id: "y", label: "Y", correct: true, feedback: "" }] } }] },
  { type: "choice", id: "single", question: { prompt: "", options: [{ id: "a", label: "", correct: true, feedback: "" }, { id: "b", label: "", correct: false, feedback: "" }] } },
  { type: "choice", id: "multi", multi: true, question: { prompt: "", options: [{ id: "a", label: "", correct: true, feedback: "" }, { id: "b", label: "", correct: true, feedback: "" }, { id: "c", label: "", correct: false, feedback: "" }] } },
  { type: "hotspot", id: "spots", prompt: "", artifact: { kind: "email" }, spots: [{ id: "s1", label: "", explain: "" }, { id: "s2", label: "", explain: "" }, { id: "s3", label: "", explain: "" }], minToFind: 2 },
  { type: "swipe", id: "cards", prompt: "", cards: [{ id: "c1", artifact: { kind: "sms" }, verdict: "threat", explain: "" }, { id: "c2", artifact: { kind: "sms" }, verdict: "safe", explain: "" }] },
  { type: "match", id: "pairs", prompt: "", pairs: [{ id: "p1", left: "", right: "" }, { id: "p2", left: "", right: "" }] },
  { type: "order", id: "steps", prompt: "", items: [{ id: "i1", label: "" }, { id: "i2", label: "" }, { id: "i3", label: "" }] },
  { type: "scenario", id: "story", title: "", start: "n1", nodes: [{ id: "n1", text: "", choices: [{ label: "", feedback: "", outcome: "compromised" }, { label: "", feedback: "", next: "n2" }] }, { id: "n2", text: "", choices: [{ label: "", feedback: "", outcome: "safe" }] }] },
  { type: "simulation", id: "inbox", environment: "inbox", title: "", intro: "", steps: [{ id: "mail", artifact: { kind: "email" }, actions: [{ id: "open", label: "", kind: "click-link", outcome: "risky", feedback: "" }, { id: "report", label: "", kind: "report", outcome: "safe", feedback: "" }] }] },
  { type: "password", id: "pw", prompt: "", targetScore: 3, tips: [] },
  { type: "recap", id: "end", points: ["."] },
];

const good = [
  { sceneId: tutorAnswerId("talk", "b2"), picked: ["y"] },
  { sceneId: "single", picked: ["a"] },
  { sceneId: "multi", picked: ["b", "a"] },
  { sceneId: "spots", picked: ["s1", "s3"] },
  { sceneId: "cards", itemId: "c1", picked: ["threat"] },
  { sceneId: "cards", itemId: "c2", picked: ["safe"] },
  { sceneId: "pairs", picked: ["p1>p1", "p2>p2"] },
  { sceneId: "steps", picked: ["i1", "i2", "i3"] },
  { sceneId: "story", itemId: "n1", picked: ["1"] },
  { sceneId: "story", itemId: "n2", picked: ["0"] },
  { sceneId: "inbox", itemId: "mail", picked: ["report"] },
  { sceneId: "pw", picked: [] },
];

const row = (sceneId: string, itemId: string | null = null) => {
  const res = scoreLesson(scenes, good);
  if (!res.ok) throw new Error(res.reason);
  return res.answers.find((a) => a.sceneId === sceneId && a.itemId === itemId)!;
};

describe("scoreLesson", () => {
  it("scores a fully right run from the lesson's content, one row per scene or item", () => {
    const res = scoreLesson(scenes, good);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.answers).toHaveLength(good.length);
    expect(res.answers.every((a) => a.correct && a.firstTry)).toBe(true);
    expect(row("story", "n1")).toMatchObject({ outcome: "safe" });
    expect(row("inbox", "mail")).toMatchObject({ outcome: "safe", itemId: "mail" });
    expect(row("pw")).toMatchObject({ outcome: null });
  });

  it("decides right and wrong itself, whatever the browser claims", () => {
    const wrong = (sub: { sceneId: string; itemId?: string; picked: string[] }) => {
      const res = scoreLesson(scenes, good.map((g) => (g.sceneId === sub.sceneId && (g.itemId ?? null) === (sub.itemId ?? null) ? { ...sub, correct: true, firstTry: true } : g)));
      if (!res.ok) throw new Error(res.reason);
      return res.answers.find((a) => a.sceneId === sub.sceneId && (a.itemId ?? null) === (sub.itemId ?? null))!;
    };
    expect(wrong({ sceneId: tutorAnswerId("talk", "b2"), picked: ["x"] })).toMatchObject({ correct: false, firstTry: false });
    expect(wrong({ sceneId: "single", picked: ["b"] })).toMatchObject({ correct: false });
    // A timed-out question comes with nothing picked; a partial multi-answer is wrong too.
    expect(wrong({ sceneId: "single", picked: [] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "multi", picked: ["a"] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "multi", picked: ["a", "b", "c"] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "spots", picked: ["s1", MISS, "s2"] })).toMatchObject({ correct: false });
    // The player records one miss however many clicks missed; any number is scored the same way.
    expect(wrong({ sceneId: "spots", picked: ["s1", ...Array.from({ length: 50 }, () => MISS), "s2"] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "cards", itemId: "c1", picked: ["safe"] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "pairs", picked: ["p1>p2", "p1>p1", "p2>p2"] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "steps", picked: ["i2", "i1", "i3"] })).toMatchObject({ correct: false });
    expect(wrong({ sceneId: "story", itemId: "n1", picked: ["0"] })).toMatchObject({ correct: false, outcome: "compromised" });
    expect(wrong({ sceneId: "inbox", itemId: "mail", picked: ["open"] })).toMatchObject({ correct: false, outcome: "risky" });
  });

  it("takes the first try from the first submission of a scene and the result from the last", () => {
    const res = scoreLesson(scenes, [...good.filter((g) => g.sceneId !== "steps"), { sceneId: "steps", picked: ["i3", "i2", "i1"] }, { sceneId: "steps", picked: ["i1", "i2", "i3"] }]);
    if (!res.ok) throw new Error(res.reason);
    expect(res.answers.filter((a) => a.sceneId === "steps")).toEqual([{ sceneId: "steps", itemId: null, correct: true, firstTry: false, outcome: null }]);
  });

  it("refuses a run that leaves a scored scene, a card or a checkpoint unanswered", () => {
    expect(scoreLesson(scenes, good.filter((g) => g.sceneId !== "pw"))).toEqual({ ok: false, reason: "unanswered" });
    expect(scoreLesson(scenes, good.filter((g) => g.itemId !== "c2"))).toEqual({ ok: false, reason: "unanswered" });
    expect(scoreLesson(scenes, good.filter((g) => !g.sceneId.startsWith("talk")))).toEqual({ ok: false, reason: "unanswered" });
    // Too few spots found, or a pair left unmatched: the scene was not finished.
    expect(scoreLesson(scenes, good.map((g) => (g.sceneId === "spots" ? { ...g, picked: ["s1"] } : g)))).toEqual({ ok: false, reason: "invalid" });
    expect(scoreLesson(scenes, good.map((g) => (g.sceneId === "pairs" ? { ...g, picked: ["p1>p1"] } : g)))).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses submissions that name nothing in the lesson", () => {
    const bad = (sub: { sceneId: string; itemId?: string; picked: string[] }) => scoreLesson(scenes, [...good, sub]);
    expect(bad({ sceneId: "nope", picked: ["a"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "single", picked: ["z"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "single", itemId: "x", picked: ["a"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "cards", itemId: "c9", picked: ["safe"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "cards", itemId: "c1", picked: ["maybe"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "steps", picked: ["i1", "i1", "i2"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "story", itemId: "n1", picked: ["7"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "inbox", itemId: "mail", picked: ["delete"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: tutorAnswerId("talk", "b1"), picked: ["y"] })).toEqual({ ok: false, reason: "invalid" });
    expect(bad({ sceneId: "start", picked: [] })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("minDwellMs", () => {
  it("is 20 seconds or a quarter of the lesson's minutes, whichever is longer", () => {
    expect(minDwellMs(1)).toBe(20_000);
    expect(minDwellMs(3)).toBe(45_000);
    expect(minDwellMs(8)).toBe(120_000);
  });
});
