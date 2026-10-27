/**
 * Pre-generated narration clips (lesson-engine.md §1.6): one audio file per spoken string and language,
 * with word timings for the karaoke highlight. A lesson's manifest maps speechText(string) to its clip.
 */
import { speechText, wordOffsets, wordsOf } from "./text";

export type ClipWord = { w: string; startMs: number; endMs: number };
export type NarrationClip = { url: string; durationMs: number; words: ClipWord[] };
/** One lesson's clips in one language, keyed by the speechText of each string the player speaks. */
export type NarrationClips = Record<string, NarrationClip>;

/** Per-character timings as the provider returns them, relative to the text that was sent. */
export type CharacterAlignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };

/** Clips are public static files: public/generated/tts/<locale>/<key>.mp3. */
export function clipUrl(locale: string, key: string): string {
  return `/generated/tts/${locale}/${key}.mp3`;
}

/** A clip URL the generator writes for `locale`, and nothing else (no other folder, host or scheme). */
export function isClipUrl(url: string, locale: string): boolean {
  return /^\/generated\/tts\/([a-z]{2})\/[0-9a-f]{64}\.mp3$/.exec(url)?.[1] === locale;
}

/**
 * Manifests are read by the server only (src/server/narration.ts), never served as files, so the lesson
 * text stays behind sign-in: content/narration/<locale>/<module>__<lesson>.json.
 */
export const NARRATION_DIR = ["content", "narration"] as const;

/** "module/lesson" → "module__lesson.json". */
export function manifestName(lessonKey: string): string {
  return `${lessonKey.replace("/", "__")}.json`;
}

/** How far ahead an alignment character may be found when the provider skipped some of the text. */
const LOOKAHEAD = 4;
const isSpace = (c: string | undefined) => !!c && /^\s+$/.test(c);
const ms = (seconds: number) => Math.round(seconds * 1000);

/**
 * Word timings from per-character timings, one entry per wordsOf(text) word, so the indexes are the ones
 * the player highlights in every script (Cyrillic, Georgian, Arabic with its marks, punctuation). Each
 * alignment character is matched at the current position or a few characters ahead, so a character the
 * provider dropped or added does not shift the rest; a word with no timed character starts where the
 * previous one ended. Times only move forward.
 */
export function wordTimings(text: string, alignment: CharacterAlignment): ClipWord[] {
  const clean = speechText(text);
  const words = wordsOf(clean);
  const offsets = wordOffsets(clean, words);
  const start: (number | undefined)[] = [];
  const end: (number | undefined)[] = [];
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  let pos = 0;
  for (let i = 0; i < characters.length && pos < clean.length; i++) {
    const c = characters[i];
    if (!c) continue;
    let at = -1;
    for (let k = pos; k <= Math.min(pos + LOOKAHEAD, clean.length - 1); k++) {
      if (clean.startsWith(c, k) || (isSpace(c) && isSpace(clean[k]))) {
        at = k;
        break;
      }
    }
    if (at < 0) continue;
    const len = isSpace(c) ? 1 : c.length;
    for (let k = at; k < at + len; k++) {
      start[k] = starts[i];
      end[k] = ends[i];
    }
    pos = at + len;
  }

  const out: ClipWord[] = [];
  let lastStart = 0;
  let lastEnd = 0;
  words.forEach((w, j) => {
    let s = Infinity;
    let e = -Infinity;
    for (let k = offsets[j]; k < offsets[j] + w.length; k++) {
      const a = start[k];
      const b = end[k];
      if (a === undefined || b === undefined) continue;
      s = Math.min(s, a);
      e = Math.max(e, b);
    }
    const startMs = Number.isFinite(s) ? Math.max(ms(s), lastStart) : lastEnd;
    const endMs = Number.isFinite(e) ? Math.max(ms(e), startMs) : startMs;
    out.push({ w, startMs, endMs });
    lastStart = startMs;
    lastEnd = Math.max(lastEnd, endMs);
  });
  return out;
}

/** The word being spoken at `ms` into the clip: the last one that has started (the first before any has). */
export function wordAt(words: readonly ClipWord[], ms: number): number {
  let i = 0;
  while (i + 1 < words.length && words[i + 1].startMs <= ms) i++;
  return i;
}
