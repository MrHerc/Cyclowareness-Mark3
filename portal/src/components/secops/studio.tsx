"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Copy, Eye, Pencil, Plus, Send, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  createMaterialAction,
  deleteModuleAction,
  deletePathAction,
  draftLessonAction,
  savePathAction,
  saveStudioLessonAction,
  setModuleStatusAction,
  updateStudioLessonAction,
} from "@/server/actions/secops";
import type { LessonDraft } from "@/server/ai";
import { markTargets } from "@/lib/content/studio";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { LOCALE_NAMES, langAttrs } from "@/i18n/config";
import type { Category } from "@/lib/domain/catalog";
import type { LabId } from "@/lib/domain/labs";
import { searchFold } from "./search-fold";

type Option = { id: string; label: string };
const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

/* ───────── own lessons ───────── */

type Card = { from: string; text: string; verdict: "threat" | "safe"; explain: string };
type Target = { text: string; label: string; explain: string };
const card = (verdict: Card["verdict"]): Card => ({ from: "", text: "", verdict, explain: "" });
const target = (): Target => ({ text: "", label: "", explain: "" });
const filledCards = (cards: Card[]) => cards.filter((c) => c.from.trim() && c.text.trim().length >= 3 && c.explain.trim().length >= 3);
const filledTargets = (targets: Target[]) => targets.filter((x) => x.text.trim() && x.label.trim() && x.explain.trim().length >= 3);
/** Empty rows to fill in, after the given ones. */
const slots = <T,>(given: T[], min: number, empty: () => T) => [...given, ...Array.from({ length: Math.max(0, min - given.length) }, empty)];

/** A saved Studio lesson, to edit: its draft and settings. */
export type StudioLessonInitial = LessonDraft & { locale: string; category: string; difficulty: "Easy" | "Medium" | "Hard"; minutes: number };

/** After a publish, or an edit of a published lesson: which of the organisation's languages got a translation and which did not. */
function translationToast(t: ReturnType<typeof useTranslations<"secops.studio">>, res: { translated?: string[]; untranslated?: string[]; offline?: boolean }, done: string) {
  const names = (list: string[]) => list.map((l) => LOCALE_NAMES[l as "az"] ?? l).join(", ");
  if (res.offline) return toast(t("sourceOnly"), "info", 8000);
  if (res.untranslated?.length) return toast(t("untranslated", { languages: names(res.untranslated) }), "info", 8000);
  toast(res.translated?.length ? t("translated", { languages: names(res.translated) }) : done);
}

/** Without `edit`, the "New lesson" button and an empty form; with it, an "Edit" button and the saved lesson. */
export function StudioLessonForm({
  locales,
  defaultLocale,
  categories,
  aiOn,
  edit,
}: {
  locales: string[];
  defaultLocale: string;
  categories: Option[];
  aiOn: boolean;
  edit?: { id: string; initial: StudioLessonInitial; published: boolean };
}) {
  const t = useTranslations("secops.studio");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [topic, setTopic] = useState("");
  const [fromAi, setFromAi] = useState(false);
  const fromDraft = (d: LessonDraft) => ({
    title: d.title,
    subtitle: d.subtitle,
    intro: d.intro,
    points: d.points.join("\n"),
    prompt: d.question.prompt,
    options: slots(d.question.options, 3, () => ({ label: "", correct: false, feedback: "" })),
    recap: d.recap.join("\n"),
    // An AI draft has no exercises: the ones already written stay.
    ...(d.swipe ? { swipeOn: true, swipe: { prompt: d.swipe.prompt, cards: slots(d.swipe.cards, 4, () => card("safe")) } } : {}),
    ...(d.hotspot ? { hotspotOn: true, hotspot: { ...d.hotspot, targets: slots(d.hotspot.targets, 3, target) } } : {}),
  });
  const blank = {
    locale: defaultLocale,
    title: "",
    subtitle: "",
    category: categories[0]?.id ?? "email",
    difficulty: "Easy" as "Easy" | "Medium" | "Hard",
    minutes: 4,
    intro: "",
    points: "",
    prompt: "",
    options: [
      { label: "", correct: true, feedback: "" },
      { label: "", correct: false, feedback: "" },
      { label: "", correct: false, feedback: "" },
    ],
    recap: "",
    swipeOn: false,
    swipe: { prompt: "", cards: [card("threat"), card("safe"), card("threat"), card("safe")] },
    hotspotOn: false,
    hotspot: { prompt: "", from: "", subject: "", body: "", targets: [target(), target(), target()] },
  };
  const initial = edit
    ? { ...blank, ...fromDraft(edit.initial), locale: edit.initial.locale, category: edit.initial.category, difficulty: edit.initial.difficulty, minutes: edit.initial.minutes }
    : blank;
  const [f, setF] = useState(initial);
  // The lesson fields are written in the lesson's language, which can differ from the console's.
  const content = langAttrs(f.locale);
  const cards = filledCards(f.swipe.cards);
  const targets = filledTargets(f.hotspot.targets);
  const swipeValid = f.swipe.prompt.trim().length >= 5 && cards.length >= 2 && cards.some((c) => c.verdict === "threat");
  const hotspotValid =
    f.hotspot.prompt.trim().length >= 5 &&
    f.hotspot.from.trim().length >= 3 &&
    f.hotspot.subject.trim() !== "" &&
    f.hotspot.body.trim().length >= 10 &&
    targets.length >= 1 &&
    markTargets(f.hotspot.body.trim(), targets.map((x) => ({ text: x.text.trim() }))) !== null;
  const valid =
    f.title.trim().length >= 3 &&
    f.intro.trim().length >= 10 &&
    lines(f.points).length >= 2 &&
    f.prompt.trim().length >= 5 &&
    f.options.filter((o) => o.label.trim() && o.feedback.trim()).length >= 2 &&
    f.options.filter((o) => o.correct && o.label.trim()).length === 1 &&
    lines(f.recap).length >= 2 &&
    (!f.swipeOn || swipeValid) &&
    (!f.hotspotOn || hotspotValid);

  const draft = () =>
    startDraft(async () => {
      const res = await draftLessonAction(topic, f.locale);
      if (!res.ok || !res.draft) return toast(res.error === "offline" ? t("form.aiOffline") : res.error === "rateLimited" ? tc("errors.rateLimited") : t("form.aiFailed"), "error");
      setF({ ...f, ...fromDraft(res.draft) });
      setFromAi(true);
      toast(t("form.aiDone"));
    });

  const save = () =>
    start(async () => {
      const options = f.options.filter((o) => o.label.trim() && o.feedback.trim()).map((o) => ({ label: o.label.trim(), correct: o.correct, feedback: o.feedback.trim() }));
      const input = {
        locale: f.locale as "az",
        title: f.title.trim(),
        subtitle: f.subtitle.trim(),
        category: f.category as Category,
        difficulty: f.difficulty,
        minutes: f.minutes,
        intro: f.intro.trim(),
        points: lines(f.points),
        question: { prompt: f.prompt.trim(), options },
        recap: lines(f.recap),
        swipe: f.swipeOn ? { prompt: f.swipe.prompt.trim(), cards: cards.map((c) => ({ from: c.from.trim(), text: c.text.trim(), verdict: c.verdict, explain: c.explain.trim() })) } : undefined,
        hotspot: f.hotspotOn
          ? {
              prompt: f.hotspot.prompt.trim(),
              from: f.hotspot.from.trim(),
              subject: f.hotspot.subject.trim(),
              body: f.hotspot.body.trim(),
              targets: targets.map((x) => ({ text: x.text.trim(), label: x.label.trim(), explain: x.explain.trim() })),
            }
          : undefined,
        ai: fromAi,
      };
      if (edit) {
        const res = await updateStudioLessonAction(edit.id, input);
        if (!res.ok) return toast(tc("errors.invalid"), "error");
        translationToast(t, res, t("updated"));
        setOpen(false);
        return;
      }
      const res = await saveStudioLessonAction(input);
      if (!res.ok) return toast(tc("errors.invalid"), "error");
      toast(t("saved"));
      setOpen(false);
      setF(blank);
      setTopic("");
      setFromAi(false);
    });

  const setCard = (i: number, patch: Partial<Card>) => setF({ ...f, swipe: { ...f.swipe, cards: f.swipe.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) } });
  const setTarget = (i: number, patch: Partial<Target>) => setF({ ...f, hotspot: { ...f.hotspot, targets: f.hotspot.targets.map((x, j) => (j === i ? { ...x, ...patch } : x)) } });
  const title = edit ? t("editLesson") : t("newLesson");
  // Unsaved changes of an edit are dropped on close: reopening shows the saved lesson.
  const close = () => {
    setOpen(false);
    if (edit) setF(initial);
  };
  const signs = f.hotspot.targets.map((x) => x.text.trim());

  return (
    <>
      {edit ? (
        <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setOpen(true)}>
          {t("edit")}
        </Button>
      ) : (
        <Button icon={<Plus />} onClick={() => setOpen(true)}>
          {t("newLesson")}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={close}
        title={title}
        size="xl"
        footer={
          <>
            <span role="status" className="me-auto text-caption text-ink-muted">
              {pending && edit?.published ? t("translating") : null}
            </span>
            <Button variant="ghost" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button onClick={save} disabled={pending || !valid}>
              {edit ? t("form.update") : t("form.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-3 rounded-xl bg-violet-50 p-4">
            <Field label={t("form.aiTopic")} htmlFor="st-topic">
              <Textarea id="st-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("form.aiTopicPlaceholder")} className="min-h-20 bg-surface" maxLength={2000} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" icon={<Sparkles />} onClick={draft} disabled={drafting || topic.trim().length < 5}>
                {drafting ? t("form.aiWorking") : t("form.aiDraft")}
              </Button>
              {!aiOn ? <span className="text-caption text-ink-muted">{t("form.aiOffline")}</span> : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={t("form.language")} htmlFor="st-lang">
              <Select id="st-lang" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_NAMES[l as "az"]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("form.category")} htmlFor="st-cat">
              <Select id="st-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("form.difficulty")} htmlFor="st-diff">
              <Select id="st-diff" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value as "Easy" })}>
                {(["Easy", "Medium", "Hard"] as const).map((d) => (
                  <option key={d} value={d}>
                    {tc(`difficulty.${d}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("form.minutes")} htmlFor="st-min">
              <Input id="st-min" type="number" min={1} max={30} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.title")} htmlFor="st-title">
              <Input id="st-title" {...content} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
            </Field>
            <Field label={t("form.subtitle")} htmlFor="st-sub">
              <Input id="st-sub" {...content} value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} maxLength={200} />
            </Field>
          </div>
          <Field label={t("form.intro")} htmlFor="st-intro">
            <Textarea id="st-intro" {...content} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} maxLength={1200} />
          </Field>
          <Field label={t("form.points")} htmlFor="st-points" hint={t("form.pointsHint")}>
            <Textarea id="st-points" {...content} value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} className="min-h-32" />
          </Field>
          <div className="grid gap-3 rounded-xl border border-line p-4">
            <Switch label={t("form.swipe")} description={t("form.swipeHint")} checked={f.swipeOn} onChange={(e) => setF({ ...f, swipeOn: e.target.checked })} />
            {f.swipeOn ? (
              <>
                <Input aria-label={t("form.exercisePrompt")} placeholder={t("form.exercisePrompt")} {...content} value={f.swipe.prompt} onChange={(e) => setF({ ...f, swipe: { ...f.swipe, prompt: e.target.value } })} maxLength={400} />
                {f.swipe.cards.map((c, i) => (
                  <div key={i} className="grid gap-2 rounded-lg bg-sunken p-3 sm:grid-cols-[1fr_2fr_auto]">
                    <Input aria-label={t("form.cardSender", { n: i + 1 })} placeholder={t("form.sender")} {...content} value={c.from} onChange={(e) => setCard(i, { from: e.target.value })} maxLength={120} className="bg-surface" />
                    <Input aria-label={t("form.cardText", { n: i + 1 })} placeholder={t("form.message")} {...content} value={c.text} onChange={(e) => setCard(i, { text: e.target.value })} maxLength={600} className="bg-surface" />
                    <Select aria-label={t("form.cardVerdict", { n: i + 1 })} value={c.verdict} onChange={(e) => setCard(i, { verdict: e.target.value as Card["verdict"] })} className="bg-surface">
                      <option value="threat">{t("form.threat")}</option>
                      <option value="safe">{t("form.safe")}</option>
                    </Select>
                    <Input aria-label={t("form.cardWhy", { n: i + 1 })} placeholder={t("form.why")} {...content} value={c.explain} onChange={(e) => setCard(i, { explain: e.target.value })} maxLength={400} className="bg-surface sm:col-span-3" />
                  </div>
                ))}
              </>
            ) : null}
          </div>
          <div className="grid gap-3 rounded-xl border border-line p-4">
            <Switch label={t("form.hotspot")} description={t("form.hotspotHint")} checked={f.hotspotOn} onChange={(e) => setF({ ...f, hotspotOn: e.target.checked })} />
            {f.hotspotOn ? (
              <>
                <Input aria-label={t("form.exercisePrompt")} placeholder={t("form.exercisePrompt")} {...content} value={f.hotspot.prompt} onChange={(e) => setF({ ...f, hotspot: { ...f.hotspot, prompt: e.target.value } })} maxLength={400} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("form.mailFrom")} htmlFor="st-mail-from">
                    <Input id="st-mail-from" dir="ltr" value={f.hotspot.from} onChange={(e) => setF({ ...f, hotspot: { ...f.hotspot, from: e.target.value } })} maxLength={200} />
                  </Field>
                  <Field label={t("form.mailSubject")} htmlFor="st-mail-subject">
                    <Input id="st-mail-subject" {...content} value={f.hotspot.subject} onChange={(e) => setF({ ...f, hotspot: { ...f.hotspot, subject: e.target.value } })} maxLength={200} />
                  </Field>
                </div>
                <Field label={t("form.mailBody")} htmlFor="st-mail-body">
                  <Textarea id="st-mail-body" {...content} value={f.hotspot.body} onChange={(e) => setF({ ...f, hotspot: { ...f.hotspot, body: e.target.value } })} maxLength={2000} className="min-h-32" />
                </Field>
                {f.hotspot.targets.map((x, i) => {
                  // This sign cannot be placed after the kept ones above it: not on one line of the body, or overlapping another.
                  const missing = signs[i] !== "" && !markTargets(f.hotspot.body.trim(), [...filledTargets(f.hotspot.targets.slice(0, i)).map((x) => x.text.trim()), signs[i]].map((text) => ({ text })));
                  return (
                    <div key={i} className="grid gap-2 rounded-lg bg-sunken p-3 sm:grid-cols-2">
                      <Input
                        aria-label={t("form.targetText", { n: i + 1 })}
                        placeholder={t("form.signText")}
                        {...content}
                        value={x.text}
                        onChange={(e) => setTarget(i, { text: e.target.value })}
                        maxLength={200}
                        aria-invalid={missing || undefined}
                        aria-describedby={missing ? `st-sign-${i}` : undefined}
                        className="bg-surface"
                      />
                      <Input aria-label={t("form.targetName", { n: i + 1 })} placeholder={t("form.signName")} {...content} value={x.label} onChange={(e) => setTarget(i, { label: e.target.value })} maxLength={120} className="bg-surface" />
                      <Input aria-label={t("form.targetWhy", { n: i + 1 })} placeholder={t("form.why")} {...content} value={x.explain} onChange={(e) => setTarget(i, { explain: e.target.value })} maxLength={400} className="bg-surface sm:col-span-2" />
                      {missing ? (
                        <p id={`st-sign-${i}`} className="text-caption text-risk-700 sm:col-span-2">
                          {t("form.targetMissing")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
          <fieldset className="grid gap-3 rounded-xl border border-line p-4">
            <legend className="px-1 text-body-sm font-semibold">{t("form.question")}</legend>
            <Input aria-label={t("form.question")} {...content} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} maxLength={400} />
            <p className="text-caption font-semibold text-ink-muted">{t("form.options")}</p>
            {f.options.map((o, i) => (
              <div key={i} className="grid gap-2 rounded-lg bg-sunken p-3 sm:grid-cols-[auto_1fr_1fr]">
                <label className="flex items-center gap-2 text-caption font-semibold">
                  <input type="radio" name="st-correct" checked={o.correct} onChange={() => setF({ ...f, options: f.options.map((x, j) => ({ ...x, correct: j === i })) })} className="size-4 accent-(--brand)" />
                  {t("form.correct")}
                </label>
                <Input aria-label={t("form.optionN", { n: i + 1 })} {...content} value={o.label} onChange={(e) => setF({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} maxLength={200} className="bg-surface" />
                <Input aria-label={t("form.optionFeedback")} {...content} placeholder={t("form.optionFeedback")} value={o.feedback} onChange={(e) => setF({ ...f, options: f.options.map((x, j) => (j === i ? { ...x, feedback: e.target.value } : x)) })} maxLength={400} className="bg-surface" />
              </div>
            ))}
          </fieldset>
          <Field label={t("form.recap")} htmlFor="st-recap">
            <Textarea id="st-recap" {...content} value={f.recap} onChange={(e) => setF({ ...f, recap: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function ModuleRowActions({ id, status, previewHref }: { id: string; status: "draft" | "published"; previewHref: string | null }) {
  const t = useTranslations("secops.studio");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {previewHref ? (
        <ButtonLink href={previewHref} size="sm" variant="ghost" icon={<Eye />}>
          {t("preview")}
        </ButtonLink>
      ) : null}
      <Button
        size="sm"
        variant={status === "draft" ? "primary" : "secondary"}
        icon={status === "draft" ? <Upload /> : undefined}
        disabled={publishing}
        onClick={() =>
          startPublish(async () => {
            const res = await setModuleStatusAction(id, status === "draft" ? "published" : "draft");
            if (res.ok) translationToast(t, res, status === "draft" ? t("published") : t("unpublished"));
          })
        }
      >
        {status === "draft" ? t("publish") : t("unpublish")}
      </Button>
      <span role="status" className="self-center text-caption text-ink-muted">
        {publishing && status === "draft" ? t("translating") : null}
      </span>
      <Button size="icon-sm" variant="ghost" aria-label={t("delete")} disabled={publishing} onClick={() => setConfirm(true)}>
        <Trash2 />
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("delete")}
        description={t("deleteBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteModuleAction(id);
                  if (!res.ok) return toast(res.error === "in_use" ? t("deleteInUse") : tc("errors.generic"), "error");
                  toast(t("deleted"));
                  setConfirm(false);
                })
              }
            >
              {t("delete")}
            </Button>
          </>
        }
      />
    </div>
  );
}

/* ───────── support materials ───────── */

export function MaterialForm({ modules, departments }: { modules: Option[]; departments: Option[] }) {
  const t = useTranslations("secops.studio");
  const ts = useTranslations("secops");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ title: "", body: "", moduleId: "", departmentId: "", requiresTwo: false });
  return (
    <>
      <Button variant="secondary" icon={<Send />} onClick={() => setOpen(true)}>
        {t("newMaterial")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("newMaterial")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || f.title.trim().length < 3 || f.body.trim().length < 10}
              onClick={() =>
                start(async () => {
                  const res = await createMaterialAction({ title: f.title, body: f.body, moduleId: f.moduleId || null, departmentId: f.departmentId || null, requiresTwo: f.requiresTwo });
                  if (!res.ok) return toast(tc("errors.invalid"), "error");
                  toast(t("material.sent"));
                  setOpen(false);
                  setF({ title: "", body: "", moduleId: "", departmentId: "", requiresTwo: false });
                })
              }
            >
              {t("material.send")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("material.title")} htmlFor="mat-title">
            <Input id="mat-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} />
          </Field>
          <Field label={t("material.body")} htmlFor="mat-body">
            <Textarea id="mat-body" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-40" maxLength={5000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("material.module")} htmlFor="mat-mod">
              <Select id="mat-mod" value={f.moduleId} onChange={(e) => setF({ ...f, moduleId: e.target.value })}>
                <option value="">{ts("approvals.noModule")}</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("material.audience")} htmlFor="mat-aud">
              <Select id="mat-aud" value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
                <option value="">{tc("allDepartments")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Checkbox label={t("material.requiresTwo")} checked={f.requiresTwo} onChange={(e) => setF({ ...f, requiresTwo: e.target.checked })} />
        </div>
      </Dialog>
    </>
  );
}

/* ───────── learning paths ───────── */

/** `sourceId`: the library path a duplicate starts from, so its other translations are kept. */
export type PathDraft = { id: string | null; sourceId?: string | null; title: string; description: string; audience: string; recurrence: string; standards: string; mandatory: boolean; moduleSlugs: string[]; labIds: LabId[] };

/** `labs`: the practice labs to offer (none when the tenant has no lab feature; a path keeps the labs it has). */
export function PathEditor({ initial, modules, labs, trigger }: { initial: PathDraft | null; modules: { slug: string; label: string }[]; labs: { id: LabId; label: string }[]; trigger: "new" | "edit" | "duplicate" }) {
  const t = useTranslations("secops.paths");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const empty: PathDraft = { id: null, title: "", description: "", audience: "", recurrence: "", standards: "", mandatory: false, moduleSlugs: [], labIds: [] };
  const [f, setF] = useState<PathDraft>(initial ?? empty);
  const [query, setQuery] = useState("");
  const bySlug = useMemo(() => new Map(modules.map((m) => [m.slug, m.label])), [modules]);
  const matches = useMemo(() => {
    const q = searchFold(query.trim());
    return q.length < 2 ? [] : modules.filter((m) => !f.moduleSlugs.includes(m.slug) && searchFold(m.label).includes(q)).slice(0, 8);
  }, [query, modules, f.moduleSlugs]);
  const move = (i: number, d: -1 | 1) => {
    const next = [...f.moduleSlugs];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setF({ ...f, moduleSlugs: next });
  };
  const Icon = trigger === "new" ? Plus : trigger === "edit" ? Pencil : Copy;
  return (
    <>
      <Button size={trigger === "new" ? "md" : "sm"} variant={trigger === "new" ? "primary" : "secondary"} icon={<Icon />} onClick={() => setOpen(true)}>
        {trigger === "new" ? t("new") : trigger === "edit" ? t("edit") : t("duplicate")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={f.id ? t("edit") : t("new")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || f.title.trim().length < 3 || !f.moduleSlugs.length}
              onClick={() =>
                start(async () => {
                  const res = await savePathAction(f);
                  if (!res.ok) return toast(tc("errors.invalid"), "error");
                  toast(t("saved"));
                  setOpen(false);
                  if (!f.id) setF(initial ?? empty);
                })
              }
            >
              {t("form.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("form.title")} htmlFor="p-title">
            <Input id="p-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
          </Field>
          <Field label={t("form.description")} htmlFor="p-desc">
            <Textarea id="p-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={600} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("form.audience")} htmlFor="p-aud">
              <Input id="p-aud" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} maxLength={120} />
            </Field>
            <Field label={t("form.recurrence")} htmlFor="p-rec">
              <Input id="p-rec" value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value })} maxLength={60} />
            </Field>
            <Field label={t("form.standards")} htmlFor="p-std">
              <Input id="p-std" value={f.standards} onChange={(e) => setF({ ...f, standards: e.target.value })} maxLength={200} placeholder="ISO 27001, NIS2" />
            </Field>
          </div>
          <Switch label={t("form.mandatory")} checked={f.mandatory} onChange={(e) => setF({ ...f, mandatory: e.target.checked })} />
          <div className="grid gap-2">
            <p className="text-caption font-semibold">{t("form.modules")}</p>
            <ol className="grid gap-1.5">
              {f.moduleSlugs.map((slug, i) => {
                const title = bySlug.get(slug) ?? t("unavailableLesson");
                return (
                  <li key={slug} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-caption">
                    <span className="w-5 text-ink-subtle tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={t("form.up")} onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("form.down")} onClick={() => move(i, 1)} disabled={i === f.moduleSlugs.length - 1}>
                      <ArrowDown />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("form.removeItem", { title })} onClick={() => setF({ ...f, moduleSlugs: f.moduleSlugs.filter((s) => s !== slug) })}>
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ol>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("form.search")} aria-label={t("form.add")} />
            {matches.length ? (
              <ul className="grid gap-1 rounded-lg border border-line p-1">
                {matches.map((m) => (
                  <li key={m.slug}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-caption hover:bg-sunken"
                      onClick={() => {
                        setF({ ...f, moduleSlugs: [...f.moduleSlugs, m.slug] });
                        setQuery("");
                      }}
                    >
                      <Plus className="size-4 text-brand-600" />
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {labs.length ? (
            <fieldset className="grid gap-2">
              <legend className="text-caption font-semibold">{t("form.labs")}</legend>
              <p className="text-caption text-ink-muted">{t("form.labsHint")}</p>
              <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
                {labs.map((l) => (
                  <Checkbox
                    key={l.id}
                    label={l.label}
                    checked={f.labIds.includes(l.id)}
                    onChange={(e) => setF({ ...f, labIds: e.target.checked ? [...f.labIds, l.id] : f.labIds.filter((id) => id !== l.id) })}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

export function DeletePath({ id }: { id: string }) {
  const t = useTranslations("secops.paths");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={t("delete")} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("delete")}
        description={t("deleteBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deletePathAction(id);
                  if (!res.ok) return toast(res.error === "in_use" ? t("deleteInUse") : tc("errors.generic"), "error");
                  toast(t("deleted"));
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {t("delete")}
            </Button>
          </>
        }
      />
    </>
  );
}
