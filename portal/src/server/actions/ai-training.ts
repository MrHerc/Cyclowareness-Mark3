"use server";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { audit } from "../services/audit";
import { aiEnabled, anthropicTrainingModel } from "../ai";
import { draftWithinLimit, generateVerified, matchLibrary, schemaCheck, safetyIssues, TRAINING_LOCALES, verifyDraft, type TrainingDraft, type Verification } from "../ai-verify";
import { rateLimit } from "../rate-limit";
import { AUDIENCES, CATEGORIES } from "../../lib/domain/catalog";
import { sharedContentLocale } from "../../lib/content/lesson-locale";

const requestSchema = z.object({
  prompt: z.string().trim().min(10).max(4000),
  locale: z.enum(TRAINING_LOCALES),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(t.DIFFICULTY),
  minutes: z.number().int().min(2).max(45),
  lessons: z.number().int().min(1).max(3),
});
export type TrainingInput = z.infer<typeof requestSchema>;

export type TrainingResult = {
  ok: boolean;
  error?: "invalid" | "offline" | "failed" | "rateLimited" | "noMatch";
  draft?: TrainingDraft;
  verification?: Verification;
  /** Where the draft came from. A library draft is never presented or saved as AI output. */
  source?: { kind: "ai" } | { kind: "library"; slug: string; title: string; contentLocale: string };
};

/** Generates a training with Claude, verifies it (schema, safety, AI review) and regenerates once on blocking issues. */
export async function generateTrainingAction(input: TrainingInput): Promise<TrainingResult> {
  const v = await actionViewer("studio.write");
  const p = requestSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (!aiEnabled()) return { ok: false, error: "offline" };
  if (!(await rateLimit(`ai-training:${v.user.id}`, 10, 60 * 60_000)).ok) return { ok: false, error: "rateLimited" };
  try {
    // The reviewer writes its findings in the Studio user's interface language, not the training's.
    const { draft, verification } = await generateVerified(anthropicTrainingModel(await getLocale()), p.data);
    if (!draft) return { ok: false, error: "failed", verification };
    return { ok: true, draft, verification, source: { kind: "ai" } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/**
 * Without AI: assembles a draft from the closest library module (keyword match on its title and
 * subtitle) and runs verification steps 1–2; step 3 is reported as skipped.
 */
export async function libraryTrainingAction(input: TrainingInput): Promise<TrainingResult> {
  const v = await actionViewer("studio.write");
  const p = requestSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (!(await rateLimit(`ai-library:${v.user.id}`, 60, 60 * 60_000)).ok) return { ok: false, error: "rateLimited" };
  const req = p.data;
  const modules = await db()
    .select({ id: t.modules.id, slug: t.modules.slug, category: t.modules.category, title: t.modules.title, subtitle: t.modules.subtitle })
    .from(t.modules)
    .where(and(isNull(t.modules.tenantId), eq(t.modules.origin, "library")));
  const best = matchLibrary(req.prompt, modules, req.locale, req.category);
  if (!best) return { ok: false, error: "noMatch" };
  const lessons = (await db().select().from(t.lessons).where(eq(t.lessons.moduleId, best.id)).orderBy(asc(t.lessons.position))).slice(0, req.lessons);
  const contents = lessons.length
    ? await db().select().from(t.lessonContents).where(inArray(t.lessonContents.lessonId, lessons.map((l) => l.id)))
    : [];
  // The draft is saved with one content language: the chosen one when every picked lesson has a
  // translation in it, otherwise the English originals (never a mix of the two).
  const contentLocale = sharedContentLocale(
    lessons.map((l) => contents.filter((c) => c.lessonId === l.id).map((c) => c.locale)),
    req.locale,
  );
  // Titles in the content language too, so English scenes never sit under Azerbaijani or Russian titles.
  const picked = lessons
    .map((l) => {
      const c = contents.find((x) => x.lessonId === l.id && x.locale === contentLocale);
      if (!c) return null;
      return { id: l.key, title: l.title[contentLocale] ?? l.title.en ?? l.key, minutes: l.minutes, scenes: c.scenes };
    })
    .filter((l) => l !== null);
  if (!picked.length) return { ok: false, error: "noMatch" };
  const raw = { title: best.title[contentLocale] ?? best.title.en ?? best.slug, subtitle: best.subtitle[contentLocale] ?? best.subtitle.en ?? "", lessons: picked };
  const r = await verifyDraft(raw, null);
  if (!r.draft) return { ok: false, error: "failed" };
  // The source label names the library module in the chosen language.
  const title = best.title[req.locale] ?? best.title.en ?? best.slug;
  return { ok: true, draft: r.draft, verification: { verdict: r.verdict, steps: r.steps, attempts: 1 }, source: { kind: "library", slug: best.slug, title, contentLocale } };
}

const saveSchema = z.object({
  draft: z.unknown().refine(draftWithinLimit),
  /** The language of the draft's text (titles and scenes alike): the chosen one, or English for a library draft without that translation. */
  contentLocale: z.enum(TRAINING_LOCALES),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(t.DIFFICULTY),
  origin: z.enum(["ai", "library"]),
  verdict: z.enum(["verified", "needs_review"]),
});

/** Russian letters in Latin (a common simplified romanisation), so a Russian title gives a readable address too. */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/[а-яё]/g, (c) => CYRILLIC[c] ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "training";
}

/**
 * Saves a verified (or "needs human review") training as a tenant draft module, the same tables and
 * audit event as saveStudioLessonAction. The draft is re-checked on the server; publishing stays a
 * human step in the Studio list (ADR-008).
 */
export async function saveTrainingDraftAction(input: z.infer<typeof saveSchema>): Promise<{ ok: boolean; error?: "invalid"; slug?: string; lessonKey?: string }> {
  const v = await actionViewer("studio.write");
  const p = saveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { draft, issues } = schemaCheck(p.data.draft);
  if (!draft || issues.length) return { ok: false, error: "invalid" };
  const d = p.data;
  const safetyOk = safetyIssues(draft).length === 0;
  const minutes = Math.max(1, Math.min(60, draft.lessons.reduce((a, l) => a + l.minutes, 0)));
  const slug = `${d.origin === "ai" ? "ai" : "own"}-${slugify(draft.title)}-${Date.now().toString(36).slice(-4)}`;
  const label = { [d.contentLocale]: draft.title };
  const [mod] = await db()
    .insert(t.modules)
    .values({
      tenantId: v.tenant.id,
      slug,
      category: d.category,
      audiences: [AUDIENCES[0]],
      title: label,
      subtitle: { [d.contentLocale]: draft.subtitle },
      minutes,
      xp: 40 + minutes * 5,
      difficulty: d.difficulty,
      // A library-based draft is the tenant's own copy, not AI output.
      origin: d.origin === "ai" ? "ai" : "custom",
      status: "draft",
      sortOrder: 1000,
      createdBy: v.user.id,
    })
    .returning({ id: t.modules.id });
  const keys: string[] = [];
  for (const [i, l] of draft.lessons.entries()) {
    const key = `lesson-${i + 1}`;
    keys.push(key);
    const [lesson] = await db()
      .insert(t.lessons)
      .values({ moduleId: mod.id, key, title: { [d.contentLocale]: l.title }, minutes: l.minutes, position: i + 1 })
      .returning({ id: t.lessons.id });
    await db().insert(t.lessonContents).values({ lessonId: lesson.id, locale: d.contentLocale, scenes: l.scenes });
  }
  await audit(db(), {
    tenantId: v.tenant.id,
    actorId: v.user.id,
    action: "module.created",
    targetType: "module",
    targetId: mod.id,
    meta: { title: draft.title, origin: d.origin === "ai" ? "ai" : "custom", source: d.origin, verdict: safetyOk ? d.verdict : "needs_review", lessons: draft.lessons.length },
  });
  refresh();
  return { ok: true, slug, lessonKey: keys[0] };
}
