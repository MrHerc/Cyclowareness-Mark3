import type { Outcome, Scene } from "./types";

/**
 * Server-side scoring of a lesson attempt. The player reports what the learner picked in each scored
 * scene (option ids, a verdict, an action, clicked targets); whether that was right, the outcome and
 * the first-try flag are computed here from the lesson's own content, never taken from the browser.
 */

/** What the player sends for one scored scene (or one item of it: a card, a step, a node). */
export type Submission = { sceneId: string; itemId?: string; picked: string[] };

export type ScoredAnswer = { sceneId: string; itemId: string | null; correct: boolean; firstTry: boolean; outcome: Outcome | null };

/** A hotspot click that hit nothing the scene asks for. */
export const MISS = "*";

/** The least time an attempt must take before it counts: 20 seconds, or a quarter of the lesson's nominal length. */
export function minDwellMs(minutes: number): number {
  return Math.max(20_000, Math.round(minutes * 60_000 * 0.25));
}

/** The answer id a tutor checkpoint records: the beat belongs to its scene but is scored on its own. */
export function tutorAnswerId(sceneId: string, beatId: string): string {
  return `${sceneId}:${beatId}`;
}

type Checkpoint = { options?: { id: string; correct: boolean }[] };
type Score = { correct: boolean; outcome?: Outcome } | null;
const key = (sceneId: string, itemId: string | null) => `${sceneId}\u0000${itemId ?? ""}`;

/** Scores one submission against its scene; null when it names nothing the scene has. */
function score(scene: Scene, itemId: string | null, picked: string[]): Score {
  switch (scene.type) {
    case "choice": {
      const opts = scene.question.options;
      if (itemId !== null || picked.some((id) => !opts.some((o) => o.id === id))) return null;
      const right = opts.filter((o) => o.correct).map((o) => o.id);
      // A timed-out question arrives with nothing picked: wrong, like the player shows it.
      return { correct: picked.length === right.length && right.every((id) => picked.includes(id)) };
    }
    case "tutor": {
      const beat = scene.beats.find((b) => tutorAnswerId(scene.id, b.id) === itemId);
      const opt = (beat?.checkpoint as Checkpoint | undefined)?.options?.find((o) => o.id === picked[0]);
      return opt && picked.length === 1 ? { correct: opt.correct } : null;
    }
    case "hotspot": {
      if (itemId !== null) return null;
      const found = new Set(picked.filter((id) => scene.spots.some((s) => s.id === id)));
      // Not enough spots found: the scene was not finished.
      if (found.size < Math.min(scene.minToFind, scene.spots.length)) return null;
      return { correct: found.size === picked.length };
    }
    case "swipe": {
      const card = scene.cards.find((c) => c.id === itemId);
      if (!card || picked.length !== 1 || (picked[0] !== "threat" && picked[0] !== "safe")) return null;
      return { correct: picked[0] === card.verdict };
    }
    case "match": {
      if (itemId !== null) return null;
      const ids = new Set(scene.pairs.map((p) => p.id));
      const attempts = picked.map((p) => p.split(">"));
      if (attempts.some(([l, r, more]) => more !== undefined || !ids.has(l) || !ids.has(r))) return null;
      const matched = new Set(attempts.filter(([l, r]) => l === r).map(([l]) => l));
      if (matched.size < ids.size) return null;
      return { correct: matched.size === attempts.length };
    }
    case "order": {
      const ids = scene.items.map((i) => i.id);
      if (itemId !== null || picked.length !== ids.length || new Set(picked).size !== ids.length || picked.some((id) => !ids.includes(id))) return null;
      return { correct: picked.every((id, i) => id === ids[i]) };
    }
    case "scenario": {
      const node = scene.nodes.find((n) => n.id === itemId);
      const choice = picked.length === 1 && /^\d+$/.test(picked[0]) ? node?.choices?.[Number(picked[0])] : undefined;
      if (!choice) return null;
      const outcome = choice.outcome ?? "safe";
      return { correct: outcome === "safe", outcome };
    }
    case "simulation": {
      const action = scene.steps.find((s) => s.id === itemId)?.actions.find((a) => a.id === picked[0]);
      return action && picked.length === 1 ? { correct: action.outcome === "safe", outcome: action.outcome } : null;
    }
    case "password":
      // The strength is checked in the browser: the password a learner types never leaves it.
      return itemId === null ? { correct: true } : null;
    default:
      return null;
  }
}

/** The submission keys a scene needs before the lesson counts as answered. */
function required(scene: Scene, answered: ReadonlySet<string>): boolean {
  switch (scene.type) {
    case "tutor":
      return scene.beats.every((b) => !b.checkpoint || answered.has(key(scene.id, tutorAnswerId(scene.id, b.id))));
    case "swipe":
      return scene.cards.every((c) => answered.has(key(scene.id, c.id)));
    case "simulation":
      return scene.steps.some((s) => answered.has(key(scene.id, s.id)));
    case "scenario":
      return scene.nodes.some((n) => answered.has(key(scene.id, n.id)));
    case "intro":
    case "recap":
      return true;
    default:
      return answered.has(key(scene.id, null));
  }
}

export type Scoring = { ok: true; answers: ScoredAnswer[] } | { ok: false; reason: "invalid" | "unanswered" };

/**
 * Scores every submission in order. The first submission of a scene (or item) sets its first-try
 * flag, a later one its final correctness. Refused when a submission names nothing in the lesson
 * or a scored scene was never answered.
 */
export function scoreLesson(scenes: readonly Scene[], submissions: readonly Submission[]): Scoring {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const rows = new Map<string, ScoredAnswer>();
  for (const sub of submissions) {
    // A tutor checkpoint is addressed by "<scene>:<beat>"; its scene id is the part before the colon.
    const sceneId = sub.sceneId.includes(":") && !byId.has(sub.sceneId) ? sub.sceneId.slice(0, sub.sceneId.indexOf(":")) : sub.sceneId;
    const scene = byId.get(sceneId);
    const itemId = scene?.type === "tutor" ? sub.sceneId : (sub.itemId ?? null);
    const s = scene ? score(scene, itemId, sub.picked) : null;
    if (!s) return { ok: false, reason: "invalid" };
    const k = key(sceneId, itemId);
    const prev = rows.get(k);
    rows.set(k, { sceneId: sub.sceneId, itemId: sub.itemId ?? null, correct: s.correct, firstTry: prev ? prev.firstTry : s.correct, outcome: s.outcome ?? null });
  }
  const answered = new Set(rows.keys());
  if (!scenes.every((scene) => required(scene, answered))) return { ok: false, reason: "unanswered" };
  return { ok: true, answers: [...rows.values()] };
}
