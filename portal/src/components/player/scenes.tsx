"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  Inbox as InboxIcon,
  Mail,
  MessageCircle,
  Monitor,
  Pause,
  Phone,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  Volume2,
  X,
  XCircle,
  Globe,
} from "lucide-react";
import { plain, type Artifact, type Beat, type ChatArtifact, type EmailArtifact, type Outcome, type Scene, type ScenarioNode, type SimStep, type Visual } from "@/lib/content/types";
import { Mascot, angleBetween } from "@/components/mascot/mascot";
import type { MascotGesture, MascotMood } from "@/components/mascot/mapping";
import { ArtifactView, CallView, EmailListItem, SpeakingBars } from "./artifacts";
import { BrandAvatar } from "./brand-avatar";
import { ArtifactModeProvider, hasLink, lensTargets, cleanSpeech } from "./rich";
import { Illustration, Stat } from "./illustrations";
import { wordsOf, type Voice } from "./narrator";
import { checkPassword } from "@/lib/password-strength";
import { vibrate } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type PlayerAnswer = { sceneId: string; itemId?: string; correct: boolean; firstTry: boolean; outcome?: Outcome };

type Narrator = {
  speak: (text: string, opts?: { voice?: Voice; onWord?: (i: number) => void; onEnd?: () => void }) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  speaking: boolean;
  paused: boolean;
};

export type SceneEnv = {
  narrator: Narrator;
  soundOn: boolean;
  still: boolean;
  topic?: string;
  /** Seconds for timed questions, or null. */
  timer: number | null;
  onAnswer: (a: PlayerAnswer) => void;
  onDone: () => void;
  /** Lets the tutor scene drive the shared progress bar (0–1 inside the scene). */
  onProgress?: (fraction: number) => void;
};

const MOODS: Record<string, MascotMood> = { talk: "talk", think: "think", alert: "alert", happy: "happy", celebrate: "celebrate" };

/* ─────────────── shared pieces ─────────────── */

function Karaoke({ text, word, soundOn, className, variant = "title" }: { text: string; word: number; soundOn: boolean; className?: string; variant?: "title" | "body" }) {
  const words = useMemo(() => wordsOf(text), [text]);
  const body = variant === "body";
  return (
    <p className={cn(body ? "text-body" : "text-[clamp(1.35rem,1.05rem+1.1vw,2rem)] leading-snug font-bold tracking-tight text-balance", className)} aria-live="polite">
      {words.map((w, i) => (
        <span key={i}>
          <span
            className={cn(
              "transition-colors duration-(--duration-fast)",
              body
                ? !soundOn
                  ? "text-ink"
                  : i < word
                    ? "font-semibold text-ink"
                    : "text-ink-muted"
                : cn("rounded-[0.35rem] px-0.5", !soundOn || i < word ? "text-ink" : i === word ? "bg-brand-100 text-ink" : "text-ink-subtle"),
            )}
          >
            {w}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}

function VisualView({ visual, highlight }: { visual?: Visual; highlight?: string | null }) {
  if (!visual) return null;
  if (visual.kind === "illustration") return <Illustration id={visual.id} className="mx-auto" />;
  if (visual.kind === "stat") return <Stat value={visual.value} label={visual.label} />;
  return (
    <ArtifactModeProvider value={{ highlight }}>
      <ArtifactView artifact={visual.artifact} />
    </ArtifactModeProvider>
  );
}

type FeedbackProps = {
  tone: "safe" | "risk" | "warn";
  title: string;
  /** Explanation: spoken on mount and shown as karaoke. */
  text?: string;
  extra?: ReactNode;
  onContinue: () => void;
  continueLabel: string;
  env: SceneEnv;
  mascot?: boolean;
  /** Continue by itself once the explanation has been spoken (sound on only). */
  autoAdvance?: boolean;
};

/** The feedback content: mascot, verdict, spoken explanation and Continue with its auto-advance line. */
export function FeedbackCard({ tone, title, text, extra, onContinue, continueLabel, env, mascot = true, autoAdvance = true }: FeedbackProps) {
  const Icon = tone === "safe" ? CheckCircle2 : tone === "warn" ? AlertTriangle : XCircle;
  const titleId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const [word, setWord] = useState(0);
  const [ended, setEnded] = useState(false);
  const n = text ? wordsOf(text).length : 0;
  const auto = autoAdvance && n > 0 && env.soundOn;

  useEffect(() => {
    ref.current?.focus();
    if (text) env.narrator.speak(text, { onWord: setWord, onEnd: () => setEnded(true) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same pause as the tutor beats before moving on by itself.
  useEffect(() => {
    if (!ended || !auto) return;
    timer.current = window.setTimeout(onContinue, 700);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const proceed = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    onContinue();
  };

  return (
    <div role="alertdialog" aria-labelledby={titleId} className="@container">
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {mascot ? (
            <Mascot
              mood={tone === "safe" ? "happy" : "alert"}
              gesture={tone === "safe" ? "cheer" : undefined}
              fire={tone === "safe" ? undefined : { name: "huff", key: 0 }}
              talking={env.narrator.speaking}
              className="size-14 shrink-0 sm:size-16"
              still={env.still}
            />
          ) : null}
          <Icon className={cn("mt-0.5 size-7 shrink-0", tone === "safe" ? "text-safe-600" : tone === "warn" ? "text-warn-700" : "text-risk-600")} />
          <div className="min-w-0 flex-1">
            <p id={titleId} className={cn("text-title-sm font-bold", tone === "safe" ? "text-safe-600" : tone === "warn" ? "text-warn-700" : "text-risk-700")}>
              {title}
            </p>
            {text ? <Karaoke text={text} word={word} soundOn={env.soundOn} variant="body" className="mt-1" /> : null}
            {extra}
          </div>
        </div>
        <Button ref={ref} onClick={proceed} variant="ghost" size="lg" className="relative w-full bg-brand-50 text-ink-muted hover:bg-brand-100 @sm:w-auto @sm:self-end @lg:self-center">
          {continueLabel}
          {auto ? (
            <span
              aria-hidden
              className="absolute bottom-1 left-6 h-0.5 rounded-pill bg-brand-600 transition-[width] duration-(--duration-base)"
              style={{ width: `calc((100% - 3rem) * ${Math.round((100 * Math.min(word, n)) / n) / 100})` }}
            />
          ) : null}
        </Button>
      </div>
    </div>
  );
}

/** Feedback as a sheet rising from the bottom of the screen. */
export function FeedbackSheet(props: FeedbackProps) {
  const { tone } = props;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-rise pb-(--safe-bottom)">
      <div
        className={cn(
          "mx-auto max-w-3xl rounded-t-2xl border-t px-5 pt-5 pb-6 shadow-overlay sm:px-8",
          tone === "safe" ? "border-safe-100 bg-safe-50" : tone === "warn" ? "border-warn-100 bg-warn-50" : "border-risk-100 bg-risk-50",
        )}
      >
        <FeedbackCard {...props} />
      </div>
    </div>
  );
}

function useCountdown(seconds: number | null, active: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const [limit, setLimit] = useState(seconds);
  const fired = useRef(false);
  // A new limit restarts the countdown: the state is reset during render, the ref in its own effect.
  if (seconds !== limit) {
    setLimit(seconds);
    setLeft(seconds);
  }
  useEffect(() => {
    fired.current = false;
  }, [seconds]);
  useEffect(() => {
    if (seconds === null || !active) return;
    const id = window.setInterval(() => setLeft((l) => (l === null ? null : Math.max(0, l - 1))), 1000);
    return () => window.clearInterval(id);
  }, [seconds, active]);
  useEffect(() => {
    if (left === 0 && active && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [left, active, onExpire]);
  return left;
}

function TimerPill({ left, total }: { left: number | null; total: number | null }) {
  const t = useTranslations("player");
  if (left === null || total === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-caption font-bold tabular-nums", left <= 5 ? "bg-risk-50 text-risk-700" : "bg-sunken text-ink-muted")}>
      <Clock className="size-4" />
      {t("timeLeft", { seconds: left })}
    </span>
  );
}

/* ─────────────── tutor ─────────────── */

type ChoiceOption = { id: string; label: string; correct: boolean; feedback?: string };

/**
 * Numbered white pills (Cyclowareness question step): a radio group, or with `multi` a checkbox group whose
 * picked pills carry a check mark. Arrows move (and, for one answer, pick), wrapping at both ends.
 */
function ChoiceOptions({
  options,
  picked,
  checked,
  onPick,
  labelledBy,
  multi = false,
  className,
}: {
  options: ChoiceOption[];
  picked: ReadonlySet<string>;
  checked: boolean;
  onPick: (id: string) => void;
  labelledBy: string;
  multi?: boolean;
  className?: string;
}) {
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstPicked = options.findIndex((o) => picked.has(o.id));

  const onArrow = (e: KeyboardEvent<HTMLDivElement>) => {
    if (checked) return;
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const from = optRefs.current.indexOf(e.target as HTMLButtonElement);
    const k = ((from < 0 ? firstPicked : from) + d + options.length) % options.length;
    if (!multi) onPick(options[k].id);
    optRefs.current[k]?.focus();
  };

  return (
    <div role={multi ? "group" : "radiogroup"} aria-labelledby={labelledBy} onKeyDown={onArrow} className={cn("grid gap-3", className)}>
      {options.map((o, k) => {
        const on = picked.has(o.id);
        // After the check a right answer that was left out (multi) is outlined, not filled.
        const state = !checked ? (on ? "picked" : "idle") : o.correct ? (on || !multi ? "correct" : "missed") : on ? "wrong" : "dim";
        return (
          <button
            key={o.id}
            ref={(el) => {
              optRefs.current[k] = el;
            }}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            tabIndex={multi || on || (firstPicked < 0 && k === 0) ? 0 : -1}
            disabled={checked}
            onClick={() => onPick(o.id)}
            className={cn(
              "flex items-center gap-4 rounded-pill border-2 bg-surface px-4 py-3.5 text-left text-body-sm font-semibold transition-all",
              state === "idle" && "border-line hover:border-brand-300",
              state === "picked" && "border-brand-600 bg-brand-50",
              state === "correct" && "border-safe-500 bg-safe-50",
              state === "missed" && "border-dashed border-safe-500",
              state === "wrong" && "border-risk-500 bg-risk-50",
              state === "dim" && "border-line opacity-55",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-caption font-bold",
                state === "picked" ? "bg-brand-600 text-brand-on" : state === "correct" ? "bg-safe-500 text-white" : state === "missed" ? "bg-safe-100 text-safe-700" : state === "wrong" ? "bg-risk-500 text-white" : "bg-sunken text-ink-muted",
              )}
            >
              {state === "correct" || (state === "picked" && multi) ? <Check className="size-4" strokeWidth={3} /> : state === "wrong" ? <X className="size-4" strokeWidth={3} /> : k + 1}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Angle (0° right, 90° up) from the mascot's box to the element carrying `data-spot`, for the aim input; null when the spot is not on the page. */
function aimTowards(host: HTMLElement | null, mascot: HTMLElement | null, spot: string | undefined): number | null {
  if (!host || !mascot || !spot) return null;
  const target = host.querySelector<HTMLElement>(`[data-spot="${CSS.escape(spot)}"]`);
  return target ? angleBetween(mascot, target) : null;
}

export function TutorScene({ scene, env, onBack }: { scene: Extract<Scene, { type: "tutor" }>; env: SceneEnv; onBack?: () => void }) {
  const t = useTranslations("player");
  const [i, setI] = useState(0);
  const [word, setWord] = useState(0);
  const [ended, setEnded] = useState(false);
  // A beat with a checkpoint turns into a question step: asking → picked → checked (feedback sheet).
  const [asking, setAsking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const beat: Beat = scene.beats[i];
  const last = i === scene.beats.length - 1;
  const checkpoint = beat.checkpoint as { prompt: string; options: { id: string; label: string; correct: boolean; feedback: string }[] } | undefined;
  const questionId = `${beat.id}-q`;
  const pickedOpt = checkpoint?.options.find((o) => o.id === picked);
  const pickedSet = useMemo(() => new Set(picked ? [picked] : []), [picked]);
  // The mascot points at the highlighted spot; the angle is kept with its beat, so a new beat (or a spot that is gone) lowers the hand.
  const hostRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const [aim, setAim] = useState<{ beat: number; angle: number } | null>(null);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const angle = beat.highlight ? aimTowards(hostRef.current, mascotRef.current, beat.highlight) : null;
      setAim(angle === null ? null : { beat: i, angle });
    });
    return () => window.cancelAnimationFrame(id);
  }, [i, beat.highlight]);

  const narrate = () =>
    env.narrator.speak(beat.say, {
      onWord: setWord,
      onEnd: () => setEnded(true),
    });
  const play = () => {
    setEnded(false);
    setWord(0);
    narrate();
  };

  // Per-beat state is reset where the beat changes; the effect only reports progress and narrates.
  const goTo = (n: number) => {
    setI(n);
    setEnded(false);
    setWord(0);
    setAsking(false);
    setPicked(null);
    setChecked(false);
  };

  useEffect(() => {
    env.onProgress?.(i / scene.beats.length);
    narrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // The question is read aloud as soon as it shows.
  useEffect(() => {
    if (asking && checkpoint) env.narrator.speak(checkpoint.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asking]);

  const advance = () => {
    env.narrator.stop();
    if (last) env.onDone();
    else goTo(i + 1);
  };

  const ask = () => {
    env.narrator.stop();
    setAsking(true);
  };

  const unask = () => {
    setAsking(false);
    setPicked(null);
    play();
  };

  const check = () => {
    if (!pickedOpt || checked) return;
    setChecked(true);
    if (!pickedOpt.correct) vibrate();
    env.onAnswer({ sceneId: `${scene.id}:${beat.id}`, correct: pickedOpt.correct, firstTry: true });
  };

  // After the narration the beat moves on by itself: to its question, or to the next beat.
  useEffect(() => {
    if (!ended || !env.soundOn) return;
    if (checkpoint && asking) return;
    const id = window.setTimeout(checkpoint ? () => setAsking(true) : advance, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, asking]);

  const mood: MascotMood = env.narrator.speaking ? MOODS[beat.mood] ?? "talk" : beat.mood === "celebrate" ? "celebrate" : "idle";

  return (
    <div ref={hostRef} className="flex min-h-full flex-col">
      <div className="grid flex-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="relative order-2 mx-auto w-full max-w-lg lg:order-1">
          <div key={`${i}-visual`} className="animate-reveal">
            <VisualView visual={beat.visual} highlight={beat.highlight} />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <div className="flex items-center gap-4">
            {checked ? null : (
              <div ref={mascotRef} className="size-24 shrink-0 sm:size-28">
                <Mascot
                  mood={mood}
                  talking={env.narrator.speaking}
                  gesture={beat.gesture as MascotGesture | undefined}
                  gestureKey={i}
                  topic={env.topic as never}
                  className="size-full"
                  still={env.still}
                  aim={aim?.beat === i ? { angle: aim.angle } : null}
                />
              </div>
            )}
            <ol className="flex flex-wrap gap-1.5" aria-label={t("step", { current: i + 1, total: scene.beats.length })}>
              {scene.beats.map((b, k) => (
                <li key={b.id} className={cn("h-2 rounded-pill transition-all duration-(--duration-base)", k === i ? "w-7 bg-brand-600" : k < i ? "w-2 bg-brand-300" : "w-2 bg-line-strong")} />
              ))}
            </ol>
          </div>
          {asking && checkpoint ? (
            <div key={`${i}-question`} className="mt-5 animate-rise">
              <h2 id={questionId} className="text-title font-bold text-balance">
                {checkpoint.prompt}
              </h2>
              <ChoiceOptions className="mt-5" options={checkpoint.options} picked={pickedSet} checked={checked} onPick={setPicked} labelledBy={questionId} />
            </div>
          ) : (
            <div key={`${i}-text`} className="mt-5 animate-rise">
              <Karaoke text={beat.say} word={word} soundOn={env.soundOn} />
            </div>
          )}
        </div>
      </div>
      {checked && pickedOpt ? (
        <FeedbackSheet tone={pickedOpt.correct ? "safe" : "risk"} title={pickedOpt.correct ? t("wellDone") : t("notQuite")} text={pickedOpt.feedback} continueLabel={t("continue")} onContinue={advance} env={env} />
      ) : (
        <div className="sticky bottom-0 mt-8 flex items-center justify-center gap-2 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-6 pb-[calc(var(--safe-bottom)+1rem)]">
          {asking && checkpoint ? (
            <>
              <Button variant="secondary" size="icon" aria-label={t("previous")} onClick={unask}>
                <ChevronLeft />
              </Button>
              <Button variant="secondary" size="icon" aria-label={t("replay")} onClick={() => env.narrator.speak(checkpoint.prompt)}>
                <RotateCcw />
              </Button>
              <Button size="lg" className="min-w-40 max-w-md flex-1" disabled={!picked} onClick={check}>
                {t("check")}
              </Button>
            </>
          ) : (
            <>
              {i > 0 || onBack ? (
                <Button variant="secondary" size="icon" aria-label={t("previous")} onClick={() => (i > 0 ? goTo(i - 1) : onBack?.())}>
                  <ChevronLeft />
                </Button>
              ) : null}
              <Button variant="secondary" size="icon" aria-label={t("replay")} onClick={play}>
                <RotateCcw />
              </Button>
              {env.soundOn ? (
                <Button variant="secondary" size="icon" aria-label={env.narrator.paused ? t("play") : t("pause")} onClick={() => (env.narrator.paused ? env.narrator.resume() : env.narrator.pause())}>
                  {env.narrator.paused ? <Play /> : <Pause />}
                </Button>
              ) : null}
              {checkpoint ? (
                <Button size="lg" onClick={ask} className="min-w-40">
                  {t("answer")}
                </Button>
              ) : (
                <Button size="lg" onClick={advance} iconRight={<ChevronRight />} className="min-w-40">
                  {t("next")}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── intro ─────────────── */

export function IntroScene({ scene, env }: { scene: Extract<Scene, { type: "intro" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  useEffect(() => {
    env.narrator.speak(`${scene.title}. ${scene.body}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mx-auto grid max-w-3xl items-center gap-8 py-6 md:grid-cols-[1fr_1.2fr]">
      <VisualView visual={scene.visual} />
      <div>
        <h2 className="text-headline font-bold">{scene.title}</h2>
        <p className="mt-3 text-lead text-ink-muted">{scene.body}</p>
        <Button size="lg" className="mt-6" onClick={() => (env.narrator.stop(), env.onDone())} iconRight={<ChevronRight />}>
          {t("start")}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────── simulation ─────────────── */

const ENV_ICON = { inbox: Mail, phone: Smartphone, browser: Globe, desktop: Monitor, call: Phone } as const;
const ACTION_ICON: Record<string, typeof Mail> = { report: Flag, delete: Trash2, reply: Send, forward: Send, "hang-up": Phone, "click-link": Globe, archive: Archive };

function outcomeTone(o: Outcome): "safe" | "warn" | "risk" {
  return o === "safe" ? "safe" : o === "risky" ? "warn" : "risk";
}

const TONE_RING = { safe: "ring-2 ring-safe-500/50", warn: "ring-2 ring-warn-500/50", risk: "ring-2 ring-risk-500/50" } as const;

/** The Lens toggle: sends the magnifier to the next hidden detail of the artifact, then closes. */
function LensButton({ active, last, onClick }: { active: boolean; last: boolean; onClick: () => void }) {
  const t = useTranslations("player");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={!active ? t("lens") : last ? t("lensClose") : t("lensNext")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-caption font-bold shadow-raised ring-1",
        active ? "bg-brand-600 text-brand-on ring-brand-600" : "bg-surface text-ink ring-line",
      )}
    >
      <Search className="size-4" />
      {t("lens")}
    </button>
  );
}

export function SimulationScene({ scene, env }: { scene: Extract<Scene, { type: "simulation" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const inbox = scene.environment === "inbox";
  const [started, setStarted] = useState(false);
  const [introWord, setIntroWord] = useState(0);
  const [tipWord, setTipWord] = useState(0);
  // The mailbox opens on the list ("Select an email"); the other environments start on the first step.
  const [stepId, setStepId] = useState<string | null>(inbox ? null : scene.steps[0].id);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ outcome: Outcome; feedback: string; next?: string } | null>(null);
  const [lensIdx, setLensIdx] = useState<number | null>(null);
  const step = stepId ? (scene.steps.find((s) => s.id === stepId) ?? null) : null;
  const idx = step ? scene.steps.indexOf(step) : -1;
  const Icon = ENV_ICON[scene.environment];
  const targets = useMemo(() => (step ? lensTargets(step.artifact) : []), [step]);
  const callVoice = step ? ((step.artifact as { voice?: string }).voice as Voice | undefined) : undefined;

  // The lens and the tip karaoke are reset where the step changes; the effect only narrates the new step.
  const goTo = (id: string | null) => {
    setLensIdx(null);
    setTipWord(0);
    setStepId(id);
  };

  // The intro card is read aloud (karaoke) until the learner starts.
  useEffect(() => {
    env.narrator.speak(scene.intro, { onWord: setIntroWord });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The step's line is narrated, then any voice messages in a chat artifact, each in its own voice.
  useEffect(() => {
    if (!started || !step) return;
    const line = step.spoken ?? step.say;
    const voices = step.artifact.kind === "chat" ? ((step.artifact as ChatArtifact).messages ?? []).filter((m) => m.voice) : [];
    const speakVoices = (k: number) => {
      const m = voices[k];
      if (m) env.narrator.speak(m.spoken ?? plain(m.body), { voice: m.voice as Voice, onEnd: () => speakVoices(k + 1) });
    };
    if (line) env.narrator.speak(line, { voice: scene.environment === "call" && step.spoken ? (callVoice ?? "man") : "tutor", onWord: line === step.say ? setTipWord : undefined, onEnd: () => speakVoices(0) });
    else speakVoices(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, stepId]);

  const begin = () => {
    env.narrator.stop();
    setStarted(true);
  };

  const speakTip = () => {
    if (!step?.say) return;
    setTipWord(0);
    env.narrator.speak(step.say, { onWord: setTipWord });
  };

  const choose = (a: SimStep["actions"][number]) => {
    if (!step) return;
    env.narrator.stop();
    if (a.outcome !== "safe") vibrate();
    env.onAnswer({ sceneId: scene.id, itemId: step.id, correct: a.outcome === "safe", firstTry: true, outcome: a.outcome });
    setDone((d) => new Set(d).add(step.id));
    setResult({ outcome: a.outcome, feedback: a.feedback, next: a.next });
  };

  const proceed = () => {
    env.narrator.stop();
    const r = result;
    setResult(null);
    if (!inbox) {
      const next = r?.next ? scene.steps.find((s) => s.id === r.next) : scene.steps[idx + 1];
      if (next && !done.has(next.id)) goTo(next.id);
      else env.onDone();
      return;
    }
    const next = r?.next ? scene.steps.find((s) => s.id === r.next) : undefined;
    if (next && !done.has(next.id)) goTo(next.id);
    // Every email handled (only emails can be opened from the list): the scene is over.
    else if (!scene.steps.some((s) => !done.has(s.id) && s.artifact.kind === "email")) env.onDone();
    // Back to the list: the learner opens the remaining emails in any order.
    else goTo(null);
  };

  const backToList = () => {
    env.narrator.stop();
    goTo(null);
  };

  // A link or an attachment in the artifact is itself the "open it" action; its button is then left out.
  const linkAction = step?.actions.find((a) => a.kind === "click-link");
  const fileAction = step?.actions.find((a) => a.kind === "open-attachment");
  const clickableLink = !!linkAction && !!step && hasLink(step.artifact);
  const clickableFile = !!fileAction && step?.artifact.kind === "email" && !!(step.artifact as EmailArtifact).attachments?.length;
  const actions = step ? step.actions.filter((a) => !(clickableLink && a === linkAction) && !(clickableFile && a === fileAction)) : [];

  // The step label is the context line: announced here as it changes, shown by each environment in its own place.
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-3 text-title font-medium">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-brand-on">
          <Icon className="size-5" />
        </span>
        {scene.title}
      </p>
      <p className="sr-only" aria-live="polite">
        {started ? step?.label : null}
      </p>
      <div className="flex items-center gap-3">
        <ol className="flex items-center gap-1">
          {scene.steps.map((s, k) => (
            <li key={s.id} className={cn(k < done.size ? "size-2 rounded-full bg-safe-500" : k === done.size ? "h-2 w-5 rounded-pill bg-brand-600" : "size-2 rounded-full bg-line-strong")} />
          ))}
        </ol>
        <span className="text-caption font-bold text-ink-muted">{t(inbox ? "simulation.handledEmails" : "simulation.handled", { done: done.size, total: scene.steps.length })}</span>
      </div>
    </div>
  );

  const lens = lensIdx !== null ? targets[lensIdx] : null;
  // Browser and desktop show the label as the window's tab title; phone and inbox as a caption; the call under the screen.
  const tab = scene.environment === "browser" || scene.environment === "desktop";
  const contextLine =
    step?.label && scene.environment !== "call" ? (
      tab ? (
        <div aria-hidden className="flex w-fit max-w-full items-center gap-2 rounded-t-lg bg-surface px-4 py-2 text-caption font-semibold text-ink-muted shadow-xs">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{step.label}</span>
        </div>
      ) : (
        <p aria-hidden className="text-center text-caption font-semibold text-ink-muted">
          {step.label}
        </p>
      )
    ) : null;
  const artifactNode = step ? (
    <div className="relative">
      <ArtifactModeProvider value={{ lens, onLink: linkAction && clickableLink && !result ? () => choose(linkAction) : undefined, onAttachment: fileAction && clickableFile && !result ? () => choose(fileAction) : undefined }}>
        <ArtifactView artifact={step.artifact} onBack={inbox && !result ? backToList : undefined} inbox={inbox} />
      </ArtifactModeProvider>
      {targets.length ? (
        <div className="absolute right-4 bottom-4 z-20 flex items-end gap-2">
          {/* The mascot peers through its glass while the lens is out. */}
          {lens ? <Mascot mood="curious" guide={{ peer: true }} className="size-14 animate-reveal sm:size-16" still={env.still} /> : null}
          <LensButton active={lensIdx !== null} last={lensIdx === targets.length - 1} onClick={() => setLensIdx((x) => (x === null ? 0 : x + 1 >= targets.length ? null : x + 1))} />
        </div>
      ) : null}
    </div>
  ) : null;
  const feedback = result
    ? {
        tone: outcomeTone(result.outcome),
        title: result.outcome === "safe" ? t("goodMove") : result.outcome === "risky" ? t("risky") : t("compromised"),
        text: result.feedback,
        continueLabel: t("continue"),
        onContinue: proceed,
        env,
      }
    : null;

  const mailClient = inbox ? (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-surface shadow-raised transition-shadow duration-(--duration-base)", result && TONE_RING[outcomeTone(result.outcome)])}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-body-sm font-bold text-brand-600">
          <Mail className="size-5" />
          Mail
        </span>
        <span className="hidden flex-1 items-center gap-2 rounded-pill bg-sunken px-3 py-1.5 text-caption text-ink-disabled sm:flex">
          <Search className="size-4" />
          {t("simulation.searchMail")}
        </span>
        <span className="ml-auto grid size-8 place-items-center rounded-full bg-brand-600 text-tab font-bold text-brand-on">Y</span>
      </div>
      <div className="grid md:grid-cols-[9rem_16rem_minmax(0,1fr)]">
        <nav className="hidden border-r border-line p-2 text-caption md:block">
          {(["inbox", "sent", "drafts", "spam", "archive", "trash"] as const).map((f, k) => (
            <div key={f} className={cn("flex items-center justify-between rounded-md px-2.5 py-1.5", k === 0 ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-muted")}>
              <span className="flex items-center gap-2">
                {k === 0 ? <InboxIcon className="size-4" /> : <FileText className="size-4 opacity-60" />}
                {t(`simulation.${f}`)}
              </span>
              {k === 0 ? <span className="text-tab-sm">{scene.steps.length - done.size}</span> : null}
            </div>
          ))}
        </nav>
        <div className={cn("max-h-[28rem] overflow-y-auto border-r border-line", step && "hidden md:block")}>
          {scene.steps.map((s) =>
            s.artifact.kind === "email" ? (
              <EmailListItem key={s.id} a={s.artifact as EmailArtifact} active={s.id === stepId} done={done.has(s.id)} onClick={!result && !done.has(s.id) ? () => goTo(s.id) : undefined} />
            ) : null,
          )}
        </div>
        <div className={cn("flex min-w-0 flex-col", !step && "hidden md:flex")}>
          <div className="flex-1 p-3 sm:p-5">
            {contextLine ? <div className="mb-3">{contextLine}</div> : null}
            {artifactNode ?? (
              <div className="grid min-h-64 place-items-center text-center text-ink-muted">
                <div>
                  <Mail className="mx-auto size-10 text-ink-disabled" />
                  <p className="mt-2 text-body-sm">{t("simulation.selectEmail")}</p>
                </div>
              </div>
            )}
          </div>
          {step && actions.length ? (
            <div className="grid auto-cols-fr grid-flow-col border-t border-line bg-sunken/60">
              {actions.map((a) => {
                const AIcon = ACTION_ICON[a.kind];
                return (
                  <button key={a.id} type="button" disabled={!!result} onClick={() => choose(a)} className="flex flex-col items-center gap-1 py-3 text-caption font-semibold text-ink hover:bg-sunken">
                    {AIcon ? <AIcon className="size-5" /> : null}
                    {a.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {feedback ? (
        <div className="absolute inset-0 z-40 grid place-items-center p-4">
          <div className="w-full max-w-md animate-rise rounded-2xl bg-surface p-5 shadow-overlay">
            <FeedbackCard {...feedback} mascot={false} />
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  if (!started) {
    return (
      <div className="grid gap-4">
        {header}
        {inbox ? (
          <div className="relative">
            <div aria-hidden inert className="pointer-events-none opacity-60 blur-sm">
              {mailClient}
            </div>
            <div className="absolute inset-0 grid place-items-center p-4">
              <div className="max-w-sm animate-rise rounded-2xl bg-surface p-6 text-center shadow-overlay">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-600 text-brand-on">
                  <Icon className="size-6" />
                </span>
                <p className="mt-3 text-tab-sm font-bold text-brand-700">{t("simulation.mailbox")}</p>
                <h2 className="text-headline font-bold">{scene.title}</h2>
                <Karaoke text={scene.intro} word={introWord} soundOn={env.soundOn} variant="body" className="mt-2" />
                <Button size="lg" className="mt-5 min-w-40" onClick={begin}>
                  {t("simulation.begin")}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-xl place-items-center py-10 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
              <Icon className="size-8" />
            </span>
            <h2 className="mt-5 text-headline font-bold">{scene.title}</h2>
            <Karaoke text={scene.intro} word={introWord} soundOn={env.soundOn} variant="body" className="mt-3 text-lead" />
            <Button size="lg" className="mt-7" onClick={begin} iconRight={<ChevronRight />}>
              {t("simulation.begin")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {header}

      {step?.say && scene.environment !== "call" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-raised ring-1 ring-line">
          <button
            type="button"
            aria-label={t("replay")}
            onClick={speakTip}
            className={cn("grid size-10 shrink-0 place-items-center rounded-full", env.narrator.speaking ? "bg-brand-600 text-brand-on" : "bg-brand-50 text-brand-600")}
          >
            <Volume2 className="size-5" />
          </button>
          <Karaoke text={step.say} word={tipWord} soundOn={env.soundOn} variant="body" className="font-semibold" />
        </div>
      ) : null}

      {inbox ? (
        mailClient
      ) : tab ? (
        <div className={cn("rounded-2xl p-4 sm:p-8", scene.environment === "desktop" ? "bg-gradient-to-br from-brand-600 to-brand-900" : "bg-sunken")}>
          <div className="mx-auto max-w-2xl">
            {contextLine}
            {artifactNode}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 py-2">
          {contextLine}
          {artifactNode}
          {step?.label && scene.environment === "call" ? (
            <p aria-hidden className="text-center text-caption font-semibold text-ink-muted">
              {step.label}
            </p>
          ) : null}
        </div>
      )}

      {step?.say && scene.environment === "call" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-body-sm shadow-xs ring-1 ring-line">
            <MessageCircle className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <span className="italic">“{cleanSpeech(step.say)}”</span>
          </p>
        </div>
      ) : null}

      {step && !inbox ? (
        <div className="sticky bottom-0 flex flex-wrap justify-center gap-2.5 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-4 pb-[calc(var(--safe-bottom)+1rem)]">
          {actions.map((a) => {
            const AIcon = ACTION_ICON[a.kind];
            return (
              <Button key={a.id} variant={a.kind === "report" ? "danger-soft" : "secondary"} size="lg" onClick={() => choose(a)} disabled={!!result} icon={AIcon ? <AIcon /> : undefined}>
                {a.label}
              </Button>
            );
          })}
        </div>
      ) : null}

      {feedback && !inbox ? <FeedbackSheet {...feedback} /> : null}
    </div>
  );
}

/* ─────────────── choice ─────────────── */

/**
 * Question step: visual (when the content has one) on the left, the mascot reading the prompt, numbered
 * options and Check. More than one correct option (or `multi`) makes it a choose-all question, right only
 * when the picked set equals the correct set.
 */
export function ChoiceScene({ scene, env }: { scene: Extract<Scene, { type: "choice" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [checked, setChecked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const promptId = useId();
  const opts = scene.question.options;
  const correctIds = useMemo(() => new Set(opts.filter((o) => o.correct).map((o) => o.id)), [opts]);
  const multi = !!scene.multi || correctIds.size > 1;
  const spokenPrompt = multi ? `${scene.question.prompt} ${t("multiHint")}.` : scene.question.prompt;

  useEffect(() => {
    env.narrator.speak(spokenPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) =>
    setPicked((p) => {
      if (!multi) return new Set([id]);
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const isRight = (sel: ReadonlySet<string>) => sel.size === correctIds.size && [...sel].every((id) => correctIds.has(id));

  // The feedback card speaks the explanation.
  const check = (expired = false) => {
    if (checked) return;
    const ok = !expired && isRight(picked);
    setChecked(true);
    setTimedOut(expired);
    if (!ok) vibrate();
    env.onAnswer({ sceneId: scene.id, correct: ok, firstTry: true });
  };
  const left = useCountdown(env.timer, !checked, () => check(true));
  const ok = checked && !timedOut && isRight(picked);
  const missed = opts.filter((o) => o.correct && !picked.has(o.id));
  const extra = opts.filter((o) => !o.correct && picked.has(o.id));
  // Spoken: the picked options' own feedback when right; when wrong the missed and extra ones' (the picked one's for a single answer).
  const explained = timedOut ? [] : ok ? opts.filter((o) => picked.has(o.id)) : multi ? [...missed, ...extra] : extra;
  const feedbackText = [...explained.map((o) => o.feedback), scene.explain].filter(Boolean).join(" ");
  const labels = (list: typeof opts) => list.map((o) => o.label).join(", ");

  const question = (
    <div>
      <div className="flex items-center justify-between gap-4">
        {checked ? <span /> : <Mascot mood={env.narrator.speaking ? "talk" : "idle"} talking={env.narrator.speaking} topic={env.topic as never} className="size-24 shrink-0 sm:size-28" still={env.still} />}
        <TimerPill left={left} total={env.timer} />
      </div>
      <h2 id={promptId} className="mt-5 text-title font-bold text-balance">
        {scene.question.prompt}
      </h2>
      {multi ? <p className="mt-1.5 text-caption font-semibold text-ink-muted">{t("multiHint")}</p> : null}
      <ChoiceOptions className="mt-5" options={opts} picked={picked} checked={checked} onPick={pick} labelledBy={promptId} multi={multi} />
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      {scene.visual ? (
        <div className="grid flex-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="order-2 mx-auto w-full max-w-lg animate-reveal lg:order-1">
            <VisualView visual={scene.visual} />
          </div>
          <div className="order-1 lg:order-2">{question}</div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl py-4">{question}</div>
      )}
      {!checked ? (
        <div className="sticky bottom-0 mt-8 flex items-center justify-center gap-2 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-6 pb-[calc(var(--safe-bottom)+1rem)]">
          <Button variant="secondary" size="icon" aria-label={t("replay")} onClick={() => env.narrator.speak(spokenPrompt)}>
            <RotateCcw />
          </Button>
          <Button size="lg" className="min-w-40 max-w-md flex-1" disabled={picked.size === 0} onClick={() => check()}>
            {t("check")}
          </Button>
        </div>
      ) : (
        <FeedbackSheet
          tone={ok ? "safe" : "risk"}
          title={timedOut ? t("timeUp") : ok ? t("wellDone") : t("notQuite")}
          text={feedbackText || undefined}
          extra={
            ok ? null : multi ? (
              <div className="mt-1 grid gap-0.5 text-body-sm font-semibold">
                {missed.length ? <p>{t("multiMissed", { answer: labels(missed) })}</p> : null}
                {extra.length ? <p>{t("multiExtra", { answer: labels(extra) })}</p> : null}
              </div>
            ) : (
              <p className="mt-1 text-body-sm font-semibold">{t("correctAnswer", { answer: labels(opts.filter((o) => o.correct)) })}</p>
            )
          }
          continueLabel={t("continue")}
          onContinue={() => (env.narrator.stop(), env.onDone())}
          env={env}
        />
      )}
    </div>
  );
}

/* ─────────────── hotspot ─────────────── */

export function HotspotScene({ scene, env }: { scene: Extract<Scene, { type: "hotspot" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const [found, setFound] = useState<Set<string>>(new Set());
  const [miss, setMiss] = useState(0);
  const [lastSpot, setLastSpot] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const valid = useMemo(() => new Set(scene.spots.map((s) => s.id)), [scene]);
  const need = Math.min(scene.minToFind, scene.spots.length);

  useEffect(() => {
    env.narrator.speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSpot = (id: string) => {
    if (finished) return;
    if (!valid.has(id)) {
      setMiss((m) => m + 1);
      return;
    }
    if (found.has(id)) return;
    const next = new Set(found).add(id);
    setFound(next);
    setLastSpot(id);
    const spot = scene.spots.find((s) => s.id === id)!;
    // The last find opens the feedback, which speaks its own text.
    if (next.size < need) env.narrator.speak(spot.explain);
    if (next.size >= need) {
      setFinished(true);
      env.onAnswer({ sceneId: scene.id, correct: miss === 0, firstTry: true });
    }
  };
  const last = scene.spots.find((s) => s.id === lastSpot);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 py-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div onClick={() => !finished && setMiss((m) => m + 1)}>
        <ArtifactModeProvider value={{ hotspot: { found, onSpot, validSpots: valid } }}>
          <ArtifactView artifact={scene.artifact} />
        </ArtifactModeProvider>
      </div>
      <div>
        <h2 className="text-title font-bold text-balance">{scene.prompt}</h2>
        <p className="mt-2 text-caption text-ink-muted">{t("hotspot.tap")}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: need }).map((_, k) => (
              <span key={k} className={cn("size-3 rounded-full", k < found.size ? "bg-risk-500" : "bg-line-strong")} />
            ))}
          </div>
          <span className="text-caption font-semibold">{t("hotspot.found", { found: Math.min(found.size, need), need })}</span>
        </div>
        {last && !finished ? (
          <div className="mt-4 animate-rise rounded-lg border border-risk-100 bg-risk-50 p-3.5">
            <p className="text-body-sm font-semibold text-risk-700">{last.label}</p>
            <p className="mt-0.5 text-caption text-ink">{last.explain}</p>
          </div>
        ) : null}
      </div>
      {finished ? (
        <FeedbackSheet
          tone="safe"
          title={t("wellDone")}
          text={t("hotspot.done")}
          extra={
            <ul className="mt-2 grid gap-1.5">
              {scene.spots.map((s) => (
                <li key={s.id} className="text-body-sm">
                  <b>{s.label}.</b> {s.explain}
                </li>
              ))}
            </ul>
          }
          continueLabel={t("continue")}
          onContinue={() => (env.narrator.stop(), env.onDone())}
          env={env}
          autoAdvance={false}
        />
      ) : null}
    </div>
  );
}

/* ─────────────── swipe ─────────────── */

export function SwipeScene({ scene, env }: { scene: Extract<Scene, { type: "swipe" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<"threat" | "safe" | null>(null);
  const [drag, setDrag] = useState(0);
  const [startX, setStartX] = useState<number | null>(null);
  const card = scene.cards[i];

  useEffect(() => {
    if (i === 0) env.narrator.speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = (v: "threat" | "safe") => {
    if (answer) return;
    setAnswer(v);
    setDrag(0);
    if (v !== card.verdict) vibrate();
    env.onAnswer({ sceneId: scene.id, itemId: card.id, correct: v === card.verdict, firstTry: true });
  };
  const next = () => {
    env.narrator.stop();
    setAnswer(null);
    if (i + 1 < scene.cards.length) setI(i + 1);
    else env.onDone();
  };
  const ok = answer === card.verdict;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-5 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title font-bold">{scene.prompt}</h2>
        <span className="shrink-0 text-caption text-ink-muted">{t("swipe.left", { count: scene.cards.length - i })}</span>
      </div>
      <div className="relative">
        {scene.cards[i + 1] ? <div aria-hidden className="absolute inset-x-6 -bottom-3 h-full rounded-xl bg-surface/70 shadow-xs ring-1 ring-line" /> : null}
        <div
          key={card.id}
          className="relative animate-rise touch-pan-y select-none"
          style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)`, transition: startX === null ? "transform .25s var(--ease-out-expo)" : "none" }}
          onPointerDown={(e) => {
            if (answer) return;
            setStartX(e.clientX);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => startX !== null && setDrag(e.clientX - startX)}
          onPointerUp={() => {
            const d = drag;
            setStartX(null);
            if (d < -90) decide("threat");
            else if (d > 90) decide("safe");
            else setDrag(0);
          }}
        >
          <ArtifactView artifact={card.artifact as Artifact} />
          {drag !== 0 ? (
            <span className={cn("absolute top-4 rounded-pill px-3 py-1 text-caption font-bold text-white", drag < 0 ? "left-4 bg-risk-600" : "right-4 bg-safe-600")}>
              {drag < 0 ? t("swipe.threat") : t("swipe.safe")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex justify-center gap-3">
        <Button variant="danger-soft" size="lg" onClick={() => decide("threat")} disabled={!!answer} icon={<ShieldAlert />}>
          {t("swipe.threat")}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => decide("safe")} disabled={!!answer} icon={<CheckCircle2 />}>
          {t("swipe.safe")}
        </Button>
      </div>
      {answer ? (
        <FeedbackSheet
          tone={ok ? "safe" : "risk"}
          title={ok ? t("wellDone") : t("notQuite")}
          text={`${card.verdict === "threat" ? t("swipe.itsThreat") : t("swipe.itsSafe")}. ${card.explain}`}
          continueLabel={t("continue")}
          onContinue={next}
          env={env}
        />
      ) : null}
    </div>
  );
}

/* ─────────────── match ─────────────── */

function shuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function MatchScene({ scene, env }: { scene: Extract<Scene, { type: "match" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const rights = useMemo(() => shuffle(scene.pairs, scene.id), [scene]);
  const [left, setLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const complete = matched.size === scene.pairs.length;

  useEffect(() => {
    env.narrator.speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (complete) {
      env.onAnswer({ sceneId: scene.id, correct: mistakes === 0, firstTry: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  const pickRight = (id: string) => {
    if (!left || matched.has(id)) return;
    if (left === id) {
      setMatched(new Set(matched).add(id));
      setLeft(null);
    } else {
      setMistakes((m) => m + 1);
      setWrong(id);
      vibrate();
      window.setTimeout(() => setWrong(null), 600);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl py-2">
      <h2 className="text-title font-bold text-balance">{scene.prompt}</h2>
      <p className="mt-1.5 text-caption text-ink-muted">
        {t("match.pick")} · {t("match.matched", { count: matched.size, total: scene.pairs.length })}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6">
        <div className="grid content-start gap-2.5">
          {scene.pairs.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={matched.has(p.id)}
              onClick={() => setLeft(p.id)}
              aria-pressed={left === p.id}
              className={cn(
                "rounded-lg border-2 bg-surface px-3.5 py-3 text-left text-caption font-semibold transition-colors sm:text-body-sm",
                matched.has(p.id) ? "border-safe-500 bg-safe-50 text-safe-700" : left === p.id ? "border-brand-600 bg-brand-50" : "border-line hover:border-brand-300",
              )}
            >
              {p.left}
            </button>
          ))}
        </div>
        <div className="grid content-start gap-2.5">
          {rights.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={matched.has(p.id) || !left}
              onClick={() => pickRight(p.id)}
              className={cn(
                "rounded-lg border-2 bg-surface px-3.5 py-3 text-left text-caption transition-colors sm:text-body-sm",
                matched.has(p.id) ? "border-safe-500 bg-safe-50 text-safe-700" : wrong === p.id ? "animate-pulse border-risk-500 bg-risk-50" : "border-line enabled:hover:border-brand-300 disabled:opacity-80",
              )}
            >
              {p.right}
            </button>
          ))}
        </div>
      </div>
      {complete ? (
        <FeedbackSheet tone={mistakes === 0 ? "safe" : "warn"} title={t("wellDone")} text={scene.explain} continueLabel={t("continue")} onContinue={() => (env.narrator.stop(), env.onDone())} env={env} />
      ) : null}
    </div>
  );
}

/* ─────────────── order ─────────────── */

export function OrderScene({ scene, env }: { scene: Extract<Scene, { type: "order" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const initial = useMemo(() => {
    let s = shuffle(scene.items, scene.id);
    if (s.every((x, i) => x.id === scene.items[i].id)) s = [...s.slice(1), s[0]];
    return s;
  }, [scene]);
  const [items, setItems] = useState(initial);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<"ok" | "wrong" | null>(null);
  const [checkedOnce, setCheckedOnce] = useState(false);

  useEffect(() => {
    env.narrator.speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setResult(null);
  };
  const check = () => {
    const ok = items.every((x, i) => x.id === scene.items[i].id);
    if (!ok) vibrate();
    if (!checkedOnce) env.onAnswer({ sceneId: scene.id, correct: ok, firstTry: true });
    setCheckedOnce(true);
    setAttempts((a) => a + 1);
    setResult(ok ? "ok" : "wrong");
  };

  return (
    <div className="mx-auto w-full max-w-2xl py-2">
      <h2 className="text-title font-bold text-balance">{scene.prompt}</h2>
      <p className="mt-1.5 text-caption text-ink-muted">{t("order.hint")}</p>
      <ol className="mt-6 grid gap-2.5">
        {items.map((x, i) => {
          const wrongHere = result === "wrong" && x.id !== scene.items[i].id;
          return (
            <li key={x.id} className={cn("flex items-center gap-3 rounded-lg border-2 bg-surface px-3 py-2.5 transition-colors", wrongHere ? "border-warn-500 bg-warn-50" : result === "ok" ? "border-safe-500 bg-safe-50" : "border-line")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-caption font-bold text-ink-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-body-sm font-semibold">{x.label}</span>
              <span className="flex shrink-0 gap-1">
                <button type="button" aria-label={t("order.up")} onClick={() => move(i, -1)} disabled={i === 0 || result === "ok"} className="grid size-9 place-items-center rounded-full hover:bg-sunken disabled:opacity-30">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label={t("order.down")} onClick={() => move(i, 1)} disabled={i === items.length - 1 || result === "ok"} className="grid size-9 place-items-center rounded-full hover:bg-sunken disabled:opacity-30">
                  <ArrowDown className="size-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      {result === "wrong" ? <p className="mt-3 text-caption font-semibold text-warn-700">{t("order.wrong")}</p> : null}
      {result !== "ok" ? (
        <div className="mt-6 flex justify-center">
          <Button size="lg" className="min-w-48" onClick={check}>
            {t("check")}
          </Button>
        </div>
      ) : (
        <FeedbackSheet tone={attempts === 1 ? "safe" : "warn"} title={t("wellDone")} text={scene.explain} continueLabel={t("continue")} onContinue={() => (env.narrator.stop(), env.onDone())} env={env} />
      )}
    </div>
  );
}

/* ─────────────── scenario ─────────────── */

export function ScenarioScene({ scene, env }: { scene: Extract<Scene, { type: "scenario" }>; env: SceneEnv }) {
  const t = useTranslations("player");
  const nodes = useMemo(() => new Map(scene.nodes.map((n) => [n.id, n])), [scene]);
  const [history, setHistory] = useState<{ node: ScenarioNode; choice?: string }[]>([{ node: nodes.get(scene.start)! }]);
  const [ending, setEnding] = useState<{ outcome: Outcome; feedback: string } | null>(null);
  const [pending, setPending] = useState<{ feedback: string; next?: string; outcome?: Outcome } | null>(null);
  const current = history[history.length - 1].node;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    env.narrator.speak(current.spoken ?? current.text, { voice: (current.voice as Voice | undefined) ?? "man" });
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const choose = (c: NonNullable<ScenarioNode["choices"]>[number]) => {
    env.narrator.stop();
    const outcome: Outcome = c.outcome ?? "safe";
    if (outcome !== "safe") vibrate();
    env.onAnswer({ sceneId: scene.id, itemId: current.id, correct: outcome === "safe", firstTry: true, outcome: c.outcome ?? undefined });
    setHistory((h) => [...h.slice(0, -1), { node: current, choice: c.label }]);
    setPending({ feedback: c.feedback, next: c.next, outcome: c.outcome });
  };
  const proceed = () => {
    if (!pending) return;
    env.narrator.stop();
    const next = pending.next ? nodes.get(pending.next) : undefined;
    if (next) {
      setHistory((h) => [...h, { node: next }]);
      setPending(null);
    } else {
      setEnding({ outcome: pending.outcome ?? "safe", feedback: pending.feedback });
      setPending(null);
    }
  };

  // The current node is staged by its channel: a call screen, a chat thread, or a speaker card; the choices follow.
  const channel = current.channel;
  const ChannelIcon = channel === "phone" ? Phone : channel === "video" ? Video : channel === "in-person" ? UserRound : channel === "message" ? MessageCircle : Sparkles;
  const name = current.speaker ?? (current.character ? current.character.charAt(0).toUpperCase() + current.character.slice(1) : undefined);
  const talking = env.narrator.speaking && !pending && !ending;
  const thread: ChatArtifact = {
    kind: "chat",
    contact: name,
    messages: history.flatMap((h) => [{ from: "them" as const, body: h.node.text }, ...(h.choice ? [{ from: "me" as const, body: h.choice }] : [])]),
  };
  const stage =
    channel === "phone" ? (
      <CallView a={{ kind: "call", caller: name }} status={t("scenario.onLine")} talking={talking} />
    ) : channel === "message" ? (
      <ArtifactView artifact={thread} />
    ) : channel === "in-person" || channel === "video" ? (
      <SpeakerCard name={name} video={channel === "video"} talking={talking} />
    ) : null;

  return (
    <div className={cn("mx-auto grid w-full gap-4 py-2", stage ? "max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-8" : "max-w-2xl")}>
      <h2 className="flex items-center gap-2 text-title font-bold lg:col-span-full">
        <ChannelIcon className="size-6 text-brand-600" />
        {scene.title}
      </h2>
      {stage ? (
        <div key={channel} className="animate-reveal lg:sticky lg:top-24 lg:self-start">
          {stage}
          {talking && name ? (
            <p role="status" className="sr-only">
              {t("scenario.speaking", { name })}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid content-start gap-4">
        {channel === "message" ? (
          <div ref={endRef} />
        ) : (
          <div className="grid gap-3">
            {history.map((h, k) => (
              <div key={k} className="grid gap-2">
                <div className="max-w-[90%] animate-rise rounded-2xl rounded-tl-sm bg-surface px-4 py-3 shadow-xs ring-1 ring-line">
                  {h.node.speaker ? <p className="text-tab font-semibold text-brand-700">{h.node.speaker}</p> : null}
                  <p className="mt-0.5 text-body-sm">{h.node.text}</p>
                </div>
                {h.choice ? (
                  <div className="ml-auto max-w-[85%] animate-rise rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-3 text-body-sm text-brand-on">
                    <p className="text-tab font-semibold opacity-80">{t("scenario.you")}</p>
                    {h.choice}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
        {!pending && !ending && current.choices?.length ? (
          <div className="grid gap-2">
            {current.choices.map((c, k) => (
              <button key={k} type="button" onClick={() => choose(c)} className="rounded-xl border-2 border-line bg-surface px-4 py-3 text-left text-body-sm font-semibold transition-colors hover:border-brand-400">
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
      {pending ? (
        <FeedbackSheet
          tone={pending.outcome ? outcomeTone(pending.outcome) : "safe"}
          title={!pending.outcome || pending.outcome === "safe" ? t("goodMove") : pending.outcome === "risky" ? t("risky") : t("compromised")}
          text={pending.feedback}
          continueLabel={t("continue")}
          onContinue={proceed}
          env={env}
        />
      ) : null}
        {ending ? (
          <div className="rounded-xl bg-sunken p-4 text-center">
            <p className="text-body-sm text-ink-muted">{t("scenario.ended")}</p>
            <Button className="mt-3" onClick={() => (env.narrator.stop(), env.onDone())} iconRight={<ChevronRight />}>
              {t("continue")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Who is talking in person or on video: avatar with a ring and voice bars while the line is narrated. */
function SpeakerCard({ name, video, talking }: { name?: string; video: boolean; talking: boolean }) {
  const t = useTranslations("player");
  return (
    <div className={cn("mx-auto flex w-full max-w-sm items-center gap-4 rounded-2xl p-4 shadow-raised ring-1", video ? "bg-ink text-white ring-ink" : "bg-surface ring-line")}>
      <span className="relative shrink-0">
        <BrandAvatar name={name} size="lg" className={cn("size-16 text-title transition-shadow duration-(--duration-base)", talking && "ring-4 ring-safe-500/60")} />
        {video ? (
          <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-risk-500 text-white">
            <Video className="size-3.5" />
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold">{name}</p>
        <p className={cn("text-caption", video ? "text-white/70" : "text-ink-muted")}>{video ? t("scenario.videoCall") : t("scenario.inPerson")}</p>
        <SpeakingBars active={talking} className={cn("mt-1.5", video ? "text-safe-500" : "text-brand-600")} />
      </div>
    </div>
  );
}

/* ─────────────── password ─────────────── */

export function PasswordScene({ scene, env }: { scene: Extract<Scene, { type: "password" }>; env: SceneEnv }) {
  const t = useTranslations("player.password");
  const tp = useTranslations("player");
  const [value, setValue] = useState("");
  const [score, setScore] = useState(0);
  const [reached, setReached] = useState(false);
  const levels = t.raw("levels") as string[];

  useEffect(() => {
    env.narrator.speak(scene.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Scored where the input changes; reaching the target the first time counts as the answer.
  const onChange = (v: string) => {
    const s = v ? checkPassword(v).score : 0;
    setValue(v);
    setScore(s);
    if (!reached && v && s >= scene.targetScore) {
      setReached(true);
      env.onAnswer({ sceneId: scene.id, correct: true, firstTry: true });
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl py-2">
      <h2 className="text-title font-bold text-balance">{scene.prompt}</h2>
      <label className="mt-6 block text-caption font-semibold" htmlFor="pw-scene">
        {t("label")}
      </label>
      <input
        id="pw-scene"
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        className="mt-1.5 h-13 w-full rounded-md border border-line-strong bg-surface px-4 font-mono text-body focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
      <p className="mt-1.5 text-tab text-ink-subtle">{t("notStored")}</p>
      <div className="mt-4">
        <div className="flex justify-between text-caption font-semibold">
          <span>{t("strength")}</span>
          <span className={cn(score >= scene.targetScore ? "text-safe-700" : score >= 2 ? "text-warn-700" : "text-risk-700")}>{value ? levels[score] : ""}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((k) => (
            <span key={k} className={cn("h-2 rounded-pill", value && k <= score ? (score >= scene.targetScore ? "bg-safe-500" : score >= 2 ? "bg-warn-500" : "bg-risk-500") : "bg-sunken")} />
          ))}
        </div>
      </div>
      <ul className="mt-5 grid gap-1.5">
        {scene.tips.map((tip, k) => (
          <li key={k} className="flex items-start gap-2 text-body-sm text-ink-muted">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
            {tip}
          </li>
        ))}
      </ul>
      {reached ? (
        <FeedbackSheet tone="safe" title={t("reached")} continueLabel={tp("continue")} onContinue={() => (env.narrator.stop(), env.onDone())} env={env} />
      ) : null}
    </div>
  );
}

/* ─────────────── recap ─────────────── */

export function RecapScene({ scene, env, saving, onFinish }: { scene: Extract<Scene, { type: "recap" }>; env: SceneEnv; saving: boolean; onFinish: () => void }) {
  const t = useTranslations("player.recap");
  useEffect(() => {
    env.narrator.speak(scene.points.join(". "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mx-auto grid w-full max-w-3xl items-center gap-8 py-4 md:grid-cols-[14rem_1fr]">
      <Mascot mood="celebrate" gesture="cheer" fire={{ name: "bounce", key: 0 }} talking={env.narrator.speaking} className="mx-auto size-48 md:size-56" topic={env.topic as never} still={env.still} />
      <div>
        <h2 className="text-headline font-bold">{t("title")}</h2>
        <ul className="mt-5 grid gap-3">
          {scene.points.map((p, k) => (
            <li key={k} className="flex animate-rise items-start gap-3 rounded-xl bg-surface p-4 shadow-xs ring-1 ring-line" style={{ animationDelay: `${k * 90}ms` }}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-safe-500 text-white">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span className="text-body-sm font-medium">{p}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" className="mt-6" onClick={() => (env.narrator.stop(), onFinish())} disabled={saving} iconRight={<ChevronRight />}>
          {saving ? t("saving") : t("finish")}
        </Button>
      </div>
    </div>
  );
}

