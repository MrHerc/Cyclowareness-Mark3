"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { langAttrs } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { speechText, wordsOf } from "@/lib/tts/text";

/** The line the narrator was last asked to read: its text as passed to speak(), its language and the word reached. */
export type Line = { text: string; lang: string; word: number; words: number };

/** The current line as a tiny external store, so a word change re-renders the caption bar and the transcript, not the player. */
export function createLineStore() {
  let line: Line | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => line,
    set(next: Line | null) {
      line = next;
      listeners.forEach((fn) => fn());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}
export type LineStore = ReturnType<typeof createLineStore>;

export function useLine(store: LineStore): Line | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}

/** `lang` null: subtitles in the narration's own language; otherwise `map` holds the translations (null while loading). */
export type Captions = { store: LineStore; on: boolean; lang: string | null; map: Record<string, string> | null };

const CaptionsCtx = createContext<Captions | null>(null);
export const CaptionsProvider = CaptionsCtx.Provider;

/**
 * The subtitle of the line being read, as a bar above the scene's bottom row. A scene with a bottom row renders one
 * inside it (`slot`); otherwise the player's own bar at the bottom of the page shows (hidden by CSS when a slot is
 * on the page). Text only; a translation has no word timings, so it fills by the share of words read.
 */
export function CaptionBar({ slot = false, className }: { slot?: boolean; className?: string }) {
  const c = useContext(CaptionsCtx);
  const line = useLine(c?.store ?? NO_LINE);
  if (!c?.on || !line) return null;
  const text = c.lang ? c.map?.[line.text] : speechText(line.text);
  if (!text) return null;
  const words = wordsOf(text);
  const read = c.lang ? Math.round((line.word / Math.max(1, line.words)) * words.length) : line.word;
  return (
    <div data-caption-slot={slot || undefined} className={cn("pointer-events-none flex justify-center px-2 print:hidden", className)}>
      <p {...langAttrs(c.lang ?? line.lang)} className="max-w-2xl rounded-xl bg-ink/85 px-4 py-2 text-center text-body-sm leading-relaxed font-semibold text-pretty text-white shadow-overlay">
        {words.map((w, i) => (
          <span key={i} className={cn("transition-opacity duration-(--duration-fast)", i <= read ? "opacity-100" : "opacity-60")}>
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}
const NO_LINE = createLineStore();

/** Subtitle maps fetched in this tab, and the requests still running: changing back and forth costs no request. */
const loaded = new Map<string, Record<string, string>>();
const running = new Map<string, Promise<Loaded>>();

type Loaded = { map: Record<string, string> } | { error: "error" | "limited" | "unavailable" };
type LoadStored = (lessonId: string, locale: string) => Promise<Record<string, string> | null>;

/** How long a picked language has to stay picked before it is fetched: arrow keys change a closed select at every press. */
const CAPTION_SETTLE_MS = 600;

/**
 * One request per key at a time (a later call gets the running one); a map that arrives is kept for the tab.
 * The key names the lesson, the language it is narrated in (the maps are keyed by that text) and the subtitle language.
 */
export function requestCaptions(key: string, lessonId: string, lang: string, stored: boolean, loadStored: LoadStored): Promise<Loaded> {
  const known = running.get(key);
  if (known) return known;
  const request = (
    stored
      ? // An empty map: the stored translation does not line up with the narrated text (caption-map.ts).
        loadStored(lessonId, lang).then((m): Loaded => (m && Object.keys(m).length ? { map: m } : { error: "unavailable" }))
      : fetch("/api/subtitles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId, target: lang }) }).then(async (res): Promise<Loaded> => {
          if (res.ok) return { map: ((await res.json()) as { lines: Record<string, string> }).lines };
          return { error: res.status === 429 ? "limited" : res.status === 503 || res.status === 404 ? "unavailable" : "error" };
        })
  )
    .catch((): Loaded => ({ error: "error" }))
    .then((r) => {
      if ("map" in r) loaded.set(key, r.map);
      return r;
    })
    .finally(() => running.delete(key));
  running.set(key, request);
  return request;
}

export type CaptionLoad = { map: Record<string, string> | null; state: "idle" | "loading" | "ready" | "error" | "limited" | "unavailable"; retry: () => void };

/**
 * The subtitle map of `lang` for this lesson as narrated in `contentLocale`: a stored translation through `loadStored`
 * (a server action), any other language from POST /api/subtitles (AI-translated). `lang` null: nothing to load.
 */
export function useCaptionMap(lessonId: string, contentLocale: string, lang: string | null, stored: boolean, loadStored: LoadStored): CaptionLoad {
  // The narrated language is in the key: a language switch is a soft refresh, and the old maps match the old text only.
  const key = lang ? `${lessonId}:${contentLocale}:${lang}` : null;
  const [failed, setFailed] = useState<{ key: string; state: "error" | "limited" | "unavailable" } | null>(null);
  const [, setVersion] = useState(0);
  const map = key ? (loaded.get(key) ?? null) : null;
  const failure = failed && failed.key === key ? failed.state : null;

  useEffect(() => {
    if (!key || !lang || loaded.has(key) || failure) return;
    let live = true;
    const timer = window.setTimeout(
      () =>
        void requestCaptions(key, lessonId, lang, stored, loadStored).then((r) => {
          if (!live) return;
          if ("error" in r) setFailed({ key, state: r.error });
          else setVersion((n) => n + 1);
        }),
      running.has(key) ? 0 : CAPTION_SETTLE_MS,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, failure]);

  return { map, state: !key ? "idle" : map ? "ready" : (failure ?? "loading"), retry: () => setFailed(null) };
}
