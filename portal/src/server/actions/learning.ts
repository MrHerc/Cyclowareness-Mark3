"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer, allowed, type Viewer } from "../auth/viewer";
import { queueEmail } from "../mail";
import { attestModule, completeLesson, issueCertificate, touchModule } from "../services/progress";
import { recomputeRisk } from "../services/risk";
import { emitEvent } from "../services/events";
import { DEFAULT_ATTESTATION } from "../../lib/tenant-defaults";
import { pick } from "../../i18n/config";

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
    const [existing] = await db()
      .select({ id: t.certificates.id })
      .from(t.certificates)
      .where(and(eq(t.certificates.userId, userId), eq(t.certificates.pathId, p.id)));
    if (!existing) await issueCertificate(db(), { tenantId, userId, pathId: p.id });
  }
}

const rateSchema = z.object({ slug: z.string().max(100), rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() });

export async function rateModuleAction(input: { slug: string; rating: number; comment?: string }): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  const p = rateSchema.safeParse(input);
  if (!p.success) return { ok: false };
  const mod = await moduleBySlug(v, p.data.slug);
  if (!mod) return { ok: false };
  // Module ratings are anonymous by design (Reports → Module feedback).
  await db().insert(t.feedback).values({ tenantId: v.tenant.id, userId: null, moduleId: mod.id, rating: p.data.rating, topic: "module", comment: p.data.comment?.trim() || null });
  return { ok: true };
}

/** Records that a lesson was opened (Home "Continue" points here). */
export async function startLessonAction(slug: string, lessonKey: string): Promise<void> {
  const v = await actionViewer();
  const mod = await moduleBySlug(v, slug);
  if (!mod) return;
  await touchModule(db(), { userId: v.user.id, moduleId: mod.id, lessonKey });
}

const answerSchema = z.object({
  sceneId: z.string().max(80),
  itemId: z.string().max(80).optional(),
  correct: z.boolean(),
  firstTry: z.boolean(),
  outcome: z.enum(["safe", "risky", "compromised"]).optional(),
});

const completeSchema = z.object({
  slug: z.string().max(100),
  lessonKey: z.string().max(100),
  seconds: z.number().int().min(0).max(4 * 3600),
  answers: z.array(answerSchema).max(400),
});

export type LessonResult = { ok: boolean; xp: number; moduleStatus?: "in_progress" | "awaiting_attestation" | "completed"; nextKey?: string | null };

/**
 * Called once at the end of a lesson with the learner's answers. Answers feed the weak-areas
 * report and the risk score; XP is awarded only the first time a lesson is completed.
 */
export async function completeLessonAction(input: z.infer<typeof completeSchema>): Promise<LessonResult> {
  const v = await actionViewer();
  const p = completeSchema.safeParse(input);
  if (!p.success) return { ok: false, xp: 0 };
  const mod = await moduleBySlug(v, p.data.slug);
  if (!mod) return { ok: false, xp: 0 };
  const lessons = await db().select().from(t.lessons).where(eq(t.lessons.moduleId, mod.id));
  const lesson = lessons.find((l) => l.key === p.data.lessonKey);
  if (!lesson) return { ok: false, xp: 0 };

  if (p.data.answers.length) {
    await db()
      .insert(t.answers)
      .values(
        p.data.answers.map((a) => ({
          tenantId: v.tenant.id,
          userId: v.user.id,
          lessonId: lesson.id,
          sceneId: a.sceneId,
          itemId: a.itemId ?? null,
          correct: a.correct,
          firstTry: a.firstTry,
          outcome: a.outcome ?? null,
          category: mod.category,
        })),
      );
    const risky = p.data.answers.filter((a) => a.outcome && a.outcome !== "safe").length;
    if (risky) await emitEvent(db(), v.tenant.id, "simulation.risky", { module: mod.slug, lesson: lesson.key, choices: risky });
  }
  const res = await completeLesson(db(), { tenantId: v.tenant.id, userId: v.user.id, lessonId: lesson.id, secondsSpent: p.data.seconds });
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
  await db().insert(t.problemReports).values({ tenantId: v.tenant.id, userId: v.user.id, context: context || null, message: message.slice(0, 4000) });
  await emitEvent(db(), v.tenant.id, "issue.reported", { context });
  // Settings → Email → "Problem reports by email": a copy goes to the helpdesk.
  const email = v.tenant.settings.email;
  if (email.enabled && email.helpdesk) {
    const tr = await getTranslations({ locale: v.tenant.settings.defaultLocale, namespace: "admin.problems" });
    const link = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/admin/problems`;
    await queueEmail(db(), v.tenant.id, {
      to: email.helpdesk,
      kind: "problem",
      subject: context ? tr("emailSubject", { context }) : tr("emailSubjectPlain"),
      text: `${message.slice(0, 4000)}\n\n${tr("emailFrom", { name: v.user.name, email: v.user.email })}\n\n${link}`,
    });
  }
  return { ok: true };
}
