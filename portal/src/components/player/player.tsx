"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Award, Check, ChevronRight, Clock, Headphones, Home, MessageCircleQuestion, MessageSquareWarning, Mic, MoreHorizontal, RotateCcw, Volume2, VolumeX, X, Zap } from "lucide-react";
import type { Brand, Scene } from "@/lib/content/types";
import { Mascot } from "@/components/mascot/mascot";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { ProblemForm } from "@/components/learner/problem-form";
import { BrandsProvider } from "./artifacts";
import { answerIdsOf, lessonStateKey, parseLesson, serializeLesson, type SavedLesson } from "./resume";
import { useNarrator } from "./narrator";
import { TutorPanel } from "./tutor-panel";
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
import { attestModuleAction, completeLessonAction, startLessonAction, type LessonResult } from "@/server/actions/learning";
import { setPreferencesAction } from "@/server/actions/preferences";

export type PlayerProps = {
  /** The signed-in learner: the saved lesson position is kept per learner. */
  viewerId: string;
  slug: string;
  moduleTitle: string;
  topic: string;
  lesson: { key: string; title: string; minutes: number; scenes: Scene[] };
  /** Language the scenes are written in (may differ from the UI language); the narration voice follows it. */
  contentLocale: string;
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
};

const SPEEDS = [1, 1.25, 1.5, 0.75];

/**
 * Narration speed is remembered across lessons (localStorage, best effort) and read as an external
 * store, so the server render and the first client render agree on 1× before the stored value shows.
 */
let speedFallback = 1;
const speedListeners = new Set<() => void>();
function readSpeed(): number {
  try {
    const s = Number(localStorage.getItem("cy:speed"));
    if (SPEEDS.includes(s)) return s;
  } catch {
    /* storage unavailable: the in-memory value lasts for this page */
  }
  return speedFallback;
}
function writeSpeed(v: number) {
  speedFallback = v;
  try {
    localStorage.setItem("cy:speed", String(v));
  } catch {
    /* ignore */
  }
  speedListeners.forEach((fn) => fn());
}
function subscribeSpeed(fn: () => void) {
  speedListeners.add(fn);
  return () => void speedListeners.delete(fn);
}

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

export function LessonPlayer(p: PlayerProps) {
  const t = useTranslations("player");
  const tc = useTranslations("common");
  const locale = useLocale();
  const doneParam = useSearchParams().get("done") === "1";
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [inner, setInner] = useState(0);
  // The in-scene position a resumed lesson reopens at; it applies to the first scene shown only.
  const [resumeInner, setResumeInner] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(p.soundOn);
  const speed = useSyncExternalStore(subscribeSpeed, readSpeed, () => 1);
  const [motion, setMotion] = useState(p.motion);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);
  const answers = useRef<PlayerAnswer[]>([]);
  const started = useRef<number>(0);
  const narrator = useNarrator({ enabled: soundOn, rate: speed, lang: p.contentLocale });

  const scenes = p.lesson.scenes;
  const scene = scenes[index];
  const sceneIds = useMemo(() => scenes.map((s) => s.id), [scenes]);
  const answerIds = useMemo(() => answerIdsOf(scenes), [scenes]);
  const storageKey = lessonStateKey(p.viewerId, p.slug, p.lesson.key);
  const savedRaw = useSyncExternalStore(noSubscribe, () => readSaved(storageKey), () => null);
  const saved = useMemo(() => parseLesson(savedRaw, sceneIds, answerIds), [savedRaw, sceneIds, answerIds]);
  // A lesson left part-way offers to continue; one finished in this history entry shows its result.
  const resumable = phase === "intro" && saved?.kind === "playing" && (saved.index > 0 || saved.inner > 0 || saved.answers.length > 0) ? saved : null;
  const restoredDone = phase === "intro" && doneParam && saved?.kind === "done" ? saved : null;
  const progress = phase === "done" || restoredDone ? 1 : phase === "intro" ? 0 : (index + Math.min(inner, 0.95)) / scenes.length;

  const save = (state: SavedLesson) => writeSaved(storageKey, serializeLesson(state, sceneIds));
  const savePosition = (at: number, within = 0) => save({ kind: "playing", index: at, inner: within, answers: answers.current, elapsedMs: Date.now() - started.current });

  const begin = (from: Extract<SavedLesson, { kind: "playing" }> | null) => {
    const at = from?.index ?? 0;
    answers.current = from ? [...from.answers] : [];
    started.current = Date.now() - (from?.elapsedMs ?? 0);
    setIndex(at);
    setInner(from?.inner ?? 0);
    setResumeInner(from?.inner || null);
    setPhase("playing");
    savePosition(at, from?.inner ?? 0);
    if (doneParam) setDoneParam(false);
    void startLessonAction(p.slug, p.lesson.key);
  };

  const nextScene = () => {
    narrator.stop();
    setInner(0);
    setResumeInner(null);
    if (index + 1 < scenes.length) {
      setIndex(index + 1);
      savePosition(index + 1);
    }
  };

  const previousScene = () => {
    narrator.stop();
    setInner(0);
    setResumeInner(null);
    setIndex(index - 1);
    savePosition(index - 1);
  };

  const finish = async () => {
    setSaving(true);
    narrator.stop();
    try {
      const res = await completeLessonAction({
        slug: p.slug,
        lessonKey: p.lesson.key,
        seconds: Math.min(4 * 3600, Math.round((Date.now() - started.current) / 1000)),
        answers: answers.current.slice(0, 400),
      });
      if (!res.ok) {
        toast(t("tutor.error"), "error");
        return;
      }
      // No router.refresh() here: every link on the done screen leads to a freshly rendered page,
      // and a refresh that fell back to a full reload would drop this screen (XP, attestation
      // prompt). The result is saved as well, so reloading this history entry shows it again.
      save({ kind: "done", result: res, token: null });
      setDoneParam(true);
      setResult(res);
      setPhase("done");
    } catch {
      // A rejected action (offline, server error) must not leave the recap stuck on "Saving".
      toast(t("tutor.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const env: SceneEnv = {
    narrator,
    soundOn,
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
    void setPreferencesAction({ soundOn: v });
  };
  const cycleSpeed = () => writeSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);

  return (
    <BrandsProvider brands={p.brands}>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/90 pt-(--safe-top) backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
            <Link href={`/learn/${p.slug}`} aria-label={t("leave")} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink" onClick={() => narrator.stop()}>
              <X className="size-5" />
            </Link>
            <div role="progressbar" aria-label={t("progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-sunken">
              <div className="h-full rounded-pill bg-brand-600 transition-[width] duration-(--duration-slow) ease-(--ease-out-expo)" style={{ width: `${Math.max(2, progress * 100)}%` }} />
            </div>
            {p.tutorEnabled && phase === "playing" ? (
              <button type="button" onClick={() => (narrator.stop(), setTutorOpen(true))} aria-label={t("askLabel")} className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-50 px-3.5 text-caption font-bold text-brand-700 hover:bg-brand-100">
                {p.tutorVoice !== false ? <Mic className="size-4 text-brand-600" /> : <MessageCircleQuestion className="size-4 text-brand-600" />}
                <span>{t("ask")}</span>
              </button>
            ) : null}
            <button type="button" onClick={cycleSpeed} aria-label={t("speed", { speed })} className="h-10 min-w-12 rounded-full px-2.5 text-caption font-bold tabular-nums hover:bg-sunken">
              {speed}×
            </button>
            <button type="button" onClick={toggleSound} aria-label={soundOn ? t("soundOff") : t("soundOn")} aria-pressed={soundOn} className="grid size-10 place-items-center rounded-full hover:bg-sunken">
              {soundOn ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5 text-ink-subtle" />}
            </button>
            <button type="button" onClick={() => setOptionsOpen(true)} aria-label={t("more")} className="grid size-10 place-items-center rounded-full hover:bg-sunken">
              <MoreHorizontal className="size-4.5" />
            </button>
          </div>
        </header>

        <main id="main" className="protected mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6 sm:px-6 lg:pt-10">
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
                {soundOn ? (
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

        <Dialog open={optionsOpen} onClose={() => setOptionsOpen(false)} title={t("options")} size="sm">
          <p className="text-caption font-semibold text-ink-muted">{t("motion")}</p>
          <OptionsMotion
            value={motion}
            onChange={(m) => {
              setMotion(m);
              document.documentElement.dataset.motion = m;
              void setPreferencesAction({ motion: m });
            }}
          />
          <ProblemSection context={`lesson:${p.slug}/${p.lesson.key}${scene ? `#${scene.id}` : ""}`} onSent={() => setOptionsOpen(false)} />
        </Dialog>
        <TutorPanel open={tutorOpen} onClose={() => setTutorOpen(false)} slug={p.slug} lessonKey={p.lesson.key} sceneId={phase === "playing" ? scene.id : null} speak={(text) => narrator.speak(text, { lang: locale })} voice={p.tutorVoice !== false} />
      </div>
    </BrandsProvider>
  );
}

function OptionsMotion({ value, onChange }: { value: "full" | "calm" | "still"; onChange: (v: "full" | "calm" | "still") => void }) {
  const t = useTranslations("learner.profile");
  const tp = useTranslations("player");
  return (
    <Segmented
      name="motion"
      size="lg"
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
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-reward-100 px-4 py-2 text-body font-bold text-reward-ink">
          <Zap className="size-5 fill-reward-500 text-reward-600" />
          {result?.xp ? t("xp", { xp: result.xp }) : t("noXp")}
        </p>

        {awaiting ? (
          <div className="mt-6 rounded-2xl border border-reward-200 bg-surface p-5 text-left shadow-raised">
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
              {t("nextLesson")}: {p.next.title}
            </ButtonLink>
          ) : null}
          <div className="flex gap-3">
            <ButtonLink href={`/learn/${p.slug}`} variant="secondary">
              {t("backToModule")}
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" icon={<Home />}>
              {t("home")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

