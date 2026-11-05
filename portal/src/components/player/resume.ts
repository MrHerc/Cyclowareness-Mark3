import type { Scene } from "@/lib/content/types";
import { tutorAnswerId } from "@/lib/content/scoring";
import type { LessonResult } from "@/server/actions/learning";
import type { PlayerAnswer } from "./scenes";

export { tutorAnswerId };

/**
 * Where a learner is in a lesson, kept in the tab's sessionStorage so that a reload, a discarded
 * mobile tab or a remount resumes the lesson (or shows its result again) instead of starting over.
 * A saved state is only used for the exact scenes it was written for: when the lesson changes,
 * the learner starts from the beginning.
 */
export type SavedLesson =
  /** `maxIndex`: the furthest scene reached; the learner may jump back to any scene up to it, never past it. */
  | { kind: "playing"; index: number; maxIndex: number; inner: number; answers: PlayerAnswer[]; elapsedMs: number }
  | { kind: "done"; result: LessonResult; token: string | null };

// 2: answers hold what was picked (v1 held the browser's own verdict), so an older state starts the lesson over.
const VERSION = 2;
const MAX_ANSWERS = 400;
const MAX_ELAPSED_MS = 4 * 3600_000;
const MAX_PICKED = 40;
const MODULE_STATUSES = new Set(["in_progress", "awaiting_attestation", "completed"]);

export function lessonStateKey(userId: string, slug: string, lessonKey: string): string {
  return `cy:lesson:v${VERSION}:${userId}:${slug}:${lessonKey}`;
}

export function serializeLesson(state: SavedLesson, sceneIds: string[]): string {
  return JSON.stringify({ v: VERSION, scenes: sceneIds, ...state });
}

/** Every answer id the lesson's scenes can record, so a restored answer is kept only if the lesson still has it. */
export function answerIdsOf(scenes: Scene[]): Set<string> {
  return new Set(scenes.flatMap((s) => (s.type === "tutor" ? [s.id, ...s.beats.map((b) => tutorAnswerId(s.id, b.id))] : [s.id])));
}

const shortString = (v: unknown): v is string => typeof v === "string" && v.length <= 80;

function answerOf(v: unknown): PlayerAnswer | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (!shortString(a.sceneId) || !Array.isArray(a.picked) || a.picked.length > MAX_PICKED || !a.picked.every(shortString)) return null;
  if (a.itemId !== undefined && !shortString(a.itemId)) return null;
  return { sceneId: a.sceneId, ...(a.itemId !== undefined ? { itemId: a.itemId as string } : {}), picked: a.picked };
}

function resultOf(v: unknown): LessonResult | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (r.ok !== true || !Number.isInteger(r.xp) || (r.xp as number) < 0) return null;
  if (r.moduleStatus !== undefined && !(typeof r.moduleStatus === "string" && MODULE_STATUSES.has(r.moduleStatus))) return null;
  if (r.nextKey !== undefined && r.nextKey !== null && typeof r.nextKey !== "string") return null;
  return {
    ok: true,
    xp: r.xp as number,
    ...(r.moduleStatus !== undefined ? { moduleStatus: r.moduleStatus as LessonResult["moduleStatus"] } : {}),
    ...(r.nextKey !== undefined ? { nextKey: r.nextKey as string | null } : {}),
  };
}

/**
 * Reads a saved state back; anything malformed, from another version or for other scenes is ignored,
 * and so is any answer whose id is not in `answerIds` (see answerIdsOf).
 */
export function parseLesson(raw: string | null, sceneIds: string[], answerIds: ReadonlySet<string>): SavedLesson | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== VERSION || !Array.isArray(o.scenes) || o.scenes.length !== sceneIds.length || o.scenes.some((id, i) => id !== sceneIds[i])) return null;

  if (o.kind === "playing") {
    const index = o.index;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= sceneIds.length) return null;
    // Saved before maxIndex existed: the scene shown was the furthest one.
    const maxIndex = o.maxIndex === undefined ? index : o.maxIndex;
    if (!Number.isInteger(maxIndex) || (maxIndex as number) < (index as number) || (maxIndex as number) >= sceneIds.length) return null;
    if (typeof o.inner !== "number" || !(o.inner >= 0 && o.inner < 1)) return null;
    if (typeof o.elapsedMs !== "number" || !Number.isFinite(o.elapsedMs) || o.elapsedMs < 0) return null;
    if (!Array.isArray(o.answers)) return null;
    const answers = o.answers
      .map(answerOf)
      .filter((a): a is PlayerAnswer => !!a && answerIds.has(a.sceneId))
      .slice(0, MAX_ANSWERS);
    return { kind: "playing", index: index as number, maxIndex: maxIndex as number, inner: o.inner, answers, elapsedMs: Math.min(o.elapsedMs, MAX_ELAPSED_MS) };
  }
  if (o.kind === "done") {
    const result = resultOf(o.result);
    if (!result) return null;
    if (o.token !== null && !(typeof o.token === "string" && o.token.length <= 200)) return null;
    return { kind: "done", result, token: o.token as string | null };
  }
  return null;
}
