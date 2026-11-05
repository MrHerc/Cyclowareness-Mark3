import { describe, expect, it } from "vitest";
import { answerIdsOf, lessonStateKey, parseLesson, serializeLesson, tutorAnswerId } from "@/components/player/resume";
import type { Scene } from "@/lib/content/types";
import { plainText } from "@/lib/markdown";

const scenes = ["intro", "mail", "quiz", "recap"];
const ids = new Set(scenes);

describe("lesson resume state", () => {
  it("round-trips a lesson in progress", () => {
    const raw = serializeLesson({ kind: "playing", index: 2, maxIndex: 3, inner: 0.5, answers: [{ sceneId: "mail", itemId: "m1", picked: ["report"] }], elapsedMs: 42_000 }, scenes);
    expect(parseLesson(raw, scenes, ids)).toEqual({ kind: "playing", index: 2, maxIndex: 3, inner: 0.5, answers: [{ sceneId: "mail", itemId: "m1", picked: ["report"] }], elapsedMs: 42_000 });
  });

  it("round-trips a finished lesson with its result", () => {
    const raw = serializeLesson({ kind: "done", result: { ok: true, xp: 150, moduleStatus: "awaiting_attestation", nextKey: null }, token: null }, scenes);
    expect(parseLesson(raw, scenes, ids)).toEqual({ kind: "done", result: { ok: true, xp: 150, moduleStatus: "awaiting_attestation", nextKey: null }, token: null });
  });

  it("ignores state written for other scenes, another version or garbage", () => {
    const raw = serializeLesson({ kind: "playing", index: 1, maxIndex: 1, inner: 0, answers: [], elapsedMs: 0 }, scenes);
    expect(parseLesson(raw, ["intro", "mail", "recap"], ids)).toBeNull();
    expect(parseLesson(raw, ["intro", "quiz", "mail", "recap"], ids)).toBeNull();
    expect(parseLesson(raw.replace('"v":1', '"v":0'), scenes, ids)).toBeNull();
    expect(parseLesson("{not json", scenes, ids)).toBeNull();
    expect(parseLesson(null, scenes, ids)).toBeNull();
    expect(parseLesson(JSON.stringify({ v: 1, scenes, kind: "playing", index: 4, inner: 0, answers: [], elapsedMs: 0 }), scenes, ids)).toBeNull();
    expect(parseLesson(JSON.stringify({ v: 1, scenes, kind: "playing", index: 1, inner: 1.5, answers: [], elapsedMs: 0 }), scenes, ids)).toBeNull();
    expect(parseLesson(JSON.stringify({ v: 1, scenes, kind: "done", result: { ok: false, xp: 0 }, token: null }), scenes, ids)).toBeNull();
  });

  it("drops malformed or unknown answers and caps the elapsed time", () => {
    const raw = JSON.stringify({
      v: 1,
      scenes,
      kind: "playing",
      index: 1,
      inner: 0.25,
      elapsedMs: 10 * 3600_000,
      answers: [{ sceneId: "mail", itemId: "a", picked: ["open"], extra: "x" }, { sceneId: "gone", picked: [] }, { sceneId: "quiz", picked: "a" }, { sceneId: "quiz", picked: [{ id: "a" }] }, { sceneId: "quiz", picked: Array.from({ length: 41 }, () => "a") }],
    });
    expect(parseLesson(raw, scenes, ids)).toEqual({ kind: "playing", index: 1, maxIndex: 1, inner: 0.25, answers: [{ sceneId: "mail", itemId: "a", picked: ["open"] }], elapsedMs: 4 * 3600_000 });
  });

  it("keeps tutor checkpoint answers, which are recorded per beat", () => {
    const lesson: Scene[] = [
      { type: "tutor", id: "one-vault", beats: [{ id: "never-share", say: "x", mood: "talk" }, { id: "main", say: "y", mood: "talk" }] },
      { type: "recap", id: "recap", points: ["z"] },
    ];
    const answerIds = answerIdsOf(lesson);
    expect([...answerIds].sort()).toEqual(["one-vault", "one-vault:main", "one-vault:never-share", "recap"]);
    const checkpoint = { sceneId: tutorAnswerId("one-vault", "never-share"), picked: ["x"] };
    const raw = serializeLesson({ kind: "playing", index: 1, maxIndex: 1, inner: 0, answers: [checkpoint, { sceneId: "one-vault:removed-beat", picked: ["y"] }], elapsedMs: 1000 }, ["one-vault", "recap"]);
    expect(parseLesson(raw, ["one-vault", "recap"], answerIds)).toEqual({ kind: "playing", index: 1, maxIndex: 1, inner: 0, answers: [checkpoint], elapsedMs: 1000 });
  });

  it("keeps the furthest scene reached, never before the current one or past the last", () => {
    const at = (fields: Record<string, unknown>) => parseLesson(JSON.stringify({ v: 1, scenes, kind: "playing", index: 1, inner: 0, answers: [], elapsedMs: 0, ...fields }), scenes, ids);
    expect(at({ maxIndex: 3 })).toMatchObject({ index: 1, maxIndex: 3 });
    // A state saved before maxIndex existed: the scene it shows was the furthest one.
    expect(at({})).toMatchObject({ index: 1, maxIndex: 1 });
    expect(at({ maxIndex: 0 })).toBeNull();
    expect(at({ maxIndex: 4 })).toBeNull();
    expect(at({ maxIndex: 1.5 })).toBeNull();
    expect(at({ maxIndex: "3" })).toBeNull();
  });

  it("keys the state per learner and lesson", () => {
    expect(lessonStateKey("u1", "phishing", "l1")).not.toBe(lessonStateKey("u2", "phishing", "l1"));
    expect(lessonStateKey("u1", "phishing", "l1")).not.toBe(lessonStateKey("u1", "phishing", "l2"));
  });
});

describe("markdown plain text", () => {
  it("strips inline markup for accessible names", () => {
    expect(plainText("**Data**  and *purpose* of [processing](https://example.com)")).toBe("Data and purpose of processing");
  });
});
