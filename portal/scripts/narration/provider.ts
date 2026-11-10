/**
 * The narration generator's text-to-speech providers (scripts/generate-narration.ts). Each turns one
 * spoken string into audio (any format ffmpeg reads; the generator encodes the MP3) and its karaoke word
 * timings: the provider's own when it gives them, else estimated.
 */
import type { ClipWord } from "../../src/lib/tts/clips";

export type Synth = { audio: Buffer; durationMs: number; words: ClipWord[] };

export type Provider = {
  /** Goes into the clip key with the voice, so a clip of another provider or voice gets another name. */
  model: string;
  /** For the dry run's estimate. */
  usdPer1kChars: number;
  maxChars: number;
  /** The voice for a language, "" when none is set. */
  voice(locale: string): string;
  synthesize(locale: string, voice: string, key: string, text: string): Promise<Synth>;
  close?(): void;
};

/** Stops the whole run: a wrong key, a used-up quota, a missing voice or engine. */
export class Fatal extends Error {}

/** Counts failures in a row: the returned function, told each outcome, is true once `limit` clips have failed one after another. */
export function failureStreak(limit: number) {
  let inARow = 0;
  return (ok: boolean) => (inARow = ok ? 0 : inARow + 1) >= limit;
}

/** The voice of a language from the environment (NAME_AZ, NAME_RU…), else `fallback`. */
export function envVoice(name: string, locale: string, fallback = ""): string {
  return (process.env[`${name}_${locale.toUpperCase()}`] || fallback).trim();
}

/**
 * Karaoke timings when the provider gives none for a stretch of audio: the words share `startMs`–`endMs`
 * in proportion to their length (plus one for the space after each), so the highlight still moves at
 * about the voice's pace. Times only move forward.
 */
export function estimateWords(words: readonly string[], startMs: number, endMs: number): ClipWord[] {
  const total = words.reduce((n, w) => n + w.length + 1, 0);
  const span = Math.max(0, endMs - startMs);
  let at = 0;
  return words.map((w) => {
    const s = startMs + Math.round((at / total) * span);
    at += w.length + 1;
    return { w, startMs: s, endMs: startMs + Math.round(((at - 1) / total) * span) };
  });
}

/** Karaoke words split into sentences at a word that ends with . ! ? or … (closing quotes and brackets allowed). */
export function sentencesOf(words: readonly string[]): string[][] {
  const out: string[][] = [[]];
  for (const w of words) {
    out[out.length - 1].push(w);
    if (/[.!?…]["'”»)\]]*$/.test(w)) out.push([]);
  }
  return out.filter((s) => s.length);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);
const MAX_ATTEMPTS = 6;

/**
 * fetch with retries on rate limits, server errors, timeouts and network failures; 401/403 stop the run.
 * Returns the successful response; a key in the headers is sent, never printed.
 */
export async function fetchRetry(url: string, init: RequestInit, timeoutMs = 90_000): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`no answer after ${attempt} attempts (${(e as Error).name})`);
      await sleep(backoff(attempt));
      continue;
    }
    if (res.ok) return res;
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new Fatal(`HTTP ${res.status}: ${detail}`);
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(after > 0 ? Math.min(after, 60) * 1000 : backoff(attempt));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
}
