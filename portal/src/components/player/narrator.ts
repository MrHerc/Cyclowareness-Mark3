"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { wordAt, type NarrationClip, type NarrationClips } from "@/lib/tts/clips";
import { speechText, wordOffsets, wordsOf } from "@/lib/tts/text";

export { speechText, wordsOf };

/**
 * Narration with word timing for the karaoke highlight: a lesson's pre-generated clip for the text when
 * there is one (natural voice, exact word times), otherwise the browser's speech engine (Web Speech
 * API), whose timing is estimated from the speech rate when it gives no word boundaries.
 * Text is read only by a voice of its own language; without one the narrator stays silent.
 */
export type Voice = "tutor" | "man" | "man-2" | "man-3" | "woman" | "woman-2" | "young-woman" | "young-man" | "young-man-2" | "older-man" | "older-woman" | "child";

// Whole names only ("man" is in "German" and "Romanian"), with Edge's natural voices of the library
// languages; Edge also lists "AvaMultilingual"-style names.
const voiceNames = (names: string) => new RegExp(`\\b(${names})(multilingual)?\\b`, "i");
const FEMALE = voiceNames(
  "female|woman|zira|aria|jenny|samantha|susan|hazel|libby|sonia|michelle|natasha|ava|emma|serena|karen|moira|tessa|banu|eka|zariyah|emel|alina|polina|svetlana|dariya|katja|seraphina|amala|denise|vivienne|eloise|google uk english female|google us english",
);
const MALE = voiceNames("male|man|david|mark|guy|davis|christopher|eric|ryan|george|daniel|james|thomas|alex|fred|andrew|babek|giorgi|hamed|ahmet|emil|ostap|dmitry|conrad|florian|henri|r[eé]my|google uk english male");

/** Among equally good voices, the region a language is read in by default: Arabic as in Saudi Arabia. */
const PREFERRED_REGION: Record<string, string> = { ar: "sa" };

const baseTag = (x: string) => x.toLowerCase().split(/[-_]/)[0];
const regionTag = (x: string) => x.toLowerCase().split(/[-_]/)[1] ?? "";

/** "az", "az-AZ" and "az_AZ" (Android) all name Azerbaijani. */
function sameLanguage(tag: string, lang: string): boolean {
  return baseTag(tag) === baseTag(lang);
}

/**
 * Whether the browser can read text in a language: "unknown" while its voice list is empty (the list
 * loads asynchronously, and some engines never list voices), "missing" when no installed voice speaks
 * the language (Azerbaijani in Chrome on Windows, for example), "available" otherwise.
 */
export type VoiceAvailability = "unknown" | "available" | "missing";

export function voiceAvailability(voices: readonly { lang: string }[], lang: string): VoiceAvailability {
  if (!voices.length) return "unknown";
  return voices.some((v) => sameLanguage(v.lang, lang)) ? "available" : "missing";
}

const speechEngine = (): SpeechSynthesis | null => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

function subscribeVoices(onChange: () => void) {
  const engine = speechEngine();
  engine?.addEventListener("voiceschanged", onChange);
  return () => engine?.removeEventListener("voiceschanged", onChange);
}

/** Live voice availability for `lang`: "unknown" on the server and until the browser lists its voices. */
export function useVoiceAvailability(lang: string): VoiceAvailability {
  return useSyncExternalStore<VoiceAvailability>(
    subscribeVoices,
    () => {
      const engine = speechEngine();
      return engine ? voiceAvailability(engine.getVoices(), lang) : "unknown";
    },
    () => "unknown",
  );
}

/** How long speak() waits for an empty voice list to fill before leaving the voice to the engine. */
const VOICE_WAIT_MS = 1500;

type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">;

/**
 * The engine voice for a text: only voices of its language; natural/neural/online voices first, then
 * network voices, then the language's usual region; then the gender the `Voice` asks for ("tutor" is a
 * woman). Pitch and rate shape the age.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string, voice: Voice): { v: V | null; pitch: number; rateMul: number } {
  const quality = (x: V) => (/(natural|neural|online|premium|enhanced)/i.test(x.name) ? 2 : 0) + (x.localService ? 0 : 1);
  const region = PREFERRED_REGION[baseTag(lang)];
  const regional = (x: V) => (region && regionTag(x.lang) === region ? 1 : 0);
  // Voices of the language only: speak() stays silent when there is none.
  const sorted = voices.filter((x) => sameLanguage(x.lang, lang)).sort((a, b) => quality(b) - quality(a) || regional(b) - regional(a));
  const female = sorted.filter((x) => FEMALE.test(x.name) && !/\bmale\b/i.test(x.name.replace(/female/i, "")));
  const male = sorted.filter((x) => MALE.test(x.name) && !FEMALE.test(x.name));
  const wantsMale = /man|male/.test(voice) && !/woman/.test(voice);
  const wantsFemale = /woman/.test(voice) || voice === "tutor";
  let v: V | null = sorted[0] ?? null;
  if (wantsMale && male.length) v = male[voice.endsWith("-2") ? 1 % male.length : voice.endsWith("-3") ? 2 % male.length : 0];
  if (wantsFemale && female.length) v = female[voice.endsWith("-2") ? 1 % female.length : 0];
  const pitch = voice === "child" ? 1.45 : voice.startsWith("young") ? 1.12 : voice.startsWith("older") ? 0.82 : voice === "tutor" ? 1.05 : 1;
  return { v, pitch, rateMul: voice.startsWith("older") ? 0.92 : 1 };
}

/** BCP 47 tags for the utterance when the engine lists no voices at all and picks one itself. */
const LANG_TAG: Record<string, string> = { az: "az-AZ", en: "en-US", ru: "ru-RU", tr: "tr-TR", ro: "ro-RO", ka: "ka-GE", uk: "uk-UA", de: "de-DE", fr: "fr-FR", ar: "ar-SA" };

/**
 * Word times estimated from the speech rate, for an engine that sends no word boundaries: onWord(i) at i × perWord ms
 * of speech, once a check 600 ms in finds none (`stale`: boundaries came, or the text was replaced). hold() and go()
 * stop and continue it where it was, for pause and resume; its timeouts go through `after` and `clear`.
 */
export function wordClock(count: number, perWord: number, onWord: (i: number) => void, stale: () => boolean, after: (fn: () => void, ms: number) => void, clear: () => void) {
  let read = 0; // ms of speech before the current run
  let since = 0;
  let held = false;
  const run = () => {
    since = performance.now();
    const wait = Math.max(0, 600 - read);
    after(() => {
      if (stale()) return;
      // Words already passed fire at once, in order, so the highlight lands on the current one.
      for (let i = 1; i < count; i++) after(() => !stale() && onWord(i), i * perWord - read - wait);
    }, wait);
  };
  run();
  return {
    hold() {
      if (held) return;
      held = true;
      read += performance.now() - since;
      clear();
    },
    go() {
      if (!held) return;
      held = false;
      run();
    },
  };
}

const clampRate = (rate: number) => Math.max(0.5, Math.min(2, rate));
const clampVolume = (volume: number) => Math.max(0, Math.min(1, volume));

/**
 * The clip that reads `clean` (speechText) in `textLang`, or undefined when the speech engine must read it:
 * the lesson's clips are in the hook's language only, and a text without one (a changed sentence, an
 * interface string in another language) goes to Web Speech.
 */
export function clipFor(clips: NarrationClips | null | undefined, clean: string, textLang: string, clipsLang: string): NarrationClip | undefined {
  return clips && sameLanguage(textLang, clipsLang) && Object.hasOwn(clips, clean) ? clips[clean] : undefined;
}

/**
 * What a clip that failed leads to; `errorName` is the play() rejection's DOMException name, null for the element's
 * "error" event (a missing or undecodable file). Paused or replaced before it started: nothing. Blocked by the
 * browser: reported, since the speech engine would be blocked too. Anything else: the line is spoken by the engine.
 */
export function clipFailure(errorName: string | null): "ignore" | "engine" | "not-allowed" {
  if (errorName === "AbortError") return "ignore";
  return errorName === "NotAllowedError" ? "not-allowed" : "engine";
}

/** The clip after `clean` in the manifest, which lists the lesson's texts in reading order: the one to fetch ahead. */
export function nextClipUrl(clips: NarrationClips, clean: string): string | undefined {
  const keys = Object.keys(clips);
  const at = keys.indexOf(clean);
  return at >= 0 && at + 1 < keys.length ? clips[keys[at + 1]].url : undefined;
}

/** 10 ms of silence (8 kHz, 8-bit WAV). */
export const SILENT_CLIP = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
/** The events that count as a user gesture for media playback (a tap ends with touchend/pointerup, a mouse press starts one). */
const GESTURES = ["pointerup", "touchend", "mousedown", "keydown"] as const;

/**
 * iOS lets an audio element play without a gesture only after it has played inside one. On the first
 * gesture on `target`, play SILENT_CLIP on the clips' element (synchronously, inside the gesture), then
 * disarm. `element()` returns null when a clip is already playing: that element is unlocked.
 * Returns the disarm function for unmounting.
 */
export function armAudioUnlock(target: EventTarget, element: () => HTMLAudioElement | null): () => void {
  const armed = new AbortController();
  const disarm = () => armed.abort();
  const unlock = () => {
    disarm();
    const el = element();
    if (!el) return;
    el.src = SILENT_CLIP;
    // A clip that speak() sets meanwhile replaces the silence (its play() rejects with AbortError).
    el.play().then(
      () => {
        if (el.src === SILENT_CLIP) el.pause();
      },
      () => {},
    );
  };
  // Capture phase: before any handler can stop the event, and before React's click starts a clip.
  GESTURES.forEach((e) => target.addEventListener(e, unlock, { capture: true, signal: armed.signal }));
  return disarm;
}

/** True where an audio element's volume cannot be set from script (iOS: always 1), so a volume slider would do nothing. */
export function volumeIsFixed(el: { volume: number }): boolean {
  el.volume = 0.5;
  return el.volume !== 0.5;
}

/**
 * `clips`: the lesson's pre-generated clips for `lang` (src/server/narration.ts), keyed by speechText;
 * a text without a clip, or in another language, goes to the speech engine. `volume`: 0–1.
 */
export function useNarrator({ enabled, rate, lang = "en", clips, volume = 1 }: { enabled: boolean; rate: number; lang?: string; clips?: NarrationClips | null; volume?: number }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const timers = useRef<number[]>([]);
  const token = useRef(0);
  // The settings as of the last render: speak() reads them when it runs, so a line chained from an older render's onEnd gets the current ones.
  const live = useRef({ enabled, rate, volume });
  useLayoutEffect(() => {
    live.current = { enabled, rate, volume };
  });
  // The estimated word timing of the utterance being read (an engine without word boundaries): pause() holds it, resume() goes on.
  const timing = useRef<{ hold: () => void; go: () => void } | null>(null);
  // A speak() waiting for the voice list to load (see VOICE_WAIT_MS).
  const waiting = useRef<(() => void) | null>(null);
  // One audio element for every clip; `endClip` detaches the playing clip (listeners, frame loop).
  const audio = useRef<HTMLAudioElement | null>(null);
  const endClip = useRef<(() => void) | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const hasClips = !!clips && Object.keys(clips).length > 0;
  // Clip URLs already fetched ahead into the HTTP cache (they are immutable).
  const prefetched = useRef(new Set<string>());
  const engineVoice = useVoiceAvailability(lang);
  // The lesson's own clips read it whatever voices this browser has.
  const voice: VoiceAvailability = hasClips ? "available" : engineVoice;

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  const clearWaiting = () => {
    if (waiting.current) window.speechSynthesis.removeEventListener("voiceschanged", waiting.current);
    waiting.current = null;
  };

  const stop = useCallback(() => {
    token.current++;
    clearTimers();
    timing.current = null;
    endClip.current?.();
    if (supported) {
      clearWaiting();
      // cancel() does not clear the engine's paused state, and a later speak() would sit silently in the paused queue.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  useEffect(() => stop, [stop]);

  // The first tap anywhere unlocks the clips' element, so a clip started later without a tap (auto-advance) plays on iOS.
  useEffect(() => (hasClips ? armAudioUnlock(window, () => (endClip.current ? null : (audio.current ??= new Audio()))) : undefined), [hasClips]);

  // A clip takes speed and volume changes at once; an utterance keeps the values it started with.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.defaultPlaybackRate = clampRate(rate);
    el.playbackRate = clampRate(rate);
    el.volume = clampVolume(volume);
  }, [rate, volume]);

  /**
   * Speaks text. onWord(i) fires as each word starts; onEnd when finished.
   * With sound off nothing is spoken and onEnd is not called (the learner continues manually).
   * Without a voice for the language nothing is spoken either: the whole text shows, onEnd is not
   * called and onError("language-unavailable") is, as after an engine failure.
   * A text with a clip plays it (in the clip's voice, whatever `voice` asks); a clip that cannot be
   * loaded falls back to the engine, and a browser that refuses to play gives onError("not-allowed").
   */
  const speak = useCallback(
    (text: string, opts: { voice?: Voice; lang?: string; onWord?: (i: number) => void; onEnd?: () => void; onError?: (error: string) => void } = {}) => {
      stop();
      const { enabled, rate, volume } = live.current;
      const my = ++token.current;
      const clean = speechText(text);
      const words = wordsOf(clean);
      const useLang = opts.lang ?? lang;
      const clip = clipFor(clips, clean, useLang, lang);
      if (!enabled || !clean || (!clip && !supported)) {
        opts.onWord?.(words.length);
        return;
      }
      const offsets = wordOffsets(clean, words);
      const say = () => {
        const voices = window.speechSynthesis.getVoices();
        // Never read the text with another language's voice: show it whole and let the learner go on
        // by hand, as after an engine failure. Callers that run on their own (the landing guide) get
        // onError to fall back to reading time.
        if (voiceAvailability(voices, useLang) === "missing") {
          opts.onWord?.(words.length);
          opts.onError?.("language-unavailable");
          return;
        }
        const { v, pitch, rateMul } = pickVoice(voices, useLang, opts.voice ?? "tutor");
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = v?.lang ?? LANG_TAG[useLang] ?? useLang;
        if (v) u.voice = v;
        u.rate = clampRate(rate * rateMul);
        u.pitch = pitch;
        u.volume = clampVolume(volume);
        let gotBoundary = false;
        u.onboundary = (e) => {
          if (my !== token.current || e.name === "sentence") return;
          gotBoundary = true;
          let i = offsets.findIndex((o, k) => e.charIndex >= o && (k === offsets.length - 1 || e.charIndex < offsets[k + 1]));
          if (i < 0) i = 0;
          opts.onWord?.(i);
        };
        u.onstart = () => {
          if (my !== token.current) return;
          setSpeaking(true);
          opts.onWord?.(0);
          timing.current = wordClock(
            words.length,
            60_000 / (165 * u.rate),
            (i) => opts.onWord?.(i),
            () => gotBoundary || my !== token.current,
            (fn, ms) => void timers.current.push(window.setTimeout(fn, ms)),
            clearTimers,
          );
        };
        const done = () => {
          if (my !== token.current) return;
          clearTimers();
          setSpeaking(false);
          opts.onWord?.(words.length);
          opts.onEnd?.();
        };
        u.onend = done;
        u.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled" || my !== token.current) return;
          // An engine failure is not "narration finished": show the whole text but let the learner continue by hand.
          // Callers that run on their own (the landing guide) get `onError` to fall back to reading time.
          clearTimers();
          setSpeaking(false);
          opts.onWord?.(words.length);
          opts.onError?.(e.error);
        };
        window.speechSynthesis.speak(u);
      };
      const viaEngine = () => {
        if (!supported) {
          opts.onWord?.(words.length);
          opts.onError?.("synthesis-unavailable");
          return;
        }
        // Chrome lists no voices until shortly after the first request: wait for the list briefly; an
        // engine that never lists any is left to choose a voice from the utterance's language.
        if (window.speechSynthesis.getVoices().length) {
          say();
          return;
        }
        const start = () => {
          if (my !== token.current) return;
          clearWaiting();
          clearTimers();
          say();
        };
        waiting.current = start;
        window.speechSynthesis.addEventListener("voiceschanged", start);
        timers.current.push(window.setTimeout(start, VOICE_WAIT_MS));
      };
      if (!clip) {
        viaEngine();
        return;
      }

      // The clip: words follow the playback position frame by frame (timeupdate comes only ~4 times a second).
      const el = (audio.current ??= new Audio());
      let frame = 0;
      let shown = -1;
      const tick = () => {
        const i = Math.min(wordAt(clip.words, el.currentTime * 1000), Math.max(words.length - 1, 0));
        if (i !== shown) {
          shown = i;
          opts.onWord?.(i);
        }
        frame = window.requestAnimationFrame(tick);
      };
      const onPlaying = () => {
        window.cancelAnimationFrame(frame);
        setSpeaking(true);
        tick();
      };
      const onPause = () => window.cancelAnimationFrame(frame);
      const onEnded = () => {
        halt();
        setSpeaking(false);
        opts.onWord?.(words.length);
        opts.onEnd?.();
      };
      const onFailed = () => fail(clipFailure(null));
      // Detaches this clip: stop() and a newer speak() call it, so its events can no longer fire.
      const halt = () => {
        endClip.current = null;
        window.cancelAnimationFrame(frame);
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onFailed);
        el.pause();
      };
      const fail = (to: ReturnType<typeof clipFailure>) => {
        if (to === "ignore" || my !== token.current || endClip.current !== halt) return;
        halt();
        setSpeaking(false);
        if (to === "engine") viaEngine();
        else {
          opts.onWord?.(words.length);
          opts.onError?.(to);
        }
      };
      el.addEventListener("playing", onPlaying);
      el.addEventListener("pause", onPause);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onFailed);
      endClip.current = halt;
      el.preload = "auto";
      el.src = clip.url;
      // Loading a source resets playbackRate to the default rate.
      el.defaultPlaybackRate = clampRate(rate);
      el.playbackRate = clampRate(rate);
      el.volume = clampVolume(volume);
      el.play().catch((e: unknown) => {
        fail(clipFailure(e instanceof DOMException ? e.name : ""));
      });
      // Warm the cache with the next line's clip, so the swap after this one starts at once (one element: no second Audio on iOS).
      const next = clips && nextClipUrl(clips, clean);
      if (next && !prefetched.current.has(next)) {
        prefetched.current.add(next);
        void fetch(next)
          .then((r) => r.blob())
          .catch(() => prefetched.current.delete(next));
      }
    },
    [supported, lang, stop, clips],
  );

  const pause = useCallback(() => {
    if (endClip.current) {
      audio.current?.pause();
      setPaused(true);
      return;
    }
    // Pausing an idle engine would leave it paused for the next utterance.
    if (!supported || !window.speechSynthesis.speaking) return;
    window.speechSynthesis.pause();
    timing.current?.hold();
    setPaused(true);
  }, [supported]);
  const resume = useCallback(() => {
    if (endClip.current) {
      audio.current?.play().catch(() => {});
      setPaused(false);
      return;
    }
    if (!supported) return;
    window.speechSynthesis.resume();
    timing.current?.go();
    setPaused(false);
  }, [supported]);

  /** `voice`: whether the hook's language has a voice here (its clips count); "missing" means speak() stays silent for it. */
  return { speak, stop, pause, resume, speaking, paused, supported: supported || hasClips, voice };
}
