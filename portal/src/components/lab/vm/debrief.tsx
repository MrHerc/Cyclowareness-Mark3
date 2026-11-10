"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, CircleDashed, Lightbulb, Loader2, RotateCcw, ShieldAlert, ShieldCheck, Timer, Zap } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ring } from "@/components/ui/progress";
import type { VmLabResult } from "@/server/lab/vm-action";
import { HINT_COST, type LabDef, type LabScore } from "../model/labs";

/** Where the debrief's second button leads: the lab list by default, a mini-lab's module page. */
export type DebriefBack = { href: string; label: string };
export type DebriefTexts = { title: string; objective: (id: string) => string; why: (id: string) => string; rule: (id: string) => string; ruleWhy: (id: string) => string };

/** After the lab: the score, what was found and missed and why it matters, the risky actions, the hints. */
export function Debrief<S>({ def, score, hints, texts, notes, result, pending, elapsed, back, onAgain }: { def: LabDef<S>; score: LabScore; hints: number; texts: DebriefTexts; notes: string[]; result: VmLabResult | null; pending: boolean; elapsed: string; back?: DebriefBack; onAgain: () => void }) {
  const t = useTranslations("learner.lab.vm.debrief");
  const tl = useTranslations("learner.lab");
  const found = def.objectives.filter((o) => score.achieved.includes(o.id));
  const missed = def.objectives.filter((o) => !score.achieved.includes(o.id));
  const risky = def.rules.filter((r) => score.broken.includes(r.id));
  const verdict = score.score >= 85 ? "great" : score.score >= 55 ? "good" : "low";
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-5 border-b border-line bg-gradient-to-br from-brand-50 to-surface p-5 sm:p-7">
        <Ring value={score.score / score.max} size={112} stroke={10} tone={score.score >= 55 ? "brand" : "reward"} label={t("scoreLabel", { score: score.score, max: score.max })}>
          <span className="grid justify-items-center">
            <span className="text-numeral font-bold tabular-nums">{score.score}</span>
            <span className="text-tab-sm text-ink-subtle">/ {score.max}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-[1_1_16rem]">
          <p className="text-caption font-semibold tracking-wide text-brand-700 uppercase">
            {t("title")} · {texts.title}
          </p>
          <h2 className="mt-1 text-title font-bold text-balance">{t(`verdict.${verdict}`)}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-1.5 text-caption font-semibold tabular-nums">
              <Timer className="size-4 text-ink-subtle" aria-hidden />
              {t("time", { time: elapsed })}
            </span>
            {pending || !result ? (
              <span role="status" className="inline-flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-1.5 text-caption text-ink-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("saving")}
              </span>
            ) : "error" in result ? (
              <span role="status" className="rounded-pill bg-risk-50 px-3 py-1.5 text-caption text-risk-700">
                {t("error")}
              </span>
            ) : result.xp > 0 ? (
              <span role="status" className="inline-flex items-center gap-1.5 rounded-pill bg-reward-100 px-3 py-1.5 text-caption font-bold text-reward-ink">
                <Zap className="size-4 fill-reward-500 text-reward-600" aria-hidden />
                {t("xp", { xp: result.xp })}
              </span>
            ) : (
              <span role="status" className="rounded-pill bg-sunken px-3 py-1.5 text-caption text-ink-muted">
                {t("noXp")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-2">
        <section aria-labelledby="db-found">
          <h3 id="db-found" className="flex items-center gap-2 text-body font-bold text-safe-700">
            <CheckCircle2 className="size-5" aria-hidden />
            {t("found")}
          </h3>
          {found.length ? (
            <ul className="mt-3 grid gap-2.5">
              {found.map((o) => (
                <li key={o.id} className="rounded-lg border border-safe-100 bg-safe-50/60 p-3.5">
                  <p className="flex items-start justify-between gap-3 text-body-sm font-semibold">
                    <span>{texts.objective(o.id)}</span>
                    <span className="shrink-0 text-safe-700 tabular-nums">+{o.points}</span>
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">{texts.why(o.id)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-caption text-ink-muted">{t("nothingFound")}</p>
          )}
        </section>
        <section aria-labelledby="db-missed">
          <h3 id="db-missed" className="flex items-center gap-2 text-body font-bold text-warn-700">
            <CircleDashed className="size-5" aria-hidden />
            {t("missed")}
          </h3>
          {missed.length ? (
            <ul className="mt-3 grid gap-2.5">
              {missed.map((o) => (
                <li key={o.id} className="rounded-lg border border-warn-100 bg-warn-50/60 p-3.5">
                  <p className="flex items-start justify-between gap-3 text-body-sm font-semibold">
                    <span>{texts.objective(o.id)}</span>
                    <span className="shrink-0 text-ink-subtle tabular-nums">+{o.points}</span>
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">{texts.why(o.id)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg bg-safe-50 p-3.5 text-caption text-safe-700">{t("nothingMissed")}</p>
          )}
        </section>
        {/* A lab without rules (a mini-lab) has no risky actions to list. */}
        <section aria-labelledby="db-risky" className="md:col-span-2" hidden={!def.rules.length}>
          <h3 id="db-risky" className="flex items-center gap-2 text-body font-bold text-risk-700">
            <ShieldAlert className="size-5" aria-hidden />
            {t("risky")}
          </h3>
          {risky.length ? (
            <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
              {risky.map((r) => (
                <li key={r.id} className="rounded-lg border border-risk-100 bg-risk-50/70 p-3.5">
                  <p className="flex items-start justify-between gap-3 text-body-sm font-semibold text-risk-700">
                    <span>{texts.rule(r.id)}</span>
                    <span className="shrink-0 tabular-nums">−{r.penalty}</span>
                  </p>
                  <p className="mt-1 text-caption text-ink-muted">{texts.ruleWhy(r.id)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-safe-50 p-3.5 text-caption text-safe-700">
              <ShieldCheck className="size-4.5 shrink-0" aria-hidden />
              {t("noRisky")}
            </p>
          )}
          {notes.map((n) => (
            <p key={n} className="mt-2.5 rounded-lg bg-sunken p-3.5 text-caption text-ink-muted">
              {n}
            </p>
          ))}
          {hints ? (
            <p className="mt-2.5 flex items-center gap-2 text-caption text-ink-muted">
              <Lightbulb className="size-4 shrink-0 text-reward-600" aria-hidden />
              {t("hintsUsed", { count: hints, points: hints * HINT_COST })}
            </p>
          ) : null}
        </section>
      </div>
      <div className="flex flex-wrap justify-center gap-3 border-t border-line p-5">
        <Button variant="secondary" icon={<RotateCcw />} onClick={onAgain}>
          {t("again")}
        </Button>
        <ButtonLink href={back?.href ?? "/lab"}>{back?.label ?? tl("backToLab")}</ButtonLink>
      </div>
    </Card>
  );
}
