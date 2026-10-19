"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Narration through the browser's speech engine (Web Speech API), with word timing for the
 * karaoke highlight. A pre-generated TTS provider can replace `speak` later without UI changes.
 * When the engine gives no word boundaries, timing is estimated from the speech rate.
 */
export type Voice = "tutor" | "man" | "man-2" | "man-3" | "woman" | "woman-2" | "young-woman" | "young-man" | "young-man-2" | "older-man" | "older-woman" | "child";

const FEMALE = /(female|woman|zira|aria|jenny|samantha|susan|hazel|libby|sonia|michelle|natasha|ava|emma|serena|karen|moira|tessa|google uk english female|google us english)/i;
const MALE = /(male|man|david|mark|guy|davis|christopher|eric|ryan|george|daniel|james|thomas|alex|fred|google uk english male)/i;

function pickVoice(voices: SpeechSynthesisVoice[], lang: string, voice: Voice): { v: SpeechSynthesisVoice | null; pitch: number; rateMul: number } {
  const forLang = voices.filter((x) => x.lang.toLowerCase().startsWith(lang));
  const pool = forLang.length ? forLang : voices;
  const quality = (x: SpeechSynthesisVoice) => (/(natural|neural|online|premium|enhanced)/i.test(x.name) ? 2 : 0) + (x.localService ? 0 : 1);
  const sorted = [...pool].sort((a, b) => quality(b) - quality(a));
  const female = sorted.filter((x) => FEMALE.test(x.name) && !/\bmale\b/i.test(x.name.replace(/female/i, "")));
  const male = sorted.filter((x) => MALE.test(x.name) && !FEMALE.test(x.name));
  const wantsMale = /man|male/.test(voice) && !/woman/.test(voice);
  const wantsFemale = /woman/.test(voice) || voice === "tutor";
  let v: SpeechSynthesisVoice | null = sorted[0] ?? null;
  if (wantsMale && male.length) v = male[voice.endsWith("-2") ? 1 % male.length : voice.endsWith("-3") ? 2 % male.length : 0];
  if (wantsFemale && female.length) v = female[voice.endsWith("-2") ? 1 % female.length : 0];
  const pitch = voice === "child" ? 1.45 : voice.startsWith("young") ? 1.12 : voice.startsWith("older") ? 0.82 : voice === "tutor" ? 1.05 : 1;
  return { v, pitch, rateMul: voice.startsWith("older") ? 0.92 : 1 };
}

/** BCP 47 tags for the utterance when no installed voice matches the content language. */
const LANG_TAG: Record<string, string> = { az: "az-AZ", en: "en-US", ru: "ru-RU" };

export function speechText(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function wordsOf(text: string): string[] {
  return speechText(text).split(/\s+/).filter(Boolean);
}

export function useNarrator({ enabled, rate, lang = "en" }: { enabled: boolean; rate: number; lang?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const timers = useRef<number[]>([]);
  const token = useRef(0);
  const voices = useRef<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => (voices.current = window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const stop = useCallback(() => {
    token.current++;
    clearTimers();
    if (supported) {
      // cancel() does not clear the engine's paused state, and a later speak() would sit silently in the paused queue.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  useEffect(() => stop, [stop]);

  /**
   * Speaks text. onWord(i) fires as each word starts; onEnd when finished.
   * With sound off nothing is spoken and onEnd is not called (the learner continues manually).
   */
  const speak = useCallback(
    (text: string, opts: { voice?: Voice; lang?: string; onWord?: (i: number) => void; onEnd?: () => void } = {}) => {
      stop();
      const my = ++token.current;
      const clean = speechText(text);
      const words = wordsOf(clean);
      if (!enabled || !supported || !clean) {
        opts.onWord?.(words.length);
        return;
      }
      const offsets: number[] = [];
      let pos = 0;
      for (const w of words) {
        const at = clean.indexOf(w, pos);
        offsets.push(at);
        pos = at + w.length;
      }
      const useLang = opts.lang ?? lang;
      const { v, pitch, rateMul } = pickVoice(voices.current, useLang, opts.voice ?? "tutor");
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = v?.lang ?? LANG_TAG[useLang] ?? useLang;
      if (v) u.voice = v;
      u.rate = Math.max(0.5, Math.min(2, rate * rateMul));
      u.pitch = pitch;
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
        // Estimated timing when the engine sends no word boundaries.
        const id = window.setTimeout(() => {
          if (gotBoundary || my !== token.current) return;
          const perWord = 60_000 / (165 * u.rate);
          words.forEach((_, i) => {
            if (i === 0) return;
            timers.current.push(window.setTimeout(() => my === token.current && opts.onWord?.(i), i * perWord - 600));
          });
        }, 600);
        timers.current.push(id);
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
        clearTimers();
        setSpeaking(false);
        opts.onWord?.(words.length);
      };
      window.speechSynthesis.speak(u);
    },
    [enabled, supported, rate, lang, stop],
  );

  const pause = useCallback(() => {
    // Pausing an idle engine would leave it paused for the next utterance.
    if (!supported || !window.speechSynthesis.speaking) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);
  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  return { speak, stop, pause, resume, speaking, paused, supported };
}
