import { useSyncExternalStore } from "react";
import type { Scene } from "@/lib/content/types";
import { speechText } from "@/lib/tts/text";

/**
 * The player's per-browser preferences and its keyboard map. Pure logic (no JSX), so it is unit tested.
 */

type Pref<T> = { get: () => T; set: (v: T) => void; subscribe: (fn: () => void) => () => void; initial: T };

/**
 * A preference kept in localStorage (best effort: an in-memory value when storage is unavailable), read as an
 * external store so the server render and hydration agree on `initial` before the stored value shows.
 */
export function localPref<T extends string | number | boolean>(key: string, initial: T, parse: (raw: string) => T | undefined): Pref<T> {
  let memory = initial;
  const listeners = new Set<() => void>();
  return {
    initial,
    get() {
      try {
        const raw = localStorage.getItem(key);
        const v = raw === null ? undefined : parse(raw);
        if (v !== undefined) return v;
      } catch {
        /* storage unavailable: the in-memory value lasts for this page */
      }
      return memory;
    },
    set(v) {
      memory = v;
      try {
        localStorage.setItem(key, String(v));
      } catch {
        /* ignore */
      }
      listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}

export function usePref<T>(pref: Pref<T>): T {
  return useSyncExternalStore(pref.subscribe, pref.get, () => pref.initial);
}

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

const number = (raw: string) => (raw.trim() === "" ? NaN : Number(raw));
const flag = (raw: string) => (raw === "true" ? true : raw === "false" ? false : undefined);

export const speedPref = localPref<number>("cy:speed", 1, (raw) => ((SPEEDS as readonly number[]).includes(number(raw)) ? number(raw) : undefined));
/** Narration volume, 0–1 (muting is the sound switch, a server preference). */
export const volumePref = localPref<number>("cy:volume", 1, (raw) => {
  const v = number(raw);
  return v >= 0 && v <= 1 ? v : undefined;
});
export const captionsPref = localPref<boolean>("cy:captions", false, flag);
/** "" is the narration's own language; otherwise a shipped locale or an AI subtitle language code. */
export const captionLangPref = localPref<string>("cy:caption-lang", "", (raw) => (raw === "" || /^[a-z]{2}$/.test(raw) ? raw : undefined));
/** The syllabus aside from lg up: open, or collapsed to a rail. */
export const syllabusPref = localPref<boolean>("cy:syllabus", true, flag);
/** The single-key shortcuts (letters and "?"); off for speech-input users, who could trigger them by speaking (WCAG 2.1.4). */
export const letterShortcutsPref = localPref<boolean>("cy:shortcuts", true, flag);

export type Shortcut = "toggle" | "previous" | "next" | "mute" | "captions" | "transcript" | "syllabus" | "help";

const LETTERS: Record<string, Shortcut> = { m: "mute", c: "captions", t: "transcript", s: "syllabus" };

/** Shortcuts on a character key, which the learner can turn off; Space and the arrows stay. */
export const isCharacterKey = (s: Shortcut) => s !== "toggle" && s !== "previous" && s !== "next";

/**
 * The player shortcut for a key press, or null. Arrows follow the reading direction: in a right-to-left page
 * the left arrow goes forward. A letter is the one on the key cap (AZERTY's M is not where QWERTY's is), or
 * the key's QWERTY position on a non-Latin layout (Cyrillic, Arabic, Georgian).
 */
export function shortcutOf(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey">, rtl: boolean): Shortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "?") return "help";
  if (e.key === " " || e.code === "Space") return "toggle";
  if (e.key === "ArrowLeft") return rtl ? "next" : "previous";
  if (e.key === "ArrowRight") return rtl ? "previous" : "next";
  const letter = /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : "";
  return Object.hasOwn(LETTERS, letter) ? LETTERS[letter] : null;
}

/** Where a key belongs to the control under it: text fields, sliders, menus, radio groups and dialogs (the tutor panel, drawers). */
const OWNS_KEYS =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role=slider], [role=menu], [role=menuitem], [role=menuitemradio], [role=listbox], [role=combobox], [role=radiogroup], [role=tablist], dialog";
/** Space and Enter press these; the shortcut must not take that away. */
const PRESSABLE = "button, a[href], summary, [role=button], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=option]";

export function leavesKeyAlone(target: EventTarget | null, shortcut: Shortcut): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return !!el.closest(OWNS_KEYS) || (shortcut === "toggle" && !!el.closest(PRESSABLE));
}

/** The syllabus line of a scene: its own title, its question, or its first spoken line (cut short by CSS). */
export function sceneTitle(s: Scene): string {
  switch (s.type) {
    case "intro":
    case "simulation":
    case "scenario":
      return s.title;
    case "choice":
      return s.question.prompt;
    case "tutor":
      return speechText(s.beats[0]?.say ?? "");
    case "recap":
      return "";
    default:
      return s.prompt;
  }
}

export type TranscriptLine = { scene: number; text: string };

/**
 * The lesson's narration in order, each line exactly as the player passes it to speak() (so the caption maps
 * and the line being read match it): what every scene reads on its own, without the answer feedback.
 */
export function transcriptOf(scenes: readonly Scene[]): TranscriptLine[] {
  return scenes.flatMap((s, scene) => {
    const lines: (string | undefined)[] =
      s.type === "tutor"
        ? s.beats.flatMap((b) => [b.say, (b.checkpoint as { prompt?: string } | undefined)?.prompt])
        : s.type === "intro"
          ? [`${s.title}. ${s.body}`]
          : s.type === "simulation"
            ? [s.intro, ...s.steps.map((step) => step.spoken ?? step.say)]
            : s.type === "choice"
              ? [s.question.prompt]
              : s.type === "scenario"
                ? s.nodes.map((n) => n.spoken ?? n.text)
                : s.type === "recap"
                  ? [s.points.join(". ")]
                  : [s.prompt];
    return lines.filter((text): text is string => !!text && speechText(text) !== "").map((text) => ({ scene, text }));
  });
}
