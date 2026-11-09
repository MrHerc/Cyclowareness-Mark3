import { scoreLesson, type Submission } from "@/lib/content/scoring";
import type { Scene } from "@/lib/content/types";

/** The SCORM 1.2 run-time API an LMS places on a window above the content (window.API). */
export type Scorm12Api = {
  LMSInitialize(arg: ""): string;
  LMSFinish(arg: ""): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(arg: ""): string;
};

/** The share of first-try correct answers a learner needs to pass (imsmanifest's adlcp:masteryscore). */
export const MASTERY_SCORE = 80;

/** Scene types whose answers the portal scores (src/lib/content/scoring.ts); a tutor scene only with a checkpoint. */
export function hasScoredScene(scenes: readonly Scene[]): boolean {
  return scenes.some((s) => (s.type === "tutor" ? s.beats.some((b) => b.checkpoint) : s.type !== "intro" && s.type !== "recap"));
}

/** ADL's API discovery: this window and up to seven parents, then the same walk from the window that opened it. */
export function findApi(win: Window): Scorm12Api | null {
  const walk = (start: Window | null): Scorm12Api | null => {
    let w = start;
    for (let i = 0; w && i <= 7; i++) {
      try {
        const api = (w as Window & { API?: Scorm12Api }).API;
        if (api) return api;
      } catch {
        // A frame of another origin: its API is out of reach, keep climbing.
      }
      if (w.parent === w) break;
      w = w.parent;
    }
    return null;
  };
  return walk(win) ?? walk(win.opener as Window | null);
}

/** CMITimespan of SCORM 1.2: HHHH:MM:SS.SS. */
export function cmiTimespan(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360_000);
  const m = Math.floor((cs % 360_000) / 6000);
  const s = (cs % 6000) / 100;
  return `${String(h).padStart(4, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

type Progress = Record<string, [correct: number, total: number]>;

function readProgress(raw: string | undefined): Progress {
  try {
    const v: unknown = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Progress) : {};
  } catch {
    return {};
  }
}

export type ScormSession = ReturnType<typeof connect>;

/**
 * One LMS session of the module: each finished lesson is scored in the browser like the server scores it,
 * kept in cmi.suspend_data (so a later session resumes), and once every lesson is done the module's status
 * and score go to the LMS. Without an LMS (`api` null) the package still plays, it just reports nowhere.
 */
export function connect(api: Scorm12Api | null, lessons: readonly { key: string; scenes: Scene[] }[], now: () => number = Date.now) {
  const started = now();
  let finished = false;
  api?.LMSInitialize("");
  let progress = readProgress(api?.LMSGetValue("cmi.suspend_data"));
  const set = (element: string, value: string) => api?.LMSSetValue(element, value);
  if (api && ["", "not attempted"].includes(api.LMSGetValue("cmi.core.lesson_status"))) set("cmi.core.lesson_status", "incomplete");
  const commit = () => {
    set("cmi.core.session_time", cmiTimespan(now() - started));
    api?.LMSCommit("");
  };

  return {
    /** Keys of the lessons finished in this or an earlier session. */
    done: (): ReadonlySet<string> => new Set(Object.keys(progress)),
    /** Scores a finished lesson; false when its answers do not fit the lesson (nothing is reported). */
    complete(key: string, answers: readonly Submission[]): { ok: boolean; moduleDone: boolean } {
      const lesson = lessons.find((l) => l.key === key);
      const scored = lesson ? scoreLesson(lesson.scenes, answers) : null;
      if (!scored?.ok) return { ok: false, moduleDone: false };
      progress = { ...progress, [key]: [scored.answers.filter((a) => a.correct).length, scored.answers.length] };
      set("cmi.suspend_data", JSON.stringify(progress));
      const moduleDone = lessons.every((l) => progress[l.key]);
      if (moduleDone) {
        const [correct, total] = lessons.reduce(([c, t], l) => [c + progress[l.key][0], t + progress[l.key][1]], [0, 0]);
        if (total) {
          const score = Math.round((correct / total) * 100);
          set("cmi.core.score.min", "0");
          set("cmi.core.score.max", "100");
          set("cmi.core.score.raw", String(score));
          set("cmi.core.lesson_status", score >= MASTERY_SCORE ? "passed" : "failed");
        } else set("cmi.core.lesson_status", "completed");
      }
      // "suspend" keeps suspend_data for the next session while lessons remain.
      set("cmi.core.exit", moduleDone ? "" : "suspend");
      commit();
      return { ok: true, moduleDone };
    },
    /** Ends the LMS session (the page is closing); later calls do nothing. */
    finish() {
      if (finished || !api) return;
      finished = true;
      commit();
      api.LMSFinish("");
    },
  };
}
