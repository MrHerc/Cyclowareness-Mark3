import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlayerProps } from "@/components/player/player";
import { ScormApp, type ScormData } from "@/scorm/app";
import { MASTERY_SCORE, cmiTimespan, connect, findApi, hasScoredScene, type Scorm12Api } from "@/scorm/scorm-api";
import type { Scene } from "@/lib/content/types";
import { TEST_SCENES } from "./helpers/db";

// The player itself is rendered in scorm-player.test.ts; here only the props the offline app hands it count.
const shown = vi.hoisted(() => ({ props: null as PlayerProps | null }));
vi.mock("../src/components/player/player", () => ({ LessonPlayer: (p: PlayerProps) => ((shown.props = p), null) }));

/** An LMS's window.API that keeps the data model and records every call. */
function fakeApi(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { "cmi.core.lesson_status": "not attempted", ...initial };
  const calls: string[] = [];
  const api: Scorm12Api = {
    LMSInitialize: () => (calls.push("init"), "true"),
    LMSFinish: () => (calls.push("finish"), "true"),
    LMSGetValue: (k) => data[k] ?? "",
    LMSSetValue: (k, v) => ((data[k] = v), "true"),
    LMSCommit: () => (calls.push("commit"), "true"),
  };
  return { api, data, calls };
}

// TEST_SCENES: "q1" (option "a" is right) and the one-step simulation "sim" ("report" is safe).
const right = [
  { sceneId: "q1", picked: ["a"] },
  { sceneId: "sim", itemId: "link", picked: ["report"] },
];
const half = [
  { sceneId: "q1", picked: ["b"] },
  { sceneId: "sim", itemId: "link", picked: ["report"] },
];
const lessons = [
  { key: "one", scenes: TEST_SCENES },
  { key: "two", scenes: TEST_SCENES },
];

describe("SCORM 1.2 API discovery", () => {
  it("finds the API on a parent frame, then on the opener", () => {
    const { api } = fakeApi();
    const top = {} as Window & { API?: Scorm12Api };
    Object.assign(top, { parent: top, API: api });
    const middle = { parent: top } as unknown as Window;
    const frame = { parent: middle } as unknown as Window;
    expect(findApi(frame)).toBe(api);

    const lone = {} as Window;
    Object.assign(lone, { parent: lone, opener: frame });
    expect(findApi(lone)).toBe(api);
  });

  it("skips a frame of another origin and answers null without an LMS", () => {
    const top = {} as Window;
    Object.assign(top, { parent: top });
    const foreign = { parent: top } as Window;
    Object.defineProperty(foreign, "API", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    expect(findApi({ parent: foreign } as unknown as Window)).toBeNull();
  });
});

describe("SCORM 1.2 session", () => {
  it("formats CMITimespan", () => {
    expect(cmiTimespan(0)).toBe("0000:00:00.00");
    expect(cmiTimespan(3_723_450)).toBe("0001:02:03.45");
  });

  it("reports incomplete until every lesson is done, then the score and passed", () => {
    const { api, data, calls } = fakeApi();
    let now = 1_000;
    const s = connect(api, lessons, () => now);
    expect(calls).toEqual(["init"]);
    expect(data["cmi.core.lesson_status"]).toBe("incomplete");

    now += 65_000;
    expect(s.complete("one", right)).toEqual({ ok: true, moduleDone: false });
    expect(data["cmi.core.lesson_status"]).toBe("incomplete");
    expect(data["cmi.core.exit"]).toBe("suspend");
    expect(JSON.parse(data["cmi.suspend_data"])).toEqual({ one: [2, 2] });
    expect(data["cmi.core.session_time"]).toBe("0000:01:05.00");
    expect(calls.at(-1)).toBe("commit");

    expect(s.complete("two", right)).toEqual({ ok: true, moduleDone: true });
    expect(data["cmi.core.score.raw"]).toBe("100");
    expect(data["cmi.core.score.min"]).toBe("0");
    expect(data["cmi.core.score.max"]).toBe("100");
    expect(data["cmi.core.lesson_status"]).toBe("passed");
    expect(data["cmi.core.exit"]).toBe("");
    expect([...s.done()]).toEqual(["one", "two"]);

    s.finish();
    s.finish();
    expect(calls.filter((c) => c === "finish")).toHaveLength(1);
  });

  it("fails below the mastery score and resumes from suspend_data", () => {
    const { api, data } = fakeApi({ "cmi.core.lesson_status": "incomplete", "cmi.suspend_data": JSON.stringify({ one: [1, 2] }) });
    const s = connect(api, lessons);
    expect([...s.done()]).toEqual(["one"]);
    s.complete("two", half);
    // 2 of 4 first-try answers right.
    expect(data["cmi.core.score.raw"]).toBe("50");
    expect(50).toBeLessThan(MASTERY_SCORE);
    expect(data["cmi.core.lesson_status"]).toBe("failed");
  });

  it("marks a module without scored scenes completed, with no score", () => {
    const plain: Scene[] = [TEST_SCENES[0], TEST_SCENES[3]];
    expect(hasScoredScene(plain)).toBe(false);
    expect(hasScoredScene(TEST_SCENES)).toBe(true);
    const { api, data } = fakeApi();
    connect(api, [{ key: "only", scenes: plain }]).complete("only", []);
    expect(data["cmi.core.lesson_status"]).toBe("completed");
    expect(data["cmi.core.score.raw"]).toBeUndefined();
  });

  it("refuses answers that do not fit the lesson and reports nothing", () => {
    const { api, data } = fakeApi();
    const s = connect(api, lessons);
    expect(s.complete("one", [{ sceneId: "q1", picked: ["zzz"] }])).toEqual({ ok: false, moduleDone: false });
    expect(s.complete("missing", right).ok).toBe(false);
    expect(data["cmi.suspend_data"]).toBeUndefined();
  });

  it("plays without an LMS", () => {
    const s = connect(null, lessons);
    expect(s.complete("one", right).ok).toBe(true);
    expect(() => s.finish()).not.toThrow();
  });
});

describe("offline app wiring", () => {
  it("opens the next unfinished lesson and sends each finish to the LMS through the session", async () => {
    const { api, data } = fakeApi({ "cmi.suspend_data": JSON.stringify({ one: [2, 2] }) });
    const pkg: ScormData = {
      locale: "en",
      module: { slug: "demo", title: "Demo", topic: "email" },
      lessons: lessons.map((l) => ({ ...l, id: l.key, title: l.key, minutes: 3, contentLocale: "en" })),
      brands: {},
      messages: {},
    };
    renderToStaticMarkup(createElement(ScormApp, { data: pkg, session: connect(api, lessons) }));
    const p = shown.props!;
    expect(p.lesson.key).toBe("two");
    expect(p.tutorEnabled).toBe(false);
    expect(p.clips).toBeNull();
    expect(p.syllabus.map((l) => l.completed)).toEqual([true, false]);
    expect(p.next).toBeNull();
    expect(await p.onComplete!(half)).toMatchObject({ ok: true, xp: 0, moduleStatus: "completed" });
    // 3 of 4 first-try answers right: 75, under the mastery score of 80.
    expect(data["cmi.core.score.raw"]).toBe("75");
    expect(data["cmi.core.lesson_status"]).toBe("failed");
  });
});
