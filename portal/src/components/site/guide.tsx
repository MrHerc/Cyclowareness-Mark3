"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useNarrator } from "@/components/player/narrator";
import type { MascotAim, MascotFire, MascotGuide } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import type { Line } from "@/lib/landing";
import { unmark } from "./marked";

/**
 * The landing guide: one voice (Web Speech) and one caption for the whole tour.
 * Lines are queued; in quiet mode (or before the visitor's first tap, when browsers block
 * speech) captions advance on a reading timer instead.
 */

const QUIET_KEY = "cy-landing-quiet";
const MEMORY_KEY = "cy-landing";

export type Memory = { visits: number; score: number | null; total: number; role: string | null; at: number };

const EMOTION_MOOD: Record<string, MascotMood> = {
  warm: "happy",
  curious: "curious",
  whisper: "think",
  excited: "excited",
  playful: "happy",
  cheerful: "happy",
  serious: "alert",
  proud: "proud",
  concerned: "worried",
};

/** One-shot moves of the mascot's state machine the guide makes. */
export type GuideMove = "bounce" | "knock" | "touch" | "tap";
export type GuideAct = "rest" | "nap";

type Say = {
  lang?: string;
  gesture?: MascotGesture;
  then?: () => void;
  /** Said under the breath: the whisper pose for the whole queue. */
  whisper?: boolean;
  /** Pointed at while the queue plays. */
  aim?: { angle: number } | null;
  /** Fired as the queue starts. */
  move?: GuideMove;
};
type Caption = { line: Line; word: number } | null;

type GuideApi = {
  say: (line: Line | Line[], opts?: Say) => void;
  stop: () => void;
  /** True while a queue of lines is still playing (spoken or on the caption timer). */
  busy: () => boolean;
  quiet: boolean;
  setQuiet: (q: boolean) => void;
  caption: Caption;
  mood: MascotMood;
  talking: boolean;
  gesture: { name: MascotGesture; key: number } | null;
  /** The mascot's guide poses: wait in quiet mode, listen while a caller line plays, whisper for whispered lines, the travel walk between chapters. */
  pose: MascotGuide;
  /** Where the mascot points while the current queue plays. */
  aim: MascotAim;
  /** The last one-shot move; its key changes with every `move` call. */
  fire: MascotFire | null;
  act: GuideAct;
  move: (name: GuideMove) => void;
  setTravel: (dir: "left" | "right" | null) => void;
  setAct: (act: GuideAct) => void;
  activated: boolean;
  memory: () => Memory | null;
  remember: (patch: Partial<Memory>) => void;
  forget: () => void;
};

const Ctx = createContext<GuideApi | null>(null);

export function useGuide(): GuideApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuide outside GuideProvider");
  return v;
}

function readQuiet(): boolean {
  try {
    return window.localStorage.getItem(QUIET_KEY) === "1";
  } catch {
    return false;
  }
}
const quietListeners = new Set<() => void>();
function subscribeQuiet(fn: () => void) {
  quietListeners.add(fn);
  return () => void quietListeners.delete(fn);
}

export function GuideProvider({ lang, memoryDays, children }: { lang: string; memoryDays: number; children: ReactNode }) {
  const quiet = useSyncExternalStore(subscribeQuiet, readQuiet, () => false);
  // Read by the player so a line said right after switching to quiet already uses the caption timer.
  const quietRef = useRef(quiet);
  const [caption, setCaption] = useState<Caption>(null);
  const [gesture, setGesture] = useState<{ name: MascotGesture; key: number } | null>(null);
  // What the current queue was said with; null once it has played out.
  const [playing, setPlaying] = useState<{ whisper: boolean; aim: { angle: number } | null } | null>(null);
  const [fire, setFire] = useState<MascotFire | null>(null);
  const [act, setAct] = useState<GuideAct>("rest");
  const [travel, setTravel] = useState<"left" | "right" | null>(null);
  const [activated, setActivated] = useState(false);
  const { speak: nSpeak, stop: nStop, speaking, supported } = useNarrator({ enabled: !quiet && activated, rate: 1, lang });
  const queue = useRef<{ lines: Line[]; opts: Say } | null>(null);
  const timer = useRef<number | null>(null);
  const run = useRef(0);

  useEffect(() => {
    quietRef.current = quiet;
  }, [quiet]);

  // Browsers allow speech only after the visitor interacts with the page.
  useEffect(() => {
    const on = () => setActivated(true);
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, []);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const stop = useCallback(() => {
    run.current++;
    clearTimer();
    queue.current = null;
    setPlaying(null);
    nStop();
  }, [nStop]);

  const move = useCallback((name: GuideMove) => setFire((f) => ({ name, key: (f?.key ?? 0) + 1 })), []);

  const playNext = useCallback(
    // Named so the recursion below refers to the function itself, not to the `const` being declared.
    function playNext(my: number) {
      const q = queue.current;
      if (!q || my !== run.current) return;
      const line = q.lines.shift();
      if (!line) {
        queue.current = null;
        setPlaying(null);
        q.opts.then?.();
        return;
      }
      setCaption({ line, word: 0 });
      const text = unmark(line.spoken ?? line.text);
      const shown = unmark(line.text);
      const next = () => my === run.current && playNext(my);
      if (quietRef.current || !activated || !supported) {
        clearTimer();
        timer.current = window.setTimeout(next, Math.max(1600, shown.length * 55));
        return;
      }
      // The queue moves on exactly once: when the line was spoken, after the reading time when the
      // engine failed (unsupported voice, busy audio, blocked), or from a safety timer when the engine
      // reports neither, so a chapter waiting for the queue (the phone call) can never get stuck.
      const reading = Math.max(1600, shown.length * 55);
      let settled = false;
      const advance = (delay: number) => {
        if (settled || my !== run.current) return;
        settled = true;
        clearTimer();
        timer.current = window.setTimeout(next, delay);
      };
      clearTimer();
      timer.current = window.setTimeout(() => advance(0), reading * 2 + 3000);
      nSpeak(text, {
        voice: line.voice === "caller" ? "man" : "tutor",
        lang: q.opts.lang,
        onWord: (i) => my === run.current && setCaption({ line, word: i }),
        onEnd: () => advance(250),
        onError: () => advance(reading),
      });
    },
    [activated, supported, nSpeak],
  );

  const say = useCallback(
    (line: Line | Line[], opts: Say = {}) => {
      stop();
      const my = run.current;
      if (opts.gesture) setGesture((g) => ({ name: opts.gesture!, key: (g?.key ?? 0) + 1 }));
      if (opts.move) move(opts.move);
      setPlaying({ whisper: !!opts.whisper, aim: opts.aim ?? null });
      // A line wakes a napping mascot.
      setAct("rest");
      queue.current = { lines: Array.isArray(line) ? [...line] : [line], opts };
      playNext(my);
    },
    [stop, move, playNext],
  );

  const setQuiet = useCallback(
    (q: boolean) => {
      try {
        window.localStorage.setItem(QUIET_KEY, q ? "1" : "0");
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
      quietRef.current = q;
      quietListeners.forEach((fn) => fn());
      if (q) nStop();
    },
    [nStop],
  );

  const busy = useCallback(() => queue.current !== null, []);

  const memory = useCallback((): Memory | null => {
    try {
      const raw = window.localStorage.getItem(MEMORY_KEY);
      if (!raw) return null;
      const m = JSON.parse(raw) as Memory;
      if (Date.now() - m.at > memoryDays * 86_400_000) return null;
      return m;
    } catch {
      return null;
    }
  }, [memoryDays]);

  const remember = useCallback(
    (patch: Partial<Memory>) => {
      try {
        const prev = memory() ?? { visits: 0, score: null, total: 0, role: null, at: Date.now() };
        window.localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...prev, ...patch, at: Date.now() }));
      } catch {
        /* private mode: nothing is remembered */
      }
    },
    [memory],
  );

  const forget = useCallback(() => {
    try {
      window.localStorage.removeItem(MEMORY_KEY);
      window.localStorage.removeItem(QUIET_KEY);
    } catch {
      /* nothing stored */
    }
    quietListeners.forEach((fn) => fn());
  }, []);

  useEffect(() => () => clearTimer(), []);

  const pose = useMemo<MascotGuide>(
    () => ({
      wait: quiet,
      listen: playing !== null && caption?.line.voice === "caller",
      whisper: playing !== null && (playing.whisper || caption?.line.emotion === "whisper"),
      travel,
    }),
    [quiet, playing, caption, travel],
  );

  const api = useMemo<GuideApi>(
    () => ({
      say,
      stop,
      busy,
      quiet,
      setQuiet,
      caption,
      mood: caption ? (EMOTION_MOOD[caption.line.emotion ?? ""] ?? "talk") : "idle",
      talking: speaking,
      gesture,
      pose,
      aim: playing?.aim ?? null,
      fire,
      act,
      move,
      setTravel,
      setAct,
      activated,
      memory,
      remember,
      forget,
    }),
    [say, stop, busy, quiet, setQuiet, caption, speaking, gesture, pose, playing, fire, act, move, activated, memory, remember, forget],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
