"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Award, Captions as CaptionsIcon, Check, ChevronRight, Clock, Headphones, Home, Keyboard, ListTree, MessageCircleQuestion, MessageSquareWarning, Mic, MoreHorizontal, Pause, Play, RotateCcw, ScrollText, Volume2, VolumeX, X, Zap } from "lucide-react";
import type { Brand, Scene } from "@/lib/content/types";
import type { NarrationClips } from "@/lib/tts/clips";
import { wordsOf } from "@/lib/tts/text";
import { isSubtitleLanguage, type SubtitleLanguageOption } from "@/lib/content/subtitle-languages";
import { dirOf } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { useMotion } from "@/lib/motion";
import { Mascot } from "@/components/mascot/mascot";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented, Switch } from "@/components/ui/field";
import { Burst } from "@/components/ui/light";
import { toast } from "@/components/ui/toast";
import { ProblemForm } from "@/components/learner/problem-form";
import { BrandsProvider } from "./artifacts";
import { CaptionBar, CaptionsProvider, createLineStore, useCaptionMap, type Captions } from "./captions";
import { captionLangPref, captionsPref, isCharacterKey, leavesKeyAlone, letterShortcutsPref, shortcutOf, speedPref, syllabusPref, transcriptOf, usePref, volumePref, type Shortcut } from "./controls";
import { Drawer } from "./drawer";
import { FullscreenToggle, HeaderButton, ShortcutList, SpeedSelect, SubtitleSelect, Transcript, VolumeControl } from "./media-controls";
import { answerIdsOf, lessonStateKey, parseLesson, serializeLesson, type SavedLesson } from "./resume";
import { useNarrator } from "./narrator";
import { ContentLangProvider } from "./rich";
import { SyllabusAside, SyllabusContents, type SyllabusLesson } from "./syllabus";
import { TutorPanel } from "./tutor-panel";
import { VoiceNotice } from "./voice-notice";
import {
  ChoiceScene,
  HotspotScene,
  IntroScene,
  MatchScene,
  OrderScene,
  PasswordScene,
  RecapScene,
  ScenarioScene,
  SimulationScene,
  SwipeScene,
  TutorScene,
  type PlayerAnswer,
  type SceneEnv,
} from "./scenes";
import { attestModuleAction, completeLessonAction, reachSceneAction, startLessonAction, type LessonResult } from "@/server/actions/learning";
import { setPreferencesAction } from "@/server/actions/preferences";

export type PlayerProps = {
  /** The signed-in learner: the saved lesson position is kept per learner. */
  viewerId: string;
  slug: string;
  moduleTitle: string;
  topic: string;
  lesson: { id: string; key: string; title: string; minutes: number; scenes: Scene[] };
  /** The module's lessons, for the syllabus. */
  syllabus: SyllabusLesson[];
  /** Language the scenes are written in (may differ from the UI language); the narration voice follows it. */
  contentLocale: string;
  /** The lesson's other stored languages: subtitles in them come from the stored text. */
  captionLocales: string[];
  /** Languages the library does not ship, offered as AI-translated subtitles (empty without the ai_tutor feature). */
  moreLanguages: SubtitleLanguageOption[];
  /** Subtitles from a stored translation (a server action). */
  loadCaptions: (lessonId: string, locale: string) => Promise<Record<string, string> | null>;
  /** Pre-generated narration of this lesson in contentLocale (src/server/narration.ts), or null. */
  clips?: NarrationClips | null;
  completedBefore: boolean;
  next: { key: string; title: string } | null;
  brands: Record<string, Brand>;
  timeLimitSeconds: number | null;
  soundOn: boolean;
  motion: "full" | "calm" | "still";
  tutorEnabled: boolean;
  /** The tenant's "tutor_voice" feature: microphone input and spoken tutor answers (default on). */
  tutorVoice?: boolean;
  attestationText: string;
  /**
   * Offline use (the SCORM package, src/scorm): finishing the lesson hands its answers to this instead of
   * the server, and no server action runs (no attempt start, scene reports, preferences or problem reports).
   */
  onComplete?: (answers: PlayerAnswer[]) => LessonResult | Promise<LessonResult>;
};

/**
 * The lesson position and result live in this tab's sessionStorage (see resume.ts), read as an
 * external store so the server render and hydration agree on a fresh intro. Only this component
 * writes the entry, and it re-reads it on every render, so no change notifications are needed.
 */
const noSubscribe = () => () => {};
function readSaved(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSaved(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage full or unavailable: the lesson still works, it just cannot resume after a reload */
  }
}

/**
 * The done screen is tied to its history entry by "?done=1" (the result itself is in
 * sessionStorage), so reloading it shows the result again while opening the lesson anew shows
 * the intro. Native history calls keep the Next.js router in sync without a server round trip.
 */
function setDoneParam(on: boolean) {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set("done", "1");
  else url.searchParams.delete("done");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

type SpeakOpts = NonNullable<Parameters<SceneEnv["narrator"]["speak"]>[1]>;

export function LessonPlayer(p: PlayerProps) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const doneParam = useSearchParams().get("done") === "1";
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [index, setIndex] = useState(0);
  // The furthest scene reached: the syllabus and the arrow keys go back to any scene up to it, never past it.
  const [maxIndex, setMaxIndex] = useState(0);
  const [inner, setInner] = useState(0);
  // The in-scene position a resumed lesson reopens at; it applies to the first scene shown only.
  const [resumeInner, setResumeInner] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(p.soundOn);
  const speed = usePref(speedPref);
  const volume = usePref(volumePref);
  const captionsOn = usePref(captionsPref);
  const captionLang = usePref(captionLangPref);
  const syllabusOpen = usePref(syllabusPref);
  const letterShortcuts = usePref(letterShortcutsPref);
  const [motion, setMotion] = useState(p.motion);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [syllabusDrawer, setSyllabusDrawer] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);
  const answers = useRef<PlayerAnswer[]>([]);
  const started = useRef<number>(0);
  const narrator = useNarrator({ enabled: soundOn, rate: speed, lang: p.contentLocale, clips: p.clips, volume });
  // No voice for the lesson's language in this browser: as with the sound off, every text shows in
  // full and the learner moves on by hand; a notice says why and where natural voices exist.
  const voiceMissing = soundOn && narrator.voice === "missing";
  const offline = !!p.onComplete;

  // Subtitles: the narration's own words, a stored translation of the lesson, or an AI translation (with AI Sel on).
  const [lines] = useState(createLineStore);
  const wanted = captionLang && captionLang !== p.contentLocale ? captionLang : null;
  const storedCaption = !!wanted && p.captionLocales.includes(wanted);
  const subtitleLang = wanted && (storedCaption || (p.moreLanguages.length > 0 && isSubtitleLanguage(wanted))) ? wanted : null;
  const captionLoad = useCaptionMap(p.lesson.id, p.contentLocale, captionsOn || transcriptOpen || optionsOpen ? subtitleLang : null, storedCaption, p.loadCaptions);
  // Same-language subtitles only while a voice reads: silent, the scene already shows that very text.
  const captions: Captions = { store: lines, on: captionsOn && phase === "playing" && (!!subtitleLang || (soundOn && !voiceMissing)), lang: subtitleLang, map: captionLoad.map };

  const scenes = p.lesson.scenes;
  const scene = scenes[index];
  const sceneIds = useMemo(() => scenes.map((s) => s.id), [scenes]);
  const answerIds = useMemo(() => answerIdsOf(scenes), [scenes]);
  const transcript = useMemo(() => transcriptOf(scenes), [scenes]);
  const storageKey = lessonStateKey(p.viewerId, p.slug, p.lesson.key);
  const savedRaw = useSyncExternalStore(noSubscribe, () => readSaved(storageKey), () => null);
  const saved = useMemo(() => parseLesson(savedRaw, sceneIds, answerIds), [savedRaw, sceneIds, answerIds]);
  // A lesson left part-way offers to continue; one finished in this history entry shows its result.
  const resumable = phase === "intro" && saved?.kind === "playing" && (saved.index > 0 || saved.inner > 0 || saved.answers.length > 0) ? saved : null;
  const restoredDone = phase === "intro" && doneParam && saved?.kind === "done" ? saved : null;
  const finished = phase === "done" || !!restoredDone;
  const progress = finished ? 1 : phase === "intro" ? 0 : (index + Math.min(inner, 0.95)) / scenes.length;

  const save = (state: SavedLesson) => writeSaved(storageKey, serializeLesson(state, sceneIds));
  const savePosition = (at: number, within = 0, reach = Math.max(maxIndex, at)) =>
    save({ kind: "playing", index: at, maxIndex: reach, inner: within, answers: answers.current, elapsedMs: Date.now() - started.current });

  // Every line a scene reads goes through here: the subtitles and the transcript follow it, and the header's play button
  // reads it again until stop(), so a card or list shown after a stop is never read with the previous one's words.
  const lastCall = useRef<{ text: string; opts: SpeakOpts } | null>(null);
  const [replayable, setReplayable] = useState(false);
  const [heard, setHeard] = useState<ReadonlySet<string>>(() => new Set());
  const speak = (text: string, opts: SpeakOpts = {}) => {
    setHeard((h) => (h.has(text) ? h : new Set(h).add(text)));
    const words = wordsOf(text).length;
    // Interface strings stay silent too when the lesson's language has no voice here, like the lesson text.
    if (voiceMissing && opts.lang) {
      lines.set({ text, lang: opts.lang, word: words, words });
      opts.onWord?.(words);
      return;
    }
    lines.set({ text, lang: opts.lang ?? p.contentLocale, word: 0, words });
    lastCall.current = { text, opts };
    setReplayable(true);
    narrator.speak(text, {
      ...opts,
      onWord: (i) => {
        const line = lines.get();
        if (line?.text === text) lines.set({ ...line, word: i });
        opts.onWord?.(i);
      },
    });
  };
  const stop = () => {
    narrator.stop();
    lines.set(null);
    lastCall.current = null;
    setReplayable(false);
  };
  const canPlay = phase === "playing" && soundOn && !voiceMissing;
  // Nothing to pause or read again: the button stays (aria-disabled, so it keeps focus and the header keeps its width).
  const idle = !narrator.speaking && !replayable;
  const playing = narrator.speaking && !narrator.paused;
  const togglePlay = () => {
    if (narrator.paused) narrator.resume();
    else if (narrator.speaking) narrator.pause();
    else if (lastCall.current) speak(lastCall.current.text, lastCall.current.opts);
  };

  const begin = (from: Extract<SavedLesson, { kind: "playing" }> | null) => {
    const at = from?.index ?? 0;
    const reach = from?.maxIndex ?? at;
    answers.current = from ? [...from.answers] : [];
    started.current = Date.now() - (from?.elapsedMs ?? 0);
    setIndex(at);
    setMaxIndex(reach);
    setInner(from?.inner ?? 0);
    setResumeInner(from?.inner || null);
    setPhase("playing");
    savePosition(at, from?.inner ?? 0, reach);
    if (doneParam) setDoneParam(false);
    if (offline) return;
    // The attempt's start, then its furthest scene, are the server's: a resumed one tells it where it already was.
    void startLessonAction(p.slug, p.lesson.key).then(() => (reach > 0 ? reachSceneAction(p.slug, p.lesson.key, reach) : undefined));
  };

  /** Opens a scene: any one up to `reach`, the furthest reached (the next one only through the current scene's own end). */
  const goTo = (at: number, reach = maxIndex) => {
    if (at < 0 || at >= scenes.length || at > reach) return;
    stop();
    setInner(0);
    setResumeInner(null);
    setIndex(at);
    setMaxIndex(reach);
    savePosition(at, 0, reach);
    if (reach > maxIndex && !offline) void reachSceneAction(p.slug, p.lesson.key, reach);
  };
  const nextScene = () => {
    if (index + 1 < scenes.length) goTo(index + 1, Math.max(maxIndex, index + 1));
    else stop();
  };
  const previousScene = () => goTo(index - 1);

  const finish = async () => {
    setSaving(true);
    stop();
    try {
      let res: LessonResult;
      if (p.onComplete) res = await p.onComplete(answers.current);
      else {
        // The last scene is reported again first: a report lost on the way must not refuse an honest attempt.
        await reachSceneAction(p.slug, p.lesson.key, index);
        res = await completeLessonAction({ slug: p.slug, lessonKey: p.lesson.key, answers: answers.current.slice(0, 400) });
      }
      if (!res.ok) {
        // A refused attempt may have no start any more (used up by another tab, or opened before the
        // server kept starts): open one again, so that pressing Finish later can succeed. A valid start is kept.
        if (res.error && !offline) void startLessonAction(p.slug, p.lesson.key);
        toast(t(res.error ? "recap.unverified" : "recap.saveError"), "error");
        return;
      }
      // No router.refresh() here: every link on the done screen leads to a freshly rendered page,
      // and a refresh that fell back to a full reload would drop this screen (XP, attestation
      // prompt). The result is saved as well, so reloading this history entry shows it again.
      save({ kind: "done", result: res, token: null });
      if (!offline) setDoneParam(true);
      setResult(res);
      setPhase("done");
    } catch {
      // A rejected action (offline, server error) must not leave the recap stuck on "Saving".
      toast(t("recap.saveError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const env: SceneEnv = {
    narrator: { ...narrator, speak, stop },
    uiLocale: locale,
    soundOn: soundOn && !voiceMissing,
    still: motion === "still",
    topic: p.topic,
    timer: p.timeLimitSeconds,
    onAnswer: (a) => {
      // Going back and replaying a scene must not record the same answer twice.
      if (answers.current.some((x) => x.sceneId === a.sceneId && (x.itemId ?? null) === (a.itemId ?? null))) return;
      answers.current.push(a);
      savePosition(index, inner);
    },
    onDone: nextScene,
    onProgress: (fraction) => {
      setInner(fraction);
      savePosition(index, fraction);
    },
    resumeProgress: resumeInner ?? undefined,
  };

  const toggleSound = () => {
    const v = !soundOn;
    setSoundOn(v);
    if (!v) narrator.stop();
    if (!offline) void setPreferencesAction({ soundOn: v });
  };
  // Lesson text in another language than the interface (a missing translation) carries its own `lang`.
  const contentLang = p.contentLocale !== locale ? p.contentLocale : undefined;
  const toggleSyllabus = () => {
    if (window.matchMedia("(min-width: 64rem)").matches) syllabusPref.set(!syllabusOpen);
    else setSyllabusDrawer((o) => !o);
  };

  // Keyboard shortcuts for the whole page; keys typed into fields, sliders, menus and dialogs (the tutor) stay theirs.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    const s = shortcutOf(e, dirOf(locale) === "rtl");
    if (!s || leavesKeyAlone(e.target, s) || (!letterShortcuts && isCharacterKey(s))) return;
    const run: Record<Shortcut, (() => void) | null> = {
      toggle: canPlay && !idle && !e.repeat ? togglePlay : null,
      previous: phase === "playing" && index > 0 ? previousScene : null,
      next: phase === "playing" && index < maxIndex ? () => goTo(index + 1) : null,
      mute: e.repeat ? null : toggleSound,
      captions: e.repeat ? null : () => captionsPref.set(!captionsOn),
      transcript: () => setTranscriptOpen(true),
      syllabus: e.repeat ? null : toggleSyllabus,
      help: () => setShortcutsOpen(true),
    };
    const action = run[s];
    if (!action) return;
    e.preventDefault();
    action();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const syllabus = {
    slug: p.slug,
    moduleTitle: p.moduleTitle,
    lessons: p.syllabus,
    currentKey: p.lesson.key,
    scenes,
    contentLang,
    index,
    // A finished lesson has every part behind it.
    maxIndex: finished ? scenes.length - 1 : maxIndex,
    playing: phase === "playing",
    onJump: (i: number) => goTo(i),
  };
  // The transcript lists what was read: the parts behind the furthest one whole, that one as far as it was read
  // (a branching scenario's later messages stay hidden), a finished lesson whole.
  const reached = phase === "intro" && !finished ? [] : transcript.filter((l) => finished || l.scene < maxIndex || (l.scene === maxIndex && heard.has(l.text)));

  return (
    <BrandsProvider brands={p.brands}>
      <CaptionsProvider value={captions}>
        <div className="flex min-h-dvh flex-col bg-canvas">
          <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/90 pt-(--safe-top) backdrop-blur-xl">
            <div className="flex h-16 items-center gap-1 px-2 sm:gap-2 sm:px-4 lg:px-6">
              <Link href={`/learn/${p.slug}`} aria-label={t("leave")} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:size-11" onClick={() => narrator.stop()}>
                <X className="size-5" />
              </Link>
              <HeaderButton className="lg:hidden" onClick={() => setSyllabusDrawer(true)} aria-label={t("syllabus.open")} aria-haspopup="dialog" aria-expanded={syllabusDrawer}>
                <ListTree />
              </HeaderButton>
              <div role="progressbar" aria-label={t("progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mx-1 h-2.5 min-w-12 flex-1 rounded-pill bg-sunken sm:mx-2">
                <div
                  className={cn(
                    "relative h-full rounded-pill bg-brand-600 transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)",
                    // The leading edge glows while the lesson plays: a soft pulse in Full, resting light in Calm and Still.
                    phase === "playing" &&
                      progress > 0 &&
                      "after:absolute after:end-0 after:top-1/2 after:size-3 after:-translate-y-1/2 after:rounded-full after:bg-[color-mix(in_oklab,var(--brand-on)_70%,var(--brand))] after:opacity-60 after:shadow-[0_0_0.75rem_0.25rem_color-mix(in_oklab,var(--brand)_55%,transparent)] motion-full:after:animate-breathe print:after:hidden",
                  )}
                  style={{ width: `${Math.max(2, progress * 100)}%` }}
                />
              </div>
              {p.tutorEnabled && phase === "playing" ? (
                <button type="button" onClick={() => (stop(), setTutorOpen(true))} aria-label={t("askLabel")} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill bg-brand-50 px-3 text-caption font-bold text-brand-700 hover:bg-brand-100 sm:px-3.5">
                  {p.tutorVoice !== false ? <Mic className="size-4 text-brand-600" /> : <MessageCircleQuestion className="size-4 text-brand-600" />}
                  <span className="hidden sm:inline">{t("ask")}</span>
                </button>
              ) : null}
              {phase === "playing" ? (
                <div role="group" aria-label={t("narration")} className="flex shrink-0 items-center gap-0.5 rounded-pill bg-sunken/70 p-0.5">
                  {canPlay ? (
                    <HeaderButton onClick={togglePlay} aria-label={playing ? t("pause") : t("play")} aria-disabled={idle || undefined} className="aria-disabled:cursor-default aria-disabled:text-ink-subtle aria-disabled:hover:bg-transparent">
                      {playing ? <Pause /> : <Play />}
                    </HeaderButton>
                  ) : null}
                  <HeaderButton className="hidden sm:grid xl:hidden" onClick={toggleSound} aria-label={soundOn ? t("soundOff") : t("soundOn")}>
                    {soundOn ? <Volume2 /> : <VolumeX className="text-ink-subtle" />}
                  </HeaderButton>
                  <VolumeControl className="hidden w-40 pe-2 xl:flex" volume={volume} onVolume={volumePref.set} soundOn={soundOn} onToggleSound={toggleSound} />
                  <SpeedSelect className="hidden h-9 w-19 rounded-pill border-0 bg-transparent ps-3 pe-6 text-caption font-bold tabular-nums [--chevron-inset:0.5rem] hover:bg-sunken md:block" value={speed} onChange={speedPref.set} />
                  <HeaderButton onClick={() => captionsPref.set(!captionsOn)} aria-label={t("captions")} aria-pressed={captionsOn}>
                    <CaptionsIcon />
                  </HeaderButton>
                  <HeaderButton className="hidden sm:grid" onClick={() => setTranscriptOpen(true)} aria-label={t("transcript")} aria-haspopup="dialog">
                    <ScrollText />
                  </HeaderButton>
                  <FullscreenToggle className="hidden lg:grid" />
                </div>
              ) : null}
              <HeaderButton onClick={() => setOptionsOpen(true)} aria-label={t("more")} aria-haspopup="dialog">
                <MoreHorizontal />
              </HeaderButton>
            </div>
          </header>

          <div className="flex w-full flex-1">
            <SyllabusAside {...syllabus} open={syllabusOpen} onToggle={() => syllabusPref.set(!syllabusOpen)} />
            <main id="main" className="group/main protected mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col px-4 pt-6 sm:px-6 lg:pt-10">
              {phase === "intro" && !restoredDone ? (
                <div className="grid flex-1 place-items-center pb-16 text-center">
                  <div className="animate-reveal">
                    <Mascot mood="happy" gesture="wave" gestureKey="intro" className="mx-auto size-52 animate-float sm:size-64" topic={p.topic as never} still={motion === "still"} />
                    <h1 className="mt-4 text-display font-bold text-balance">{p.lesson.title}</h1>
                    <p className="mt-2 text-lead text-ink-muted">{p.moduleTitle}</p>
                    <div className="mt-4 flex justify-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 text-caption font-semibold ring-1 ring-line">
                        <Clock className="size-4" />
                        {tc("units.min", { count: p.lesson.minutes })}
                      </span>
                      {p.completedBefore ? (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-safe-50 px-3 py-1.5 text-caption font-semibold text-safe-700">
                          <Check className="size-4" />
                          {t("completed")}
                        </span>
                      ) : null}
                    </div>
                    {resumable ? (
                      <div className="mt-8 flex flex-col items-center gap-3">
                        <Button size="lg" className="min-w-56" onClick={() => begin(resumable)} iconRight={<ChevronRight />}>
                          {t("continue")}
                        </Button>
                        <p className="text-caption font-semibold text-ink-muted">{t("step", { current: resumable.index + 1, total: scenes.length })}</p>
                        <Button variant="secondary" onClick={() => begin(null)} icon={<RotateCcw />}>
                          {t("startOver")}
                        </Button>
                      </div>
                    ) : (
                      <Button size="lg" className="mt-8 min-w-56" onClick={() => begin(null)} icon={p.completedBefore ? <RotateCcw /> : undefined}>
                        {p.completedBefore ? t("review") : t("start")}
                      </Button>
                    )}
                    <VoiceNotice show={voiceMissing} lang={p.contentLocale} className="mx-auto mt-4 max-w-md justify-center text-start" />
                    {voiceMissing ? null : soundOn ? (
                      <p className="mx-auto mt-4 flex items-center justify-center gap-2 text-caption font-semibold text-ink-muted">
                        <Headphones className="size-4" />
                        {t("soundHint")}
                      </p>
                    ) : (
                      <button type="button" onClick={toggleSound} className="mx-auto mt-4 flex items-center gap-2 text-caption font-semibold text-ink-muted hover:text-ink">
                        <Headphones className="size-4" />
                        {t("soundHint")}
                      </button>
                    )}
                  </div>
                </div>
              ) : phase === "playing" ? (
                <ContentLangProvider value={contentLang}>
                  <VoiceNotice show={voiceMissing} lang={p.contentLocale} className="mb-4" />
                  <div key={scene.id} className="flex flex-1 animate-reveal flex-col">
                    {scene.type === "tutor" ? <TutorScene scene={scene} env={env} onBack={index > 0 && scenes[index - 1].type === "tutor" ? previousScene : undefined} /> : null}
                    {scene.type === "intro" ? <IntroScene scene={scene} env={env} /> : null}
                    {scene.type === "simulation" ? <SimulationScene scene={scene} env={env} /> : null}
                    {scene.type === "choice" ? <ChoiceScene scene={scene} env={env} /> : null}
                    {scene.type === "hotspot" ? <HotspotScene scene={scene} env={env} /> : null}
                    {scene.type === "swipe" ? <SwipeScene scene={scene} env={env} /> : null}
                    {scene.type === "match" ? <MatchScene scene={scene} env={env} /> : null}
                    {scene.type === "order" ? <OrderScene scene={scene} env={env} /> : null}
                    {scene.type === "scenario" ? <ScenarioScene scene={scene} env={env} /> : null}
                    {scene.type === "password" ? <PasswordScene scene={scene} env={env} /> : null}
                    {scene.type === "recap" ? <RecapScene scene={scene} env={env} saving={saving} onFinish={finish} /> : null}
                  </div>
                  {/* Scenes without a bottom row of their own: the subtitles sit at the bottom of the page. */}
                  <CaptionBar className="sticky bottom-[calc(var(--safe-bottom)+1rem)] z-30 mt-4 group-has-[[data-caption-slot]]/main:hidden" />
                </ContentLangProvider>
              ) : (
                <DoneScreen
                  p={p}
                  result={result ?? restoredDone?.result ?? null}
                  initialToken={restoredDone?.token ?? null}
                  still={motion === "still"}
                  onAttested={(token) => {
                    const r = result ?? restoredDone?.result;
                    if (r) save({ kind: "done", result: { ...r, moduleStatus: "completed" }, token });
                  }}
                />
              )}
            </main>
          </div>

          <Dialog open={optionsOpen} onClose={() => setOptionsOpen(false)} title={t("options")} size="sm">
            <div className="grid gap-6">
              <div className="grid gap-1.5">
                <p className="text-caption font-semibold text-ink-muted">{t("volume")}</p>
                <VolumeControl volume={volume} onVolume={volumePref.set} soundOn={soundOn} onToggleSound={toggleSound} />
              </div>
              <div className="grid gap-1.5">
                <SpeedSelect labelled value={speed} onChange={speedPref.set} />
              </div>
              <div className="grid gap-3">
                <Switch label={t("captions")} checked={captionsOn} onChange={(e) => captionsPref.set(e.target.checked)} />
                <SubtitleSelect value={subtitleLang ?? ""} onChange={captionLangPref.set} stored={p.captionLocales} more={p.moreLanguages} load={captionLoad} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<ScrollText />} onClick={() => (setOptionsOpen(false), setTranscriptOpen(true))}>
                  {t("transcript")}
                </Button>
                <Button variant="secondary" className="pointer-coarse:hidden" icon={<Keyboard />} onClick={() => (setOptionsOpen(false), setShortcutsOpen(true))}>
                  {t("shortcuts")}
                </Button>
              </div>
              <Switch label={t("letterShortcuts")} description={t("letterShortcutsHint")} checked={letterShortcuts} onChange={(e) => letterShortcutsPref.set(e.target.checked)} />
              <div>
                <p className="text-caption font-semibold text-ink-muted">{t("motion")}</p>
                <OptionsMotion
                  value={motion}
                  onChange={(m) => {
                    setMotion(m);
                    document.documentElement.dataset.motion = m;
                    if (!offline) void setPreferencesAction({ motion: m });
                  }}
                />
              </div>
            </div>
            {offline ? null : <ProblemSection context={`lesson:${p.slug}/${p.lesson.key}${scene ? `#${scene.id}` : ""}`} onSent={() => setOptionsOpen(false)} />}
          </Dialog>
          <Drawer side="start" open={syllabusDrawer} onClose={() => setSyllabusDrawer(false)} title={t("syllabus.title")}>
            <SyllabusContents {...syllabus} onNavigate={() => setSyllabusDrawer(false)} />
          </Drawer>
          <Drawer side="end" open={transcriptOpen} onClose={() => setTranscriptOpen(false)} title={t("transcript")}>
            <Transcript lines={reached} scenes={scenes} contentLocale={p.contentLocale} captions={captions} onReplay={soundOn && !voiceMissing ? (text) => speak(text) : undefined} />
          </Drawer>
          <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title={t("shortcuts")} size="sm">
            <ShortcutList />
          </Dialog>
          <TutorPanel
            open={tutorOpen}
            onClose={() => (setTutorOpen(false), stop())}
            slug={p.slug}
            lessonKey={p.lesson.key}
            sceneId={phase === "playing" ? scene.id : null}
            speak={(text, lang) => narrator.speak(text, { lang })}
            speaking={narrator.speaking}
            contentLocale={p.contentLocale}
            voice={p.tutorVoice !== false}
            soundOn={soundOn}
          />
        </div>
      </CaptionsProvider>
    </BrandsProvider>
  );
}

function OptionsMotion({ value, onChange }: { value: "full" | "calm" | "still"; onChange: (v: "full" | "calm" | "still") => void }) {
  const t = useTranslations("learner.profile");
  const tp = useTranslations("player");
  return (
    <Segmented
      name="motion"
      fullWidth
      ariaLabel={tp("motion")}
      className="mt-2"
      value={value}
      onChange={(v) => onChange(v as "full" | "calm" | "still")}
      options={[
        { value: "full", label: t("motionFull") },
        { value: "calm", label: t("motionCalm") },
        { value: "still", label: t("motionStill") },
      ]}
    />
  );
}

function ProblemSection({ context, onSent }: { context: string; onSent: () => void }) {
  const t = useTranslations("learner.problem");
  const tp = useTranslations("player");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="secondary" size="lg" className="mt-6 w-full" icon={<MessageSquareWarning />} onClick={() => setOpen(true)}>
        {tp("reportProblem")}
      </Button>
    );
  }
  return (
    <div className="mt-6 grid gap-3">
      <p className="text-body-sm font-semibold">{t("title")}</p>
      <p className="text-caption text-ink-muted">{t("description")}</p>
      <ProblemForm
        context={context}
        onSent={() => {
          setOpen(false);
          onSent();
        }}
      />
    </div>
  );
}

function DoneScreen({ p, result, initialToken, still, onAttested }: { p: PlayerProps; result: LessonResult | null; initialToken: string | null; still: boolean; onAttested: (token: string | null) => void }) {
  const t = useTranslations("player.done");
  const ta = useTranslations("learner.attest");
  const router = useRouter();
  // The XP celebration (particles, a chip rising from the pill) is Full motion only; Burst checks it itself.
  const full = useMotion() === "full";
  const [confirmed, setConfirmed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, start] = useTransition();
  const awaiting = result?.moduleStatus === "awaiting_attestation" && !confirmed;

  return (
    <div className="grid flex-1 place-items-center pb-16 text-center">
      <div className="w-full max-w-md animate-reveal">
        <Mascot mood="celebrate" gesture="cheer" gestureKey="done" className="mx-auto size-48" still={still} />
        <h1 className="mt-3 text-headline font-bold">{t("title")}</h1>
        <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-pill bg-reward-100 px-4 py-2 text-body font-bold text-reward-ink">
          {result?.xp ? (
            <>
              <Burst />
              {full ? (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-3 mx-auto w-fit animate-fly-up rounded-pill bg-reward-500 px-2.5 py-0.5 text-caption font-bold text-(--accent-on) [animation-delay:0.35s]">
                  {t("xp", { xp: result.xp })}
                </span>
              ) : null}
            </>
          ) : null}
          <Zap className="size-5 fill-reward-500 text-reward-600" />
          {result?.xp ? t("xp", { xp: result.xp }) : t("noXp")}
        </p>

        {awaiting ? (
          <div className="mt-6 rounded-2xl border border-reward-200 bg-surface p-5 text-start shadow-raised">
            <p className="flex items-center gap-2 text-body font-bold">
              <Award className="size-5 text-reward-600" />
              {t("confirm")}
            </p>
            <p className="mt-1 text-caption text-ink-muted">{p.moduleTitle}</p>
            <p className="mt-4 rounded-lg bg-sunken p-3.5 text-body-sm">{p.attestationText}</p>
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3">
              <input type="checkbox" className="size-5 accent-(--brand)" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span className="text-body-sm font-semibold">{ta("checkbox")}</span>
            </label>
            <Button
              className="mt-4 w-full"
              size="lg"
              variant="accent"
              disabled={!checked || pending}
              onClick={() =>
                start(async () => {
                  const res = await attestModuleAction(p.slug);
                  if (res.ok) {
                    setConfirmed(true);
                    setToken(res.token ?? null);
                    // Saved before the refresh below, so a reload keeps the certificate link.
                    onAttested(res.token ?? null);
                    toast(ta("done"));
                    router.refresh();
                  } else toast(ta("error"), "error");
                })
              }
            >
              {ta("submit")}
            </Button>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col items-center gap-3">
          {token ? (
            <ButtonLink href={`/c/${token}`} size="lg" variant="accent" icon={<Award />}>
              {t("certificate")}
            </ButtonLink>
          ) : null}
          {p.next && !awaiting ? (
            <ButtonLink href={`/learn/${p.slug}/${p.next.key}`} size="lg" iconRight={<ChevronRight />} className="min-w-56">
              {t("nextLessonTitle", { title: p.next.title })}
            </ButtonLink>
          ) : null}
          <div className="flex gap-3">
            <ButtonLink href={`/learn/${p.slug}`} variant="secondary">
              {t("backToModule")}
            </ButtonLink>
            <ButtonLink href="/app" variant="ghost" icon={<Home />}>
              {t("home")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
