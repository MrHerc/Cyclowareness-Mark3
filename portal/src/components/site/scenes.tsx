"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Battery, Camera, CheckCircle2, Cloud, FileDown, Mail, MessageSquare, Phone, PhoneOff, QrCode, RotateCcw, Server, Signal, XCircle } from "lucide-react";
import { requestDemoAction, type DemoField, type DemoState, type DemoValues } from "@/server/actions/site";
import { LOCALE_NAMES, langAttrs, type SiteLocale } from "@/i18n/config";
import { EMPLOYEE_RANGES, type AdminScene, type DeployScene, type DemoScene, type InboxScene, type LanguagesScene, type Line, type PhoneScene, type TutorScene } from "@/lib/landing";
import { cn } from "@/lib/cn";
import { Marked } from "./marked";
import { useGuide } from "./guide";

export type Beats = Partial<Record<"bridge" | "intro" | "prompt" | "lesson", Line>>;

/* ───────── shared bits ───────── */

/** 5×7 LED glyphs for the phone clock: one string of lit (1) and unlit (0) dots per row. */
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["0", "0", "1", "0", "1", "0", "0"],
};

/** Dot-matrix clock: lit dots glow, unlit dots stay faintly visible. */
function DotClock({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="flex gap-2">
        {[...value].map((ch, k) => {
          const rows = GLYPHS[ch];
          if (!rows) return null;
          const w = rows[0].length;
          return (
            <span key={k} className={cn("grid gap-[2px]", w === 5 ? "grid-cols-5" : "grid-cols-1")}>
              {rows
                .join("")
                .split("")
                .map((b, j) => (
                  <i key={j} className={cn("block size-[5px] rounded-full", b === "1" ? "bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.6)]" : "bg-white/10")} />
                ))}
            </span>
          );
        })}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}

/** Phone frame with the dot-matrix clock and status icons (as on the original hero). */
function PhoneFrame({
  clock,
  label,
  spot,
  perch,
  aside,
  children,
  className,
}: {
  clock: string;
  label: string;
  /** `data-spot` name, so the guide can point at the phone. */
  spot?: string;
  /** `data-perch` name, so the travelling guide cat can sit on the frame's top edge. */
  perch?: string;
  /** Drawn against the frame, outside the screen (the guide cat's perch beside the phone). */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} data-spot={spot} data-perch={perch} className={cn("relative rounded-[2.25rem] bg-surface p-2.5 shadow-overlay ring-1 ring-line", className)}>
      <div className="relative flex min-h-[30rem] flex-col overflow-hidden rounded-[1.8rem] bg-[#1d1a4e] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] [background-size:14px_14px]" />
        <div className="relative flex items-center justify-between px-6 pt-5">
          <DotClock value={clock} />
          <span className="flex items-center gap-1.5 text-white/70">
            <Signal className="size-4" />
            <Battery className="size-5" />
          </span>
        </div>
        <div className="relative flex flex-1 flex-col">{children}</div>
      </div>
      {aside}
    </div>
  );
}

const CHANNEL_ICON = { email: Mail, sms: MessageSquare, qr: Camera } as const;

/* ───────── 1 · inbox quiz ───────── */

export function InboxGame({
  scene,
  beats,
  fastSeconds,
  question,
  rapport,
  screenLabel,
  perch,
  onDone,
  onRole,
}: {
  scene: InboxScene;
  beats: Beats;
  fastSeconds: number;
  question: string;
  rapport: { score: Record<"low" | "mid" | "high", Line>; fast: Line };
  screenLabel: string;
  /** The guide's perch at the phone's edge (positioned against the phone; the cat is the landing's ScrollCat). */
  perch?: React.ReactNode;
  onDone: (score: number, total: number) => void;
  onRole: (role: string) => void;
}) {
  const guide = useGuide();
  const [step, setStep] = useState<"closed" | "card" | "result">("closed");
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const started = useRef(0);
  const card = scene.cards[i];
  const total = scene.cards.length;

  const open = () => {
    started.current = Date.now();
    setStep("card");
    setI(0);
    setRight(0);
    setAnswer(null);
    guide.say(scene.cards[0].hint, { gesture: "point-left" });
  };
  const choose = (isPhish: boolean) => {
    if (answer !== null) return;
    setAnswer(isPhish);
    const ok = isPhish === card.isPhish;
    if (ok) setRight((r) => r + 1);
    guide.say(ok ? card.right : card.wrong, { gesture: ok ? "cheer" : "shake" });
  };
  const next = () => {
    if (i + 1 < total) {
      setI(i + 1);
      setAnswer(null);
      guide.say(scene.cards[i + 1].hint, { gesture: "inspect" });
      return;
    }
    setStep("result");
    const ratio = right / total;
    const fast = Date.now() - started.current < fastSeconds * 1000;
    guide.remember({ score: right, total });
    onDone(right, total);
    const lines: Line[] = [scene.done, rapport.score[ratio >= 0.99 ? "high" : ratio >= 0.6 ? "mid" : "low"]];
    if (fast && ratio >= 0.6) lines.push(rapport.fast);
    if (beats.lesson) lines.push(beats.lesson);
    guide.say(lines, { gesture: ratio >= 0.99 ? "cheer" : "nod" });
  };

  return (
    <div className="grid gap-5">
      <div className="relative mx-auto w-full max-w-[26rem]">
        <span aria-hidden className="absolute -top-2.5 -start-2.5 size-3 border-t border-s border-ink-subtle/50" />
        <span aria-hidden className="absolute -top-2.5 -end-2.5 size-3 border-t border-e border-ink-subtle/50" />
        <span aria-hidden className="absolute -bottom-2.5 -start-2.5 size-3 border-b border-s border-ink-subtle/50" />
        <span aria-hidden className="absolute -end-2.5 -bottom-2.5 size-3 border-e border-b border-ink-subtle/50" />
        <PhoneFrame clock={scene.clock} label={screenLabel} spot="hero-phone">
          {step === "closed" ? (
            <div className="flex flex-1 flex-col justify-center gap-6 px-5 pb-8">
              <p aria-hidden className="px-1 font-display text-[2.6rem] leading-[1.02] font-bold text-balance">
                {question}
              </p>
              <div className="relative">
                <div className="relative z-10 rounded-2xl bg-white/12 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                  <p className="flex items-center justify-between gap-3 text-tab font-semibold text-white/60">
                    <span>{scene.newMessage}</span>
                    <span className="font-mono text-tab text-white/50 tabular-nums">09:18</span>
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-bold">{scene.cards[0].sender}</p>
                      <p className="truncate text-caption text-white/80">{scene.cards[0].subject ?? scene.cards[0].body}</p>
                    </div>
                    <button type="button" onClick={open} className="h-10 shrink-0 rounded-pill bg-white px-5 text-caption font-bold text-[#1d1a4e] shadow-raised hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white pointer-coarse:h-11">
                      {scene.open}
                    </button>
                  </div>
                </div>
                <div aria-hidden className="-mt-8 flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 opacity-60">
                  <span className="size-2 rounded-full bg-white/40" />
                  <span className="grid flex-1 gap-1.5">
                    <span className="h-2 w-2/3 rounded-pill bg-white/25" />
                    <span className="h-2 w-1/2 rounded-pill bg-white/20" />
                  </span>
                  <span className="font-mono text-tab text-white/40 tabular-nums">08:30</span>
                </div>
                <div aria-hidden className="mt-3 flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 opacity-35">
                  <span className="size-2 rounded-full bg-white/40" />
                  <span className="grid flex-1 gap-1.5">
                    <span className="h-2 w-2/3 rounded-pill bg-white/25" />
                    <span className="h-2 w-1/2 rounded-pill bg-white/20" />
                  </span>
                  <span className="font-mono text-tab text-white/40 tabular-nums">07:23</span>
                </div>
              </div>
            </div>
          ) : step === "card" ? (
            <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-5">
              <p className="flex items-center justify-between text-tab font-semibold text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  {(() => {
                    const Icon = CHANNEL_ICON[card.channel];
                    return <Icon className="size-4" />;
                  })()}
                  {scene.apps[card.channel]}
                </span>
                <span>{scene.progress.replace("{n}", String(i + 1)).replace("{total}", String(total))}</span>
              </p>
              <div className="rounded-2xl bg-white p-4 text-ink shadow-raised">
                {card.channel === "email" ? (
                  <>
                    <p className="text-body-sm font-bold">{card.sender}</p>
                    {card.address ? (
                      <span className="block font-mono text-tab text-ink-muted">
                        <Marked dir="ltr" text={card.address} reveal={answer !== null} />
                      </span>
                    ) : null}
                    {card.subject ? <p className="mt-3 text-body-sm font-semibold">{card.subject}</p> : null}
                    <Marked text={card.body} reveal={answer !== null} className="mt-1.5 block text-caption text-ink-muted" />
                    {card.action ? <span className="mt-3 inline-block rounded-pill bg-brand-600 px-4 py-2 text-tab font-bold text-brand-on">{card.action}</span> : null}
                  </>
                ) : card.channel === "sms" ? (
                  <>
                    <p className="text-center text-tab font-semibold text-ink-subtle">{card.sender}</p>
                    <p className="mt-2 w-[88%] rounded-2xl rounded-es-sm bg-sunken px-3.5 py-2.5 text-caption">
                      <Marked text={card.body} reveal={answer !== null} />
                    </p>
                  </>
                ) : (
                  <div className="grid justify-items-center gap-3 text-center">
                    <QrCode className="size-24 text-ink" strokeWidth={1.2} />
                    <p className="text-body-sm font-semibold">{card.sender}</p>
                    <Marked text={card.body} reveal={answer !== null} className="text-caption text-ink-muted" />
                    {card.opens ? (
                      <p className="rounded-pill bg-sunken px-3 py-1.5 font-mono text-tab">
                        {scene.opensLabel}: <Marked dir="ltr" text={card.opens} reveal={answer !== null} />
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              {answer === null ? (
                <div role="group" aria-label={scene.answerGroup} className="mt-auto grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={() => choose(true)} className="h-12 rounded-pill bg-risk-500 font-bold text-white hover:bg-risk-600">
                    {scene.phish}
                  </button>
                  <button type="button" onClick={() => choose(false)} className="h-12 rounded-pill bg-safe-500 font-bold text-white hover:bg-safe-600">
                    {scene.safe}
                  </button>
                </div>
              ) : (
                <div className="mt-auto grid gap-3" aria-live="polite">
                  <p className={cn("flex items-center gap-2 text-body-sm font-bold", answer === card.isPhish ? "text-safe-300" : "text-reward-300")}>
                    {answer === card.isPhish ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                    {answer === card.isPhish ? scene.rightLabel : scene.wrongLabel} · {card.isPhish ? scene.truthPhish : scene.truthSafe}
                  </p>
                  <p className="text-caption text-white/80">{(answer === card.isPhish ? card.right : card.wrong).text}</p>
                  <button type="button" onClick={next} className="h-11 rounded-pill bg-white font-bold text-[#1d1a4e] hover:bg-white/90">
                    {scene.next}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-5 px-5 pb-6">
              <p className="font-display text-[2.2rem] leading-tight font-bold">{scene.scoreLabel.replace("{score}", String(right)).replace("{total}", String(total))}</p>
              <div className="grid gap-2">
                <p className="text-caption font-semibold text-white/70">{scene.rolePrompt}</p>
                <div className="grid grid-cols-2 gap-2">
                  {scene.roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        guide.remember({ role: r.id });
                        onRole(r.id);
                      }}
                      className="min-h-11 rounded-xl bg-white/12 px-3 py-2 text-caption font-semibold ring-1 ring-white/20 hover:bg-white/20"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={open} className="inline-flex w-fit items-center gap-1.5 text-caption font-semibold text-white/70 hover:text-white pointer-coarse:min-h-11">
                <RotateCcw className="size-4" />
                {scene.again}
              </button>
            </div>
          )}
        </PhoneFrame>
        {perch}
      </div>
    </div>
  );
}

/* ───────── 2 · phone call ───────── */

export function PhoneCall({ scene, beats, clock, screenLabel, skipLabel }: { scene: PhoneScene; beats: Beats; clock: string; screenLabel: string; skipLabel: string }) {
  const guide = useGuide();
  const [state, setState] = useState<"ringing" | "talking" | "choice" | "declined" | "hungUp" | "gaveCode">("ringing");
  const answer = () => {
    setState("talking");
    guide.say(scene.script, { then: () => setState("choice") });
  };
  /** Straight to the decision, without waiting for the rest of the call. */
  const skipCall = () => {
    guide.stop();
    setState("choice");
  };
  const end = (s: "declined" | "hungUp" | "gaveCode") => {
    setState(s);
    const lines = [scene[s]];
    if (beats.lesson) lines.push(beats.lesson);
    guide.say(lines, { gesture: s === "gaveCode" ? "facepalm" : "cheer" });
  };
  return (
    <PhoneFrame
      clock={clock}
      label={screenLabel}
      perch="phone"
      // The guide cat can also peek from the phone's edge, as on the hero; not on a phone, where the frame
      // fills the width and the cat would cover the call's caption and buttons (its top edge is the perch there).
      aside={<span aria-hidden data-perch="phone-side" data-perch-box className="pointer-events-none absolute top-[48%] -end-12 hidden size-28 sm:block" />}
      className="mx-auto w-full max-w-[22rem]"
    >
      <div className="flex flex-1 flex-col items-center gap-4 px-6 pt-8 pb-8 text-center">
        <span className={cn("grid size-24 place-items-center rounded-full bg-white/12 font-display text-[2.4rem] font-bold ring-1 ring-white/20", state === "ringing" && "motion-safe:animate-pulse")}>N</span>
        <div>
          <p className="text-tab font-semibold text-white/60">{state === "ringing" ? scene.ringing : scene.callerLabel}</p>
          <p className="text-title-sm font-bold">{scene.callerName}</p>
          <p dir="ltr" className="font-mono text-caption text-white/70">
            {scene.callerNumber}
          </p>
        </div>
        <div className="mt-auto w-full" aria-live="polite">
          {state === "ringing" ? (
            <div className="flex justify-around">
              <button type="button" onClick={() => end("declined")} className="grid justify-items-center gap-1.5 text-tab font-semibold">
                <span className="grid size-16 place-items-center rounded-full bg-risk-500 hover:bg-risk-600">
                  <PhoneOff className="size-7" />
                </span>
                {scene.decline}
              </button>
              <button type="button" onClick={answer} className="grid justify-items-center gap-1.5 text-tab font-semibold">
                <span className="grid size-16 place-items-center rounded-full bg-safe-500 hover:bg-safe-600 motion-safe:animate-bounce">
                  <Phone className="size-7" />
                </span>
                {scene.answer}
              </button>
            </div>
          ) : state === "talking" || state === "choice" ? (
            <div className="grid gap-2.5">
              <p className="min-h-16 rounded-2xl bg-white/10 px-4 py-3 text-caption text-white/90">{guide.caption?.line.voice === "caller" ? guide.caption.line.text : "…"}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={state !== "choice"} onClick={() => end("hungUp")} className="h-11 rounded-pill bg-risk-500 text-caption font-bold disabled:opacity-40">
                  {scene.hangUp}
                </button>
                <button type="button" disabled={state !== "choice"} onClick={() => end("gaveCode")} className="h-11 rounded-pill bg-white/15 text-caption font-bold ring-1 ring-white/25 disabled:opacity-40">
                  {scene.giveCode}
                </button>
              </div>
              {state === "talking" ? (
                <button type="button" onClick={skipCall} className="justify-self-center text-caption font-semibold text-white/75 underline-offset-2 hover:text-white hover:underline pointer-coarse:min-h-11 pointer-coarse:px-3">
                  {skipLabel}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3">
              <p className={cn("rounded-2xl px-4 py-3 text-caption font-semibold", state === "gaveCode" ? "bg-risk-500/25 text-risk-100" : "bg-safe-500/25 text-safe-100")}>{scene[state].text}</p>
              <button type="button" onClick={() => setState("ringing")} className="inline-flex items-center justify-center gap-1.5 text-caption font-semibold text-white/75 hover:text-white pointer-coarse:min-h-11">
                <RotateCcw className="size-4" />
                {scene.again}
              </button>
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ───────── 3 · AI tutor ───────── */

export function TutorDemo({ scene, beats }: { scene: TutorScene; beats: Beats }) {
  const guide = useGuide();
  const [asked, setAsked] = useState<string | null>(null);
  return (
    <div data-perch="tutor" className="mx-auto grid w-full max-w-xl gap-4 rounded-3xl bg-surface p-5 shadow-overlay ring-1 ring-line">
      <div className="w-[88%] rounded-2xl rounded-es-sm bg-sunken px-4 py-3 text-body-sm">
        <Marked text={scene.sample} reveal={!!asked} />
      </div>
      {asked ? (
        <div className="ms-auto w-[88%] rounded-2xl rounded-ee-sm bg-brand-600 px-4 py-3 text-body-sm text-brand-on" aria-live="polite">
          {scene.chips.find((c) => c.id === asked)?.answer.text}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {scene.chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setAsked(c.id);
              const lines = [c.answer];
              if (beats.lesson && asked) lines.push(beats.lesson);
              guide.say(lines, { gesture: "explain" });
            }}
            className={cn("rounded-pill px-4 py-2 text-caption font-semibold ring-1 pointer-coarse:min-h-11", asked === c.id ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-surface ring-line hover:bg-sunken")}
          >
            {c.question}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────── 4 · languages ───────── */

export function LanguagesDemo({ scene, beats }: { scene: LanguagesScene; beats: Beats }) {
  const guide = useGuide();
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <ul data-perch="languages" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {scene.samples.map((s) => (
          <li key={s.locale}>
            <button
              type="button"
              {...langAttrs(s.locale)}
              onClick={() => {
                const first = picked === null;
                setPicked(s.locale);
                guide.say(first && beats.lesson ? [s.line, beats.lesson] : s.line, { lang: s.locale, gesture: "wave" });
              }}
              className={cn("h-12 w-full rounded-xl px-3 text-caption font-semibold ring-1 transition-colors", picked === s.locale ? "bg-brand-600 text-brand-on ring-brand-600" : "bg-surface ring-line hover:bg-sunken")}
            >
              {LOCALE_NAMES[s.locale as SiteLocale] ?? s.locale}
            </button>
          </li>
        ))}
      </ul>
      {picked ? (
        <p {...langAttrs(picked)} className="rounded-2xl bg-surface px-5 py-4 text-center text-title-sm font-semibold shadow-raised ring-1 ring-line" aria-live="polite">
          {scene.samples.find((s) => s.locale === picked)?.line.text}
        </p>
      ) : null}
    </div>
  );
}

/* ───────── 5 · admin report ───────── */

const SAMPLE = {
  finance: { clicked: 31, reported: 38, learned: 64 },
  hr: { clicked: 18, reported: 55, learned: 81 },
  it: { clicked: 7, reported: 82, learned: 93 },
  legal: { clicked: 22, reported: 41, learned: 70 },
} as Record<string, { clicked: number; reported: number; learned: number }>;

export function AdminDemo({ scene, beats, you }: { scene: AdminScene; beats: Beats; you: { clicked: number; reported: number; learned: number } | null }) {
  const guide = useGuide();
  const rows = [
    ...scene.departments.map((d) => ({ id: d.id, name: d.name, v: SAMPLE[d.id] ?? { clicked: 20, reported: 50, learned: 70 }, me: false })),
    { id: "you", name: scene.you, v: you ?? { clicked: 0, reported: 0, learned: 0 }, me: true },
  ];
  const cols = ["clicked", "reported", "learned"] as const;
  const tone = { clicked: "bg-risk-500", reported: "bg-safe-500", learned: "bg-brand-500" };
  return (
    <div data-perch="admin" className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-surface shadow-overlay ring-1 ring-line">
      <table className="w-full text-start text-caption">
        <thead className="bg-sunken text-tab text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-semibold" />
            {cols.map((c) => (
              <th key={c} className="px-3 py-3 font-semibold">
                {scene.columns[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className={cn(r.me && "bg-reward-50")}>
              <th scope="row" className={cn("px-4 py-3 font-semibold", r.me && "text-reward-ink")}>
                {r.name}
              </th>
              {cols.map((c) => (
                <td key={c} className="px-3 py-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-pill bg-sunken">
                      <span className={cn("block h-full rounded-pill transition-[width] duration-(--duration-slow)", tone[c])} style={{ width: `${r.v[c]}%` }} />
                    </span>
                    <span className="w-9 text-end tabular-nums">{r.v[c]}%</span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end border-t border-line p-3">
        <button
          type="button"
          onClick={() => guide.say(beats.lesson ? [scene.explain, beats.lesson] : scene.explain, { gesture: "present" })}
          className="inline-flex h-10 items-center gap-2 rounded-pill bg-ink px-4 text-caption font-semibold text-white hover:bg-ink/85 pointer-coarse:h-11"
        >
          <FileDown className="size-4" />
          {scene.export}
        </button>
      </div>
    </div>
  );
}

/* ───────── 6 · deployment ───────── */

export function DeployDemo({ scene, beats }: { scene: DeployScene; beats: Beats }) {
  const guide = useGuide();
  const [pick, setPick] = useState<"cloud" | "onPrem" | null>(null);
  return (
    <div role="radiogroup" aria-label={scene.headline} data-perch="deploy" className="mx-auto grid w-full max-w-2xl gap-4 sm:grid-cols-2">
      {(["cloud", "onPrem"] as const).map((k) => {
        const Icon = k === "cloud" ? Cloud : Server;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={pick === k}
            onClick={() => {
              const first = pick === null;
              setPick(k);
              guide.say(first && beats.lesson ? [scene[k].said, beats.lesson] : scene[k].said, { gesture: k === "cloud" ? "point-up" : "shield-up" });
            }}
            className={cn("grid gap-3 rounded-3xl p-6 text-start shadow-raised ring-2 transition-all", pick === k ? "bg-brand-600 text-brand-on ring-brand-600" : "bg-surface ring-line hover:ring-brand-200")}
          >
            <Icon className="size-9" />
            <span className="text-title-sm font-bold">{scene[k].title}</span>
            <span className={cn("text-body-sm", pick === k ? "text-brand-on/85" : "text-ink-muted")}>{scene[k].line}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────── 7 · demo request ───────── */

/** What the visitor typed, in the shape a refused server submit echoes back. */
function typedValues(data: FormData): DemoValues {
  const text = (k: string) => String(data.get(k) ?? "");
  return { name: text("name"), email: text("email"), organisation: text("organisation"), country: text("country"), employees: text("employees"), message: text("message"), consent: data.get("consent") === "on" };
}

// A rejected submit (offline, a deploy in between) shows the "failed" message on the form with what was typed,
// instead of replacing the landing page with the error boundary.
function submitDemo(prev: DemoState, data: FormData): Promise<DemoState> {
  return requestDemoAction(prev, data).catch((): DemoState => ({ error: "failed", values: typedValues(data) }));
}

export function DemoForm({
  scene,
  lang,
  countries,
  privacyLabel,
}: {
  scene: DemoScene;
  lang: string;
  countries: { priority: { code: string; name: string }[]; all: { code: string; name: string }[] };
  privacyLabel: string;
}) {
  const guide = useGuide();
  // `posted`: the answer to a submit made without JavaScript (or before hydration), which goes straight to the server action
  // as a POST and comes back as a new page. `sent`: the answer to a hydrated submit, sent through submitDemo.
  const [posted, post] = useActionState<DemoState, FormData>(requestDemoAction, undefined);
  const [sent, send, pending] = useActionState<DemoState, FormData>(submitDemo, undefined);
  const state = sent ?? posted;
  const [, startSubmit] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const said = useRef(false);
  // After a refused submit, move focus to the first field that needs attention.
  useEffect(() => {
    if (!state?.fields) return;
    const first = form.current?.querySelector<HTMLElement>("[aria-invalid='true']");
    first?.focus();
  }, [state]);
  useEffect(() => {
    if (state?.ok && !said.current) {
      said.current = true;
      guide.say(scene.success, { gesture: "bow" });
    }
  }, [state, guide, scene.success]);
  if (state?.ok) {
    return (
      <div data-perch="demo" className="mx-auto grid w-full max-w-xl justify-items-center gap-3 rounded-3xl bg-safe-50 p-8 text-center ring-1 ring-safe-100" role="status">
        <CheckCircle2 className="size-12 text-safe-600" />
        <p className="text-title-sm font-semibold text-safe-700">{scene.success.text}</p>
      </div>
    );
  }
  const err = (f: DemoField) => {
    const kind = state?.fields?.[f];
    return kind === "email" ? scene.errors.email : kind === "consent" ? scene.errors.consent : kind ? scene.errors.required : null;
  };
  /** aria wiring of a field and its message. */
  const a11y = (f: DemoField) => (err(f) ? { "aria-invalid": true as const, "aria-describedby": `demo-${f}-error` } : { "aria-invalid": false as const });
  const message = (f: DemoField) =>
    err(f) ? (
      <span id={`demo-${f}-error`} className="text-risk-600">
        {err(f)}
      </span>
    ) : null;
  /** Values echoed by a refused submit; they only matter for a server-rendered (no-JS) form, which React cannot keep. */
  const v = state?.values;
  const field = "h-12 w-full rounded-lg border border-line-control bg-surface px-4 text-body-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    // `action` is the server action itself so a submit made before hydration (or without JavaScript) is
    // still a POST to it instead of a GET that puts the visitor's details in the URL. Once hydrated,
    // onSubmit prevents the default and dispatches submitDemo in its own transition: React then skips
    // its automatic form reset, so a refused or failed submit keeps every value the visitor typed.
    <form
      ref={form}
      action={post}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startSubmit(() => send(data));
      }}
      data-perch="demo"
      className="mx-auto grid w-full max-w-xl gap-4 rounded-3xl bg-surface p-6 shadow-overlay ring-1 ring-line"
      noValidate
    >
      <input type="hidden" name="locale" value={lang} />
      <input type="hidden" name="consentVersion" value={scene.consentVersion} />
      <div aria-hidden className="absolute -start-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="grid gap-1.5 text-caption font-semibold">
        {scene.fullName}
        <input name="name" required maxLength={120} autoComplete="name" defaultValue={v?.name} className={field} {...a11y("name")} />
        {message("name")}
      </label>
      <label className="grid gap-1.5 text-caption font-semibold">
        {scene.workEmail}
        <input name="email" type="email" dir="ltr" required maxLength={254} autoComplete="email" defaultValue={v?.email} className={field} {...a11y("email")} />
        {message("email")}
      </label>
      <label className="grid gap-1.5 text-caption font-semibold">
        {scene.organisation}
        <input name="organisation" required maxLength={200} autoComplete="organization" defaultValue={v?.organisation} className={field} {...a11y("organisation")} />
        {message("organisation")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-caption font-semibold">
          {scene.country}
          <select name="country" required defaultValue={v?.country ?? ""} className={field} {...a11y("country")}>
            <option value="" disabled>
              {scene.countryPrompt}
            </option>
            {countries.priority.map((c) => (
              <option key={`p-${c.code}`} value={c.code}>
                {c.name}
              </option>
            ))}
            <option disabled>──────</option>
            {countries.all.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {message("country")}
        </label>
        <label className="grid gap-1.5 text-caption font-semibold">
          {scene.employees}
          <select name="employees" required defaultValue={v?.employees ?? ""} className={field} {...a11y("employees")}>
            <option value="" disabled>
              —
            </option>
            {EMPLOYEE_RANGES.map((r) => (
              <option key={r} value={r}>
                {scene.employeeRanges[r]}
              </option>
            ))}
          </select>
          {message("employees")}
        </label>
      </div>
      <label className="grid gap-1.5 text-caption font-semibold">
        <span>
          {scene.message} <span className="font-normal text-ink-subtle">({scene.optional})</span>
        </span>
        <textarea name="message" maxLength={2000} rows={3} defaultValue={v?.message} className={cn(field, "h-auto py-3")} {...a11y("message")} />
        {message("message")}
      </label>
      <label className="flex items-start gap-3 text-caption">
        <input type="checkbox" name="consent" required defaultChecked={v?.consent} className="mt-0.5 size-4 accent-(--brand)" {...a11y("consent")} />
        <span>
          {scene.consent}{" "}
          <a href="/legal/privacy" target="_blank" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
            {privacyLabel}
          </a>
        </span>
      </label>
      {err("consent") ? (
        <span id="demo-consent-error" className="text-caption text-risk-600">
          {err("consent")}
        </span>
      ) : null}
      {state?.error === "rateLimited" || state?.error === "failed" ? (
        <p role="alert" className="rounded-lg bg-risk-50 px-4 py-3 text-caption font-semibold text-risk-700">
          {scene.errors[state.error]}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="h-12 rounded-pill bg-brand-600 font-bold text-brand-on shadow-raised hover:bg-brand-700 disabled:opacity-60">
        {pending ? scene.sending : scene.submit}
      </button>
    </form>
  );
}
