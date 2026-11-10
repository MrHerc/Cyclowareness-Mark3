"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, BookOpen, Check, CircleDashed, CircleSlash, Eye, Loader2, PlugZap, RotateCcw, Save, ShieldCheck, Sparkles, X } from "lucide-react";
import { generateTrainingAction, libraryTrainingAction, saveTrainingDraftAction, type TrainingInput, type TrainingResult } from "@/server/actions/ai-training";
import type { Issue, StepId, StepStatus, TrainingDraft } from "@/server/ai-verify";
import type { Scene } from "@/lib/content/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { useAction } from "@/components/ui/use-action";
import { LOCALE_NAMES, langAttrs } from "@/i18n/config";
import { cn } from "@/lib/cn";

type Option = { id: string; label: string };
type Locale = TrainingInput["locale"];
const STEP_IDS: StepId[] = ["schema", "safety", "review"];

/** Studio "Create a training with AI": prompt → generation → automatic verification → preview → save as draft. */
export function AiTrainer({ aiOn, locales, defaultLocale, categories }: { aiOn: boolean; locales: Locale[]; defaultLocale: string; categories: Option[] }) {
  const t = useTranslations("secops.aiTrainer");
  const tc = useTranslations("common");
  const [f, setF] = useState<TrainingInput>({
    prompt: "",
    locale: (locales.includes(defaultLocale as Locale) ? defaultLocale : locales[0] ?? "en") as Locale,
    category: (categories[0]?.id ?? "email") as TrainingInput["category"],
    difficulty: "Easy",
    minutes: 6,
    lessons: 1,
  });
  const [mode, setMode] = useState<"ai" | "library">("ai");
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [saved, setSaved] = useState<{ href: string } | null>(null);
  // The typed text, so "1" on the way to "15" is not clamped to 2; clamped on blur and on submit.
  const [minutes, setMinutes] = useState(String(f.minutes));
  const valid = f.prompt.trim().length >= 10;
  const generate = useAction(
    async (which: "ai" | "library", input: TrainingInput) => {
      const res = await (which === "ai" ? generateTrainingAction(input) : libraryTrainingAction(input));
      setResult(res);
      return res;
    },
    // A rate limit takes the common message; the other refusals have their own.
    { errorMap: (res) => (res.error === "rateLimited" ? undefined : t(`errors.${res.error ?? "failed"}`)) },
  );
  const saveDraft = useAction(saveTrainingDraftAction, {
    successToast: t("saved"),
    onSuccess: (res) => setSaved({ href: `/learn/${res.slug}/${res.lessonKey ?? "lesson-1"}` }),
    errorMap: () => t("errors.failed"),
  });
  const working = generate.pending;
  const saving = saveDraft.pending;

  const fixMinutes = () => {
    const n = Math.max(2, Math.min(45, Math.round(Number(minutes)) || 2));
    setMinutes(String(n));
    set("minutes", n);
    return n;
  };

  const run = (which: "ai" | "library") => {
    const input = { ...f, minutes: fixMinutes() };
    setMode(which);
    setSaved(null);
    setResult(null);
    generate.run(which, input);
  };

  // A library match keeps the language it was found in; an AI draft is written in the chosen one.
  const contentLocale = result?.source?.kind === "library" ? (result.source as { contentLocale: Locale }).contentLocale : f.locale;

  const save = () => {
    const r = result;
    if (!r?.draft || !r.source || !r.verification) return;
    saveDraft.run({ draft: r.draft, contentLocale, category: f.category, difficulty: f.difficulty, origin: r.source.kind, verdict: r.verification.verdict });
  };

  const set = <K extends keyof TrainingInput>(k: K, value: TrainingInput[K]) => setF((x) => ({ ...x, [k]: value }));

  return (
    <section id="ai" aria-labelledby="ai-trainer-title" className="scroll-mt-24 overflow-hidden rounded-2xl border border-brand-100 bg-surface shadow-xs">
      <header className="flex flex-wrap items-start gap-3 bg-brand-50 px-5 py-5 sm:px-6">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-brand-on [&_svg]:size-5">
          <Sparkles />
        </span>
        <div className="min-w-0 flex-[1_1_14rem]">
          <h2 id="ai-trainer-title" className="text-title-sm font-semibold break-words text-ink">
            {t("title")}
          </h2>
          <p className="mt-1 text-body-sm text-ink-muted">{t("subtitle")}</p>
        </div>
        <Pill tone={aiOn ? "safe" : "warn"} className="shrink-0">
          {aiOn ? t("connected") : t("notConnected")}
        </Pill>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form
          className="grid min-w-0 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !working) run(aiOn ? "ai" : "library");
          }}
        >
          <Field label={t("prompt")} htmlFor="ai-prompt" hint={t("promptHint")}>
            <Textarea id="ai-prompt" rows={4} maxLength={4000} value={f.prompt} placeholder={t("promptPlaceholder")} aria-describedby="ai-prompt-hint" onChange={(e) => set("prompt", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={t("language")} htmlFor="ai-locale">
              <Select id="ai-locale" value={f.locale} onChange={(e) => set("locale", e.target.value as Locale)}>
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("category")} htmlFor="ai-category">
              <Select id="ai-category" value={f.category} onChange={(e) => set("category", e.target.value as TrainingInput["category"])}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("difficulty")} htmlFor="ai-difficulty">
              <Select id="ai-difficulty" value={f.difficulty} onChange={(e) => set("difficulty", e.target.value as TrainingInput["difficulty"])}>
                {(["Easy", "Medium", "Hard"] as const).map((d) => (
                  <option key={d} value={d}>
                    {tc(`difficulty.${d}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("minutes")} htmlFor="ai-minutes">
              <Input id="ai-minutes" type="number" inputMode="numeric" min={2} max={45} value={minutes} onChange={(e) => setMinutes(e.target.value)} onBlur={fixMinutes} />
            </Field>
          </div>
          <div className="grid gap-1.5">
            <span id="ai-lessons-label" className="text-body-sm font-semibold text-ink">
              {t("lessons")}
            </span>
            <Segmented name="ai-lessons" ariaLabel={t("lessons")} value={String(f.lessons)} onChange={(v) => set("lessons", Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: tc("units.lessons", { count: n }) }))} />
          </div>

          {!aiOn ? (
            <div role="note" className="flex gap-3 rounded-xl border border-warn-100 bg-warn-50 p-4 text-body-sm text-warn-700">
              <PlugZap aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{t("offlineTitle")}</p>
                <p className="mt-1">{t("offlineBody")}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="primary" icon={<Sparkles />} disabled={!aiOn || !valid || working} aria-disabled={!aiOn || !valid || working} onClick={() => run("ai")} className="max-w-full">
              {t("generate")}
            </Button>
            <Button type="button" variant="secondary" icon={<BookOpen />} disabled={!valid || working} onClick={() => run("library")} className="max-w-full">
              {t("fromLibrary")}
            </Button>
          </div>
        </form>

        <aside aria-labelledby="ai-how" className="min-w-0 rounded-xl bg-sunken p-4">
          <h3 id="ai-how" className="text-body-sm font-semibold text-ink">
            {t("howTitle")}
          </h3>
          <ol className="mt-3 grid gap-3">
            {(["write", "check", "review", "publish"] as const).map((k, i) => (
              <li key={k} className="flex gap-3">
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-caption font-semibold text-brand-700 shadow-xs">
                  {i + 1}
                </span>
                <span className="min-w-0 text-caption text-ink-muted">
                  <b className="block text-ink">{t(`how.${k}`)}</b>
                  {t(`howHelp.${k}`)}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div aria-live="polite" aria-busy={working} className="empty:hidden">
        {working ? <Working mode={mode} /> : null}
        {!working && result?.verification ? (
          <div className="grid gap-5 border-t border-line p-5 sm:p-6">
            <Verdict result={result} />
            {result.draft ? (
              <>
                <Preview draft={result.draft} lang={contentLocale} />
                <div className="flex flex-wrap items-center gap-3">
                  {saved ? (
                    <ButtonLink href={saved.href} variant="primary" icon={<Eye />}>
                      {t("openPlayer")}
                    </ButtonLink>
                  ) : (
                    <Button variant="primary" icon={saving ? <Loader2 className="animate-spin" /> : <Save />} disabled={saving} onClick={save}>
                      {t("save")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    icon={<RotateCcw />}
                    onClick={() => {
                      setResult(null);
                      setSaved(null);
                    }}
                  >
                    {t("reset")}
                  </Button>
                  <p className="min-w-0 flex-[1_1_14rem] text-caption text-ink-subtle">{saved ? t("saved") : t("draftNotice")}</p>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Working({ mode }: { mode: "ai" | "library" }) {
  const t = useTranslations("secops.aiTrainer");
  return (
    <div className="flex items-center gap-3 border-t border-line p-5 text-body-sm text-ink-muted sm:p-6">
      <Loader2 aria-hidden className="size-5 shrink-0 animate-spin text-brand-600" />
      <p>{mode === "ai" ? t("generating") : t("building")}</p>
    </div>
  );
}

const STATUS_ICON: Record<StepStatus, { icon: typeof Check; tone: string }> = {
  pass: { icon: Check, tone: "bg-safe-50 text-safe-700" },
  fail: { icon: X, tone: "bg-risk-50 text-risk-700" },
  skipped: { icon: CircleSlash, tone: "bg-sunken text-ink-muted" },
};

function Verdict({ result }: { result: TrainingResult }) {
  const t = useTranslations("secops.aiTrainer");
  const v = result.verification!;
  const ok = v.verdict === "verified";
  const src = result.source;
  return (
    <div className="grid gap-4">
      <div className={cn("flex flex-wrap items-start gap-3 rounded-xl p-4", ok ? "bg-safe-50" : "bg-warn-50")}>
        <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full", ok ? "bg-safe-600 text-white" : "bg-warn-500 text-white")}>
          {ok ? <ShieldCheck className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div className="min-w-0 flex-[1_1_14rem]">
          <p className={cn("text-body font-semibold", ok ? "text-safe-700" : "text-warn-700")}>{t(`verdict.${v.verdict}`)}</p>
          <p className="mt-1 text-body-sm text-ink-muted">{t(`verdictHelp.${v.verdict}`)}</p>
          {v.attempts > 1 ? <p className="mt-1 text-caption text-ink-subtle">{t("regenerated")}</p> : null}
        </div>
        {src ? (
          <Pill tone={src.kind === "ai" ? "violet" : "cyan"} className="max-w-full">
            <span className="truncate">{src.kind === "ai" ? t("sourceAi") : t("sourceLibrary", { title: src.title })}</span>
          </Pill>
        ) : null}
      </div>
      {src?.kind === "library" ? <p className="text-caption text-ink-muted">{t("contentLanguage", { language: t(`contentLanguageName.${src.contentLocale as Locale}`) })}</p> : null}
      <ol className="grid gap-3">
        {STEP_IDS.map((id, i) => {
          const step = v.steps.find((s) => s.id === id);
          const status: StepStatus = step?.status ?? "skipped";
          const Icon = STATUS_ICON[status].icon;
          return (
            <li key={id} className="min-w-0 rounded-xl border border-line p-4">
              <div className="flex items-center gap-2">
                <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full", STATUS_ICON[status].tone)}>
                  <Icon className="size-4" />
                </span>
                <p className="min-w-0 flex-1 text-body-sm font-semibold break-words text-ink">
                  {i + 1}. {t(`steps.${id}`)}
                </p>
                <Pill tone={status === "pass" ? "safe" : status === "fail" ? "risk" : "neutral"}>{t(`status.${status}`)}</Pill>
              </div>
              <p className="mt-2 text-caption text-ink-subtle">{t(`stepHelp.${id}`)}</p>
              {step?.note ? <p className="mt-2 text-caption text-ink-muted">{t(`notes.${step.note}`)}</p> : null}
              {step?.issues.length ? (
                <>
                  <IssueList issues={step.issues.slice(0, 5)} draft={result.draft} />
                  {step.issues.length > 5 ? (
                    <details className="mt-1">
                      <summary className="flex min-h-11 cursor-pointer items-center text-caption font-semibold text-brand-700">{t("moreIssues", { count: step.issues.length - 5 })}</summary>
                      <IssueList issues={step.issues.slice(5)} draft={result.draft} />
                    </details>
                  ) : null}
                </>
              ) : step && status === "pass" ? (
                <p className="mt-2 text-caption text-safe-700">{t("issuesNone")}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A translator for keys built at run time; tests/ai-training.test.ts checks every issue code has a message. */
type LooseT = (key: string, values?: Record<string, string | number>) => string;

/** Numbered parts of a scene in a draft path ("question.options.2" is the third answer). */
const LIST_PART: Record<string, string> = { options: "option", beats: "beat", cards: "card", items: "item", pairs: "pair", spots: "spot", points: "point", nodes: "node", steps: "step", choices: "choice", actions: "action" };

/**
 * Where an issue is, in words: "Lesson 1 · Scene 4: Question · Answer 2" from a draft path
 * ("lessons.0.scenes.3.question.options.1.label") or from the reviewer's "lesson id/scene id".
 * Null when the reference names nothing in the draft: the issue text is shown alone, never a raw path.
 */
function locate(where: string | undefined, draft: TrainingDraft | undefined, t: LooseT): string | null {
  if (!where) return null;
  const scene = (li: number, si: number) => {
    const s = draft?.lessons[li]?.scenes[si];
    return s ? t("where.sceneOf", { n: si + 1, type: t(`scene.${s.type}`) }) : t("where.scene", { n: si + 1 });
  };
  const ref = /^([^/\s.]+)\/([^/\s]+)$/.exec(where.trim());
  if (ref) {
    let li = draft?.lessons.findIndex((l) => l.id === ref[1]) ?? -1;
    // The reviewer sometimes numbers the lessons ("lesson-2") instead of using their ids.
    const numbered = /^lesson-?(\d+)$/i.exec(ref[1]);
    if (li < 0 && numbered && draft?.lessons[Number(numbered[1]) - 1]) li = Number(numbered[1]) - 1;
    if (li < 0) return null;
    const si = draft!.lessons[li].scenes.findIndex((s) => s.id === ref[2]);
    return si < 0 ? t("where.lesson", { n: li + 1 }) : `${t("where.lesson", { n: li + 1 })} · ${scene(li, si)}`;
  }
  const seg = where.split(".");
  if (seg.length === 1) {
    if (seg[0] === "title" || seg[0] === "subtitle") return t(`where.${seg[0]}`);
    // "lessons": too few or too many lessons (the array itself, not one of its items).
    if (seg[0] === "lessons") return t("where.lessons");
    // A bare scene id from the reviewer.
    for (const [li, l] of (draft?.lessons ?? []).entries()) {
      const si = l.scenes.findIndex((s) => s.id === where.trim());
      if (si >= 0) return `${t("where.lesson", { n: li + 1 })} · ${scene(li, si)}`;
    }
  }
  const parts: string[] = [];
  let li = -1;
  for (let i = 0; i < seg.length; i++) {
    const n = Number(seg[i + 1]);
    const numbered = seg[i + 1] !== undefined && Number.isInteger(n);
    if (seg[i] === "lessons" && numbered) {
      li = n;
      parts.push(t("where.lesson", { n: n + 1 }));
      i++;
    } else if (seg[i] === "scenes" && numbered) {
      parts.push(scene(li, n));
      i++;
    } else if (LIST_PART[seg[i]] && numbered) {
      parts.push(t(`where.${LIST_PART[seg[i]]}`, { n: n + 1 }));
      i++;
    } else if (seg[i] === "artifact") parts.push(t("where.artifact"));
    else if (seg[i] === "title" && parts.length) parts.push(t("where.titleField"));
  }
  return parts.length ? parts.join(" · ") : null;
}

function IssueList({ issues, draft }: { issues: Issue[]; draft?: TrainingDraft }) {
  const t = useTranslations("secops.aiTrainer");
  const loose = t as unknown as LooseT;
  return (
    <ul className="mt-2 grid gap-1.5">
      {issues.map((issue, k) => {
        const where = locate(issue.where, draft, loose);
        return (
          <li key={k} className="flex items-start gap-2 text-caption">
            <Pill tone={issue.severity === "blocking" ? "risk" : "warn"} className="shrink-0">
              {t(`severity.${issue.severity}`)}
            </Pill>
            <span className="min-w-0 break-words text-ink-muted [overflow-wrap:anywhere]">
              {issue.code ? loose(`issues.${issue.code}`, issue.params) : issue.message}
              {where ? <span className="block text-ink-subtle">{where}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Preview({ draft, lang }: { draft: TrainingDraft; lang: string }) {
  const t = useTranslations("secops.aiTrainer");
  const tc = useTranslations("common");
  return (
    <div className="grid gap-3">
      {/* The draft is in its content language; the labels around it stay in the console's. */}
      <div {...langAttrs(lang)}>
        <h3 className="text-body font-semibold break-words text-ink">{draft.title}</h3>
        {draft.subtitle ? <p className="mt-1 text-body-sm text-ink-muted">{draft.subtitle}</p> : null}
      </div>
      {draft.lessons.map((l, li) => (
        <details key={l.id + li} open={li === 0} className="group rounded-xl border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2 text-body-sm font-semibold text-ink">
            <CircleDashed aria-hidden className="size-4 shrink-0 text-brand-600 group-open:hidden" />
            <Check aria-hidden className="hidden size-4 shrink-0 text-brand-600 group-open:block" />
            <span className="min-w-0 flex-1 break-words">
              {t("lessonN", { n: li + 1 })} · <span {...langAttrs(lang)}>{l.title}</span>
            </span>
            <span className="shrink-0 text-caption font-normal text-ink-subtle">{tc("units.min", { count: l.minutes })}</span>
          </summary>
          <ol className="grid gap-2 border-t border-line p-4">
            {l.scenes.map((s, si) => (
              <li key={s.id + si} className="grid gap-1 rounded-lg bg-sunken p-3">
                <Pill tone="brand" className="w-fit">
                  {t(`scene.${s.type}`)}
                </Pill>
                <div {...langAttrs(lang)}>
                  <SceneOutline scene={s} />
                </div>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

function SceneOutline({ scene: s }: { scene: Scene }) {
  const t = useTranslations("secops.aiTrainer");
  const text = "text-caption text-ink-muted break-words";
  switch (s.type) {
    case "intro":
      return (
        <p className={text}>
          <b className="text-ink">{s.title}</b> {s.body}
        </p>
      );
    case "tutor":
      return (
        <ul className="grid list-disc gap-1 ps-5">
          {s.beats.map((b) => (
            <li key={b.id} className={text}>
              {b.say}
            </li>
          ))}
        </ul>
      );
    case "choice":
      return (
        <div className="grid gap-1">
          <p className="text-caption font-semibold break-words text-ink">{s.question.prompt}</p>
          <ul className="grid gap-1">
            {s.question.options.map((o) => (
              <li key={o.id} className={cn("flex gap-2", text, o.correct && "font-semibold text-safe-700")}>
                {o.correct ? <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-subtle" />}
                <span className="min-w-0">
                  {o.label}
                  {o.correct ? <span className="sr-only"> ({t("correct")})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "swipe":
      return (
        <div className="grid gap-1">
          <p className="text-caption font-semibold break-words text-ink">{s.prompt}</p>
          <ul className="grid gap-1">
            {s.cards.map((c) => (
              <li key={c.id} className={cn("flex items-start gap-2", text)}>
                <Pill tone={c.verdict === "threat" ? "risk" : "safe"} className="shrink-0">
                  {t(`verdictCard.${c.verdict}`)}
                </Pill>
                <span className="min-w-0">{c.explain}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "order":
      return (
        <div className="grid gap-1">
          <p className="text-caption font-semibold break-words text-ink">{s.prompt}</p>
          <ol className="grid list-decimal gap-1 ps-5">
            {s.items.map((i) => (
              <li key={i.id} className={text}>
                {i.label}
              </li>
            ))}
          </ol>
        </div>
      );
    case "match":
      return (
        <div className="grid gap-1">
          <p className="text-caption font-semibold break-words text-ink">{s.prompt}</p>
          <ul className="grid gap-1">
            {s.pairs.map((p) => (
              <li key={p.id} className={text}>
                {p.left} <span className="inline-block rtl:-scale-x-100">→</span> {p.right}
              </li>
            ))}
          </ul>
        </div>
      );
    case "hotspot":
      return (
        <div className="grid gap-1">
          <p className="text-caption font-semibold break-words text-ink">{s.prompt}</p>
          <p className={text}>{s.spots.map((p) => p.label).join(" · ")}</p>
        </div>
      );
    case "recap":
      return (
        <ul className="grid list-disc gap-1 ps-5">
          {s.points.map((p, i) => (
            <li key={i} className={text}>
              {p}
            </li>
          ))}
        </ul>
      );
    case "simulation":
    case "scenario":
      return <p className={text}>{s.title}</p>;
    case "password":
      return <p className={text}>{s.prompt}</p>;
  }
}
