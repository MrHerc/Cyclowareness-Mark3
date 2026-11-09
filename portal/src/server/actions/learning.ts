"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { isUniqueViolation } from "../db/errors";
import { actionViewer, allowed, type Viewer } from "../auth/viewer";
import { rateLimit } from "../rate-limit";
import { queueEmail, renderEmailHtml } from "../mail";
import { appUrl } from "../env";
import { attestModule, completeLesson, issueCertificate, reachScene, startLesson, touchModule } from "../services/progress";
import { recomputeRisk } from "../services/risk";
import { emitEvent } from "../services/events";
import { audit } from "../services/audit";
import { DEFAULT_ATTESTATION } from "../../lib/tenant-defaults";
import { pick } from "../../i18n/config";
import { pickLessonContent } from "../../lib/content/lesson-locale";
import { minDwellMs, scoreLesson } from "../../lib/content/scoring";
import type { Scene } from "../../lib/content/types";

/** Learners only reach published modules; studio authors may also act on their drafts (preview). */
async function moduleBySlug(v: Viewer, slug: string) {
  const rows = await db()
    .select()
    .from(t.modules)
    .where(
      and(
        eq(t.modules.slug, slug),
        or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)),
        allowed(v, "studio.write") ? undefined : eq(t.modules.status, "published"),
      ),
    );
  return rows.find((r) => r.tenantId) ?? rows[0] ?? null;
}

export async function attestModuleAction(slug: string): Promise<{ ok: boolean; token?: string }> {
  const v = await actionViewer();
  const locale = await getLocale();
  const mod = await moduleBySlug(v, slug);
  if (!mod) return { ok: false };
  const text = v.tenant.settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale);
  const res = await attestModule(db(), { tenantId: v.tenant.id, userId: v.user.id, moduleId: mod.id, text, locale });
  if (!res) return { ok: false };
  await emitEvent(db(), v.tenant.id, "attestation.completed", { module: slug, userId: v.user.id });
  await issuePathCertificates(v.tenant.id, v.user.id, slug);
  await recomputeRisk(db(), v.tenant.id, [v.user.id]);
  refresh();
  return { ok: true, token: res.publicToken };
}

/** A learning path is finished when every module in it is completed: issue its certificate once. */
async function issuePathCertificates(tenantId: string, userId: string, slug: string) {
  const paths = await db()
    .select({ id: t.learningPaths.id, slugs: t.learningPaths.moduleSlugs })
    .from(t.learningPaths)
    .where(or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, tenantId)));
  const done = await db()
    .select({ slug: t.modules.slug })
    .from(t.moduleProgress)
    .innerJoin(t.modules, eq(t.modules.id, t.moduleProgress.moduleId))
    .where(and(eq(t.moduleProgress.userId, userId), eq(t.moduleProgress.status, "completed")));
  const doneSet = new Set(done.map((d) => d.slug));
  for (const p of paths.filter((x) => x.slugs.includes(slug) && x.slugs.every((s) => doneSet.has(s)))) {
    // Two modules of the path attested at the same moment both get here: the unique key keeps one certificate.
    try {
      await issueCertificate(db(), { tenantId, userId, pathId: p.id });
    } catch (error) {
      if (!isUniqueViolation(error, "certificates_user_path_idx")) throw error;
    }
  }
}

const rateSchema = z.object({ slug: z.string().max(100), rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() });

export async function rateModuleAction(input: { slug: string; rating: number; comment?: string }): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  const p = rateSchema.safeParse(input);
  if (!p.success) return { ok: false };
  if (!(await rateLimit(`rate:${v.user.id}`, 20, 60 * 60_000)).ok) return { ok: false };
  const mod = await moduleBySlug(v, p.data.slug);
  if (!mod) return { ok: false };
  // Module ratings are anonymous by design (Reports → Module feedback).
  await db().insert(t.feedback).values({ tenantId: v.tenant.id, userId: null, moduleId: mod.id, rating: p.data.rating, topic: "module", comment: p.data.comment?.trim() || null });
  return { ok: true };
}

/** The module and the lesson the player names, if the viewer may act on them. */
async function lessonOf(v: Viewer, slug: string, lessonKey: string) {
  // Server actions take whatever the request carries; both reach text columns and lookups below.
  if (typeof slug !== "string" || slug.length > 100 || typeof lessonKey !== "string" || lessonKey.length > 100) return null;
  const mod = await moduleBySlug(v, slug);
  if (!mod) return null;
  const lessons = await db().select().from(t.lessons).where(eq(t.lessons.moduleId, mod.id));
  const lesson = lessons.find((l) => l.key === lessonKey);
  return lesson ? { mod, lessons, lesson } : null;
}

/** Records that a lesson was opened (Home "Continue" points here) and when this attempt began. */
export async function startLessonAction(slug: string, lessonKey: string): Promise<void> {
  const v = await actionViewer();
  const found = await lessonOf(v, slug, lessonKey);
  if (!found) return;
  await touchModule(db(), { userId: v.user.id, moduleId: found.mod.id, lessonKey });
  await startLesson(db(), { userId: v.user.id, lessonId: found.lesson.id });
}

/** The player reports each scene it shows; the server keeps the furthest one of the attempt. */
export async function reachSceneAction(slug: string, lessonKey: string, index: number): Promise<void> {
  const v = await actionViewer();
  if (!Number.isInteger(index) || index < 0 || index > 999) return;
  if (!(await rateLimit(`lesson-reach:${v.user.id}`, 600, 10 * 60_000)).ok) return;
  const found = await lessonOf(v, slug, lessonKey);
  if (!found) return;
  await reachScene(db(), { userId: v.user.id, lessonId: found.lesson.id, index });
}

const submissionSchema = z.object({
  sceneId: z.string().max(80),
  itemId: z.string().max(80).optional(),
  picked: z.array(z.string().max(80)).max(40),
});

const completeSchema = z.object({
  slug: z.string().max(100),
  lessonKey: z.string().max(100),
  answers: z.array(submissionSchema).max(400),
});

export type LessonResult = {
  ok: boolean;
  xp: number;
  moduleStatus?: "in_progress" | "awaiting_attestation" | "completed";
  nextKey?: string | null;
  /** The attempt could not be verified (not started here or already used up, too fast, scenes skipped, answers missing). */
  error?: "unverified";
};

/**
 * Called once at the end of a lesson with what the learner picked in each scored scene. The attempt
 * counts only when it was started here, lasted long enough, showed every scene and answered every
 * scored one; the answers are scored from the lesson's content and feed the weak-areas report and the
 * risk score. XP is awarded only the first time a lesson is completed.
 */
export async function completeLessonAction(input: z.infer<typeof completeSchema>): Promise<LessonResult> {
  const v = await actionViewer();
  const p = completeSchema.safeParse(input);
  if (!p.success) return { ok: false, xp: 0 };
  // Each call stores up to 400 answers and recomputes the risk score: far more than anyone finishes lessons.
  if (!(await rateLimit(`lesson-complete:${v.user.id}`, 60, 10 * 60_000)).ok) return { ok: false, xp: 0 };
  const found = await lessonOf(v, p.data.slug, p.data.lessonKey);
  if (!found) return { ok: false, xp: 0 };
  const { mod, lessons, lesson } = found;
  // A Studio author's preview of a draft plays to the end but earns nothing.
  if (mod.status !== "published") return { ok: true, xp: 0 };

  const now = Date.now();
  const [attempt] = await db()
    .select({ startedAt: t.lessonProgress.startedAt, reached: t.lessonProgress.reached })
    .from(t.lessonProgress)
    .where(and(eq(t.lessonProgress.userId, v.user.id), eq(t.lessonProgress.lessonId, lesson.id)));
  const contents = await db().select({ scenes: t.lessonContents.scenes, locale: t.lessonContents.locale }).from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
  // Scene ids are the same in every language of a lesson, so any stored text scores the attempt.
  const scenes = (pickLessonContent(contents, await getLocale())?.scenes ?? null) as Scene[] | null;
  const started = attempt?.startedAt?.getTime() ?? 0;
  const scored = scenes ? scoreLesson(scenes, p.data.answers) : { ok: false as const, reason: "invalid" as const };
  const reason = !started
    ? "not_started"
    : now - started < minDwellMs(lesson.minutes)
      ? "too_fast"
      : scenes && attempt!.reached < scenes.length - 1
        ? "unreached"
        : scored.ok
          ? null
          : scored.reason;
  if (reason !== null || !scored.ok) {
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "learning.completion_refused", targetType: "lesson", targetId: lesson.id, meta: { module: mod.slug, lesson: lesson.key, reason } });
    return { ok: false, xp: 0, error: "unverified" };
  }
  // The attempt is used up by one statement before anything is written: the same completion sent
  // twice at once would otherwise store its answer rows twice (they feed the risk score).
  const consumed = await db()
    .update(t.lessonProgress)
    .set({ startedAt: null, reached: 0 })
    .where(and(eq(t.lessonProgress.userId, v.user.id), eq(t.lessonProgress.lessonId, lesson.id), eq(t.lessonProgress.startedAt, attempt!.startedAt!)))
    .returning({ userId: t.lessonProgress.userId });
  if (!consumed.length) return { ok: false, xp: 0, error: "unverified" };

  if (scored.answers.length) {
    await db()
      .insert(t.answers)
      .values(scored.answers.map((a) => ({ tenantId: v.tenant.id, userId: v.user.id, lessonId: lesson.id, ...a, category: mod.category })));
    const risky = scored.answers.filter((a) => a.outcome && a.outcome !== "safe").length;
    if (risky) await emitEvent(db(), v.tenant.id, "simulation.risky", { module: mod.slug, lesson: lesson.key, choices: risky });
  }
  // Time trained: at most three times the lesson's nominal length, so a lesson left open adds no more.
  const secondsSpent = Math.min(lesson.minutes * 180, Math.round((now - started) / 1000));
  const res = await completeLesson(db(), { tenantId: v.tenant.id, userId: v.user.id, lessonId: lesson.id, secondsSpent });
  await recomputeRisk(db(), v.tenant.id, [v.user.id]);
  const sorted = lessons.sort((a, b) => a.position - b.position);
  const next = sorted.find((l) => l.position > lesson.position);
  return { ok: true, xp: res.xpAwarded, moduleStatus: res.moduleStatus, nextKey: next?.key ?? null };
}

export async function reportProblemAction(_: { ok?: boolean } | undefined, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const v = await actionViewer();
  const message = String(form.get("message") ?? "").trim();
  const context = String(form.get("context") ?? "").slice(0, 200);
  if (message.length < 3) return { error: "message" };
  if (!(await rateLimit(`problem:${v.user.id}`, 10, 60 * 60_000)).ok) return { error: "rateLimited" };
  await db().insert(t.problemReports).values({ tenantId: v.tenant.id, userId: v.user.id, context: context || null, message: message.slice(0, 4000) });
  await emitEvent(db(), v.tenant.id, "issue.reported", { context });
  // Settings → Email → "Problem reports by email": a copy goes to the helpdesk.
  const email = v.tenant.settings.email;
  if (email.enabled && email.helpdesk) {
    const lang = v.tenant.settings.defaultLocale;
    const tr = await getTranslations({ locale: lang, namespace: "admin.problems" });
    const link = `${appUrl()}/admin/problems`;
    const where = context ? await contextName(v, context, lang) : "";
    const text = `${message.slice(0, 4000)}\n\n${tr("emailFrom", { name: v.user.name, email: v.user.email })}\n\n${link}`;
    await queueEmail(db(), v.tenant.id, {
      to: email.helpdesk,
      kind: "problem",
      subject: where ? tr("emailSubject", { context: where }) : tr("emailSubjectPlain"),
      text,
      html: renderEmailHtml(text, { buttonLabel: tr("emailButton"), button: link, lang, brand: v.tenant.branding.primary, footer: v.tenant.name }),
      lang,
    });
  }
  return { ok: true };
}

const LESSON_CONTEXT = /^lesson:([^/#]+)\/([^#]+)/;

/**
 * Where a problem was reported, as the admin problems page names it: "lesson “…” in “…”" for the player's
 * "lesson:<module>/<lesson>#<scene>", "page …" for "page:<path>", in the helpdesk's language.
 */
async function contextName(v: Viewer, context: string, locale: string): Promise<string> {
  const tr = await getTranslations({ locale, namespace: "admin.problems" });
  const lesson = LESSON_CONTEXT.exec(context);
  if (lesson) {
    const rows = await db()
      .select({ tenantId: t.modules.tenantId, module: t.modules.title, lesson: t.lessons.title })
      .from(t.lessons)
      .innerJoin(t.modules, eq(t.modules.id, t.lessons.moduleId))
      .where(and(eq(t.modules.slug, lesson[1]), eq(t.lessons.key, lesson[2]), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id))));
    // A tenant's own module with the same slug replaces the library one.
    const found = rows.find((r) => r.tenantId) ?? rows[0];
    if (found) return tr("contextLesson", { lesson: pick(found.lesson, locale), module: pick(found.module, locale) });
  }
  if (context.startsWith("page:")) return tr("contextPage", { path: context.slice(5) });
  return context;
}
