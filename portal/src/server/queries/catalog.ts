import "server-only";
import { cache } from "react";
import { and, asc, eq, getTableColumns, isNull, or } from "drizzle-orm";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { assignedForUser } from "../services/assignments";
import { pick } from "../../i18n/config";
import type { Category } from "../../lib/domain/catalog";

export type CatalogModule = {
  id: string;
  slug: string;
  category: Category;
  audiences: string[];
  title: string;
  subtitle: string;
  minutes: number;
  xp: number;
  difficulty: "Easy" | "Medium" | "Hard";
  origin: "library" | "custom" | "ai";
  sortOrder: number;
  lessons: { id: string; key: string; title: string; minutes: number; position: number; completed: boolean }[];
  status: "not_started" | "in_progress" | "awaiting_attestation" | "completed";
  percent: number;
  lastLessonKey: string | null;
  completedAt: Date | null;
  startedAt: Date | null;
  assigned: boolean;
  due: string | null;
  /** Recommended for this person: assigned to everyone, their department or them. */
  forYou: boolean;
};

/**
 * The modules a person can open: the published ones of the library and of their organisation, and with `drafts`
 * the organisation's own unpublished ones (studio authors previewing them). The catalog (so the lesson page) and both
 * subtitle routes use it, so they agree on what is reachable.
 */
export function reachableModules(v: Viewer, drafts: boolean) {
  return or(
    and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)), eq(t.modules.status, "published")),
    drafts ? and(eq(t.modules.tenantId, v.tenant.id), eq(t.modules.status, "draft")) : undefined,
  );
}

/** The library's modules and the organisation's own, whatever their status (progress on an unpublished module still resolves); never another organisation's. */
export function tenantModules(v: Pick<Viewer, "tenant">) {
  return or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id));
}

/**
 * Every published module this person can see, with their progress. Cached per request.
 * `drafts` adds the organisation's own unpublished lessons (studio authors previewing them).
 */
export const getCatalog = cache(async (v: Viewer, locale: string, drafts = false): Promise<CatalogModule[]> => {
  const [mods, lessons, mp, lp, assigned] = await Promise.all([
    db().select().from(t.modules).where(reachableModules(v, drafts)).orderBy(asc(t.modules.sortOrder)),
    db().select(getTableColumns(t.lessons)).from(t.lessons).innerJoin(t.modules, eq(t.modules.id, t.lessons.moduleId)).where(tenantModules(v)).orderBy(asc(t.lessons.position)),
    db().select().from(t.moduleProgress).where(eq(t.moduleProgress.userId, v.user.id)),
    db().select({ lessonId: t.lessonProgress.lessonId, completedAt: t.lessonProgress.completedAt }).from(t.lessonProgress).where(eq(t.lessonProgress.userId, v.user.id)),
    assignedForUser(db(), v.tenant.id, v.user.id),
  ]);
  // A tenant's own module with the same slug replaces the library one.
  const bySlug = new Map<string, (typeof mods)[number]>();
  for (const m of mods) if (!bySlug.has(m.slug) || m.tenantId) bySlug.set(m.slug, m);
  const progress = new Map(mp.map((p) => [p.moduleId, p]));
  const doneLessons = new Set(lp.filter((l) => l.completedAt).map((l) => l.lessonId));
  const lessonsBy = new Map<string, typeof lessons>();
  for (const l of lessons) lessonsBy.set(l.moduleId, [...(lessonsBy.get(l.moduleId) ?? []), l]);

  return [...bySlug.values()].map((m) => {
    const p = progress.get(m.id);
    const a = assigned.get(m.id);
    const ls = (lessonsBy.get(m.id) ?? []).map((l) => ({
      id: l.id,
      key: l.key,
      title: pick(l.title, locale),
      minutes: l.minutes,
      position: l.position,
      completed: doneLessons.has(l.id),
    }));
    return {
      id: m.id,
      slug: m.slug,
      category: m.category as Category,
      // Older studio rows were saved as "Everyone"; the catalog filters are lowercase.
      audiences: m.audiences.map((a) => a.toLowerCase()),
      title: pick(m.title, locale),
      subtitle: pick(m.subtitle, locale),
      minutes: m.minutes,
      xp: m.xp,
      difficulty: m.difficulty,
      origin: m.origin,
      sortOrder: m.sortOrder,
      lessons: ls,
      status: p?.status ?? "not_started",
      percent: p?.percent ?? 0,
      lastLessonKey: p?.lastLessonKey ?? null,
      completedAt: p?.completedAt ?? null,
      startedAt: p?.startedAt ?? null,
      assigned: !!a,
      due: a?.due ?? null,
      forYou: !!a,
    };
  });
});

/** The module to continue: in progress first (most recent), then the first assigned one not done. */
export function continueModule(mods: CatalogModule[]): CatalogModule | null {
  const inProgress = mods
    .filter((m) => m.status === "in_progress" || m.status === "awaiting_attestation")
    .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
  if (inProgress[0]) return inProgress[0];
  return yourPath(mods).find((m) => m.status !== "completed") ?? null;
}

/** "Your path": assigned modules by due date, then recommendations, then the rest of the everyone track. */
export function yourPath(mods: CatalogModule[]): CatalogModule[] {
  const assigned = mods.filter((m) => m.assigned).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.sortOrder - b.sortOrder);
  const recommended = mods.filter((m) => !m.assigned && m.forYou);
  const rest = mods.filter((m) => !m.assigned && !m.forYou && m.audiences.includes("everyone"));
  return [...assigned, ...recommended, ...rest];
}

/** Next lesson to open in a module (first not completed, or the first one). */
export function nextLesson(m: CatalogModule) {
  return m.lessons.find((l) => !l.completed) ?? m.lessons[0];
}
