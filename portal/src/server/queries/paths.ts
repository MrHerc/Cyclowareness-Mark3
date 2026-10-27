import "server-only";
import { cache } from "react";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { getCatalog, type CatalogModule } from "./catalog";
import { assignedPathsForUser } from "../services/assignments";
import { pick } from "../../i18n/config";
import { isLabId, labPassed, labWaitsFor, type LabId } from "../../lib/domain/labs";

export type PathLab = {
  id: LabId;
  /** The best attempt as a share of the lab's maximum (0–1), or null before the first attempt. */
  best: number | null;
  passed: boolean;
  unlocked: boolean;
  /** Slugs of the path modules whose lessons the lab still waits for (empty once unlocked or passed). */
  after: string[];
};

export type PathView = {
  id: string;
  key: string;
  title: string;
  description: string;
  audience: string;
  recurrence: string;
  mandatory: boolean;
  standards: string[];
  modules: CatalogModule[];
  /** Practice labs after the modules; empty when the tenant has no lab feature. */
  labs: PathLab[];
  done: number;
  /** Assigned to the viewer (an assignment of the path targets them). */
  assigned: boolean;
  /** The earliest due day (YYYY-MM-DD) of the viewer's assignments of the path. */
  due: string | null;
  certificateToken: string | null;
};

/**
 * The viewer's best result per lab as a share of its maximum: games, machine labs and seeded rows store different maxima.
 * Cached per request: a module page reads it for its "Practise it" labs and through getPaths.
 */
export const labBestShares = cache(async (userId: string): Promise<Map<string, number>> => {
  const rows = await db()
    .select({ exercise: t.labAttempts.exercise, share: sql<number | null>`max(${t.labAttempts.score}::float / nullif(${t.labAttempts.max}, 0))` })
    .from(t.labAttempts)
    .where(eq(t.labAttempts.userId, userId))
    .groupBy(t.labAttempts.exercise);
  return new Map(rows.filter((r) => r.share !== null).map((r) => [r.exercise, Number(r.share)]));
});

/** Paths assigned to the viewer first, then mandatory ones, then the rest; within a group the oldest first, then by key. */
export function orderPaths<T extends { id: string; key: string; mandatory: boolean; createdAt: Date }>(paths: readonly T[], assigned: { has(id: string): boolean }): T[] {
  const rank = (p: T) => (assigned.has(p.id) ? 0 : p.mandatory ? 1 : 2);
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime() || a.key.localeCompare(b.key));
}

/** `drafts` as getCatalog: a module page passes its own flag, so the paths it lists share its cached catalog. */
export async function getPaths(v: Viewer, locale: string, drafts = false): Promise<PathView[]> {
  const labsOn = v.tenant.features.has("lab");
  const [paths, catalog, assigned, certs, best] = await Promise.all([
    db()
      .select()
      .from(t.learningPaths)
      .where(or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, v.tenant.id))),
    getCatalog(v, locale, drafts),
    assignedPathsForUser(db(), v.tenant.id, v.user.id),
    db()
      .select({ pathId: t.certificates.pathId, token: t.certificates.publicToken })
      .from(t.certificates)
      .where(and(eq(t.certificates.userId, v.user.id), isNotNull(t.certificates.pathId))),
    labsOn ? labBestShares(v.user.id) : new Map<string, number>(),
  ]);
  const bySlug = new Map(catalog.map((m) => [m.slug, m]));
  const certBy = new Map(certs.map((c) => [c.pathId, c.token]));
  return orderPaths(paths, assigned).map((p) => {
    const modules = p.moduleSlugs.map((s) => bySlug.get(s)).filter((m): m is CatalogModule => !!m);
    const slugs = modules.map((m) => m.slug);
    const status = new Map(modules.map((m) => [m.slug, m.status]));
    const labs = labsOn
      ? p.labIds.filter(isLabId).map((id): PathLab => {
          const b = best.get(id) ?? null;
          const passed = labPassed(b);
          // A lab passed before its lessons (/lab stays open for practice) is not shown as locked.
          const after = passed ? [] : labWaitsFor(id, slugs, status);
          return { id, best: b, passed, unlocked: after.length === 0, after };
        })
      : [];
    return {
      id: p.id,
      key: p.key,
      title: pick(p.title, locale),
      description: pick(p.description, locale),
      audience: pick(p.audience, locale),
      recurrence: pick(p.recurrence, locale),
      mandatory: p.mandatory,
      standards: p.standards,
      modules,
      labs,
      done: modules.filter((m) => m.status === "completed").length,
      assigned: assigned.has(p.id),
      due: assigned.get(p.id) ?? null,
      certificateToken: certBy.get(p.id) ?? null,
    };
  });
}
