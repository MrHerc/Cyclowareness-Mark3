"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, Flag, Lightbulb, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

export type PanelObjective = { id: string; label: string; points: number; done: boolean; secret?: boolean };
export type PanelRule = { id: string; label: string; penalty: number; broken: boolean };

/** The mission beside the machine: briefing, objectives that tick as they are reached, rules, hints, the timer. */
export function LabPanel({
  brief,
  objectives,
  rules,
  hints,
  hintsTotal,
  hintCost,
  onHint,
  elapsed,
  onFinish,
  announce,
  lang,
  className,
}: {
  brief: string;
  objectives: PanelObjective[];
  rules: PanelRule[];
  hints: string[];
  hintsTotal: number;
  hintCost: number;
  onHint: () => void;
  elapsed: string;
  onFinish: () => void;
  announce: string;
  /** The language of the brief and objectives when it is not the page's (a mini-lab shown in English). */
  lang?: string;
  className?: string;
}) {
  const t = useTranslations("learner.lab.vm.panel");
  const [confirm, setConfirm] = useState(false);
  const done = objectives.filter((o) => o.done).length;
  const left = hintsTotal - hints.length;
  return (
    <aside className={cn("grid content-start gap-4 bg-surface p-4", className)} aria-label={t("title")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-body font-bold">{t("title")}</h2>
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-1 font-mono text-caption font-semibold tabular-nums" aria-label={`${t("elapsed")} ${elapsed}`}>
          <Timer className="size-4 text-ink-subtle" aria-hidden />
          {elapsed}
        </span>
      </div>
      <p lang={lang} className="rounded-lg bg-brand-50 px-3.5 py-3 text-caption text-brand-900">
        {brief}
      </p>

      <section aria-labelledby="lab-objectives">
        <div className="flex items-baseline justify-between">
          <h3 id="lab-objectives" className="text-caption font-bold tracking-wide text-ink-muted uppercase">
            {t("objectives")}
          </h3>
          <span className="text-caption font-semibold tabular-nums text-ink-muted">
            {done}/{objectives.length}
          </span>
        </div>
        <ul className="mt-2 grid gap-1.5">
          {objectives.map((o) => (
            <li key={o.id} className={cn("flex items-start gap-2.5 rounded-md px-2.5 py-2 text-caption transition-colors", o.done ? "bg-safe-50 text-safe-700" : "text-ink")}>
              {o.done ? <CheckCircle2 className="mt-px size-4.5 shrink-0 animate-rise" aria-hidden /> : o.secret ? <Flag className="mt-px size-4.5 shrink-0 text-ink-disabled" aria-hidden /> : <Circle className="mt-px size-4.5 shrink-0 text-ink-disabled" aria-hidden />}
              <span className={cn("min-w-0 flex-1", o.secret && !o.done && "text-ink-subtle italic")}>
                <span className="sr-only">{o.done ? t("doneSr") : t("todoSr")} </span>
                {o.secret && !o.done ? t("secret") : <span lang={lang}>{o.label}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums opacity-80">{t("plus", { points: o.points })}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* A mini-lab has neither rules nor hints. */}
      <section aria-labelledby="lab-rules" hidden={!rules.length}>
        <h3 id="lab-rules" className="text-caption font-bold tracking-wide text-ink-muted uppercase">
          {t("rules")}
        </h3>
        <ul className="mt-2 grid gap-1.5">
          {rules.map((r) => (
            <li key={r.id} className={cn("flex items-start gap-2.5 rounded-md px-2.5 py-2 text-caption", r.broken ? "bg-risk-50 text-risk-700" : "text-ink")}>
              {r.broken ? <ShieldAlert className="mt-px size-4.5 shrink-0" aria-hidden /> : <ShieldCheck className="mt-px size-4.5 shrink-0 text-safe-600" aria-hidden />}
              <span className="min-w-0 flex-1">{r.label}</span>
              <span className="shrink-0 font-semibold">{r.broken ? t("broken") : t("kept")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lab-hints" hidden={!hintsTotal}>
        <h3 id="lab-hints" className="text-caption font-bold tracking-wide text-ink-muted uppercase">
          {t("hints")}
        </h3>
        {hints.length ? (
          <ol className="mt-2 grid gap-1.5">
            {hints.map((h, i) => (
              <li key={i} className="flex animate-rise gap-2 rounded-md bg-reward-100 px-2.5 py-2 text-caption text-reward-ink">
                <Lightbulb className="mt-px size-4 shrink-0" aria-hidden />
                <span>{h}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <Button variant="secondary" size="sm" className="mt-2 w-full" icon={<Lightbulb />} disabled={left <= 0} onClick={onHint}>
          {left > 0 ? t("hint", { cost: hintCost }) : t("noHints")}
        </Button>
        <p className="mt-1.5 text-center text-tab-sm text-ink-subtle">{t("hintsLeft", { count: left })}</p>
      </section>

      <Button variant="primary" className="w-full" onClick={() => setConfirm(true)}>
        {t("finish")}
      </Button>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("finishTitle")}
        description={done < objectives.length ? t("finishBody") : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t("keepGoing")}
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                onFinish();
              }}
            >
              {t("finishConfirm")}
            </Button>
          </>
        }
      />
    </aside>
  );
}
