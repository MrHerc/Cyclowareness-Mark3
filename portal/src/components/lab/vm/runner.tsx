"use client";

import { useCallback, useEffect, useEffectEvent, useReducer, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { completeVmLabAction, type VmLabResult } from "@/server/lab/vm-action";
import { cn } from "@/lib/cn";
import { HINT_COST, scoreRun, startRun, step, type LabDef, type LabEvent, type LabRun } from "../model/labs";
import { initialWm, wmReducer, type WmAction, type WmState } from "../model/wm";
import { Debrief, type DebriefTexts } from "./debrief";
import { formatElapsed, useMedia, useSeconds, useStill } from "./hooks";
import { LabPanel } from "./panel";
import { VmShell, type VmApp } from "./vm-shell";

export type LabCtx<S> = { run: LabRun<S>; send: (e: LabEvent) => void; wm: WmState; act: (a: WmAction) => void };
export type LabTexts = DebriefTexts & { brief: string; hints: string[] };

type Toast = { id: number; text: string; tone: "ok" | "risk" };

/**
 * Runs one virtual-machine lab: boots the machine (after hydration, so nothing time- or screen-dependent
 * renders on the server), keeps the event log, the window manager, the timer and the hints, finishes when
 * the lab's goal is met or the learner ends it, and sends the log to the server for the stored result.
 */
export function LabRunner<S>({ def, texts, host, apps, notes, onAgain }: { def: LabDef<S>; texts: LabTexts; host: string; apps: (ctx: LabCtx<S>) => VmApp[]; notes?: (s: S) => string[]; onAgain: () => void }) {
  const t = useTranslations("learner.lab.vm");
  const still = useStill();
  const phone = useMedia("(max-width: 639.98px)");
  const [run, setRun] = useState(() => startRun(def));
  const [wm, act] = useReducer(wmReducer, def.primary, initialWm);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [result, setResult] = useState<VmLabResult | null>(null);
  const [pending, startSave] = useTransition();
  const [seen, setSeen] = useState<{ achieved: string[]; broken: string[]; toast: Toast | null }>({ achieved: [], broken: [], toast: null });
  const now = useSeconds();
  const top = useRef<HTMLDivElement>(null);

  const send = useCallback((e: LabEvent) => setRun((r) => step(def, r, e)), [def]);

  // Boot screen: a short start-up in full motion, none in Still.
  useEffect(() => {
    if (startedAt !== null) return;
    const id = window.setTimeout(() => setStartedAt(Date.now()), still ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [still, startedAt]);

  // Objective and rule changes become a toast on the machine and an announcement for screen readers.
  const achieved = def.achieved(run.s);
  const broken = def.broken(run.s);
  const newRule = broken.find((b) => !seen.broken.includes(b));
  const newGoal = achieved.find((a) => !seen.achieved.includes(a));
  if (newRule || newGoal) {
    const text = newRule ? t("panel.brokenLive", { name: texts.rule(newRule) }) : t("panel.achievedLive", { name: texts.objective(newGoal!) });
    setSeen({ achieved, broken, toast: { id: (seen.toast?.id ?? 0) + 1, text, tone: newRule ? "risk" : "ok" } });
  }
  const toastId = seen.toast?.id;
  useEffect(() => {
    if (!toastId) return;
    const id = window.setTimeout(() => setSeen((s) => (s.toast?.id === toastId ? { ...s, toast: null } : s)), 3400);
    return () => window.clearTimeout(id);
  }, [toastId]);

  const finish = () => {
    if (endedAt !== null) return;
    setEndedAt(Date.now());
    startSave(async () => {
      try {
        setResult(await completeVmLabAction(def.id, run.events));
      } catch {
        setResult({ error: "invalid" });
      }
    });
  };
  const finishWhenDone = useEffectEvent(finish);
  useEffect(() => {
    if (!run.done) return;
    const id = window.setTimeout(() => finishWhenDone(), still ? 400 : 1400);
    return () => window.clearTimeout(id);
  }, [run.done, still]);
  useEffect(() => {
    if (endedAt !== null) top.current?.focus({ preventScroll: false });
  }, [endedAt]);

  const elapsedSec = startedAt ? Math.max(0, ((endedAt ?? now * 1000) - startedAt) / 1000) : 0;

  if (endedAt !== null) {
    const score = scoreRun(def, run);
    return (
      <div ref={top} tabIndex={-1} className="scroll-mt-24 outline-none">
        <Debrief def={def} score={score} hints={run.hints} texts={texts} notes={notes?.(run.s) ?? []} result={result} pending={pending} elapsed={formatElapsed(elapsedSec)} onAgain={onAgain} />
      </div>
    );
  }

  if (startedAt === null) {
    return (
      <div role="status" className={cn("grid place-items-center rounded-[1.4rem] bg-[#0f1222] p-3 shadow-overlay", phone ? "h-[34rem]" : "h-[clamp(32rem,calc(100dvh-17rem),44rem)]")}>
        <div className="grid justify-items-center gap-4 text-white">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Loader2 className="size-7 animate-spin text-[#a5b4fc]" aria-hidden />
          </span>
          <p className="text-caption font-medium text-white/85">{t("boot")}</p>
          <span aria-hidden className="h-1 w-40 overflow-hidden rounded-pill bg-white/10">
            <span className="block h-full w-1/2 animate-shimmer rounded-pill bg-[#a5b4fc]" />
          </span>
        </div>
      </div>
    );
  }

  const panel = (
    <LabPanel
      brief={texts.brief}
      objectives={def.objectives.map((o) => ({ id: o.id, label: texts.objective(o.id), points: o.points, done: achieved.includes(o.id), secret: o.secret }))}
      rules={def.rules.map((r) => ({ id: r.id, label: texts.rule(r.id), penalty: r.penalty, broken: broken.includes(r.id) }))}
      hints={texts.hints.slice(0, run.hints)}
      hintsTotal={Math.min(def.hints, texts.hints.length)}
      hintCost={HINT_COST}
      onHint={() => send(["hint"])}
      elapsed={formatElapsed(elapsedSec)}
      onFinish={finish}
      announce={seen.toast?.text ?? ""}
      className={phone ? "min-h-full" : "rounded-xl border border-line shadow-xs"}
    />
  );
  const done = achieved.length;
  return (
    <div className={cn("grid grid-cols-1 gap-5", !phone && "lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]")}>
      <div className="relative min-w-0">
        <VmShell apps={apps({ run, send, wm, act })} wm={wm} act={act} panel={panel} phone={phone} host={host} label={t("screen")} tasksBadge={`${done}/${def.objectives.length}`} />
        {seen.toast ? (
          <div key={seen.toast.id} aria-hidden className={cn("pointer-events-none absolute top-6 left-1/2 z-[60] flex max-w-[calc(100%-2rem)] -translate-x-1/2 animate-rise items-center gap-2 rounded-pill px-4 py-2 text-caption font-semibold shadow-overlay", seen.toast.tone === "ok" ? "bg-safe-600 text-white" : "bg-risk-600 text-white", phone && "top-auto bottom-20")}>
            {seen.toast.tone === "ok" ? <CheckCircle2 className="size-4.5 shrink-0" /> : <ShieldAlert className="size-4.5 shrink-0" />}
            <span className="truncate">{seen.toast.text}</span>
          </div>
        ) : null}
      </div>
      {phone ? null : panel}
    </div>
  );
}
