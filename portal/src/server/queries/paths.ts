import "server-only";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db, t } from "../db";
import type { Viewer } from "../auth/viewer";
import { getCatalog, type CatalogModule } from "./catalog";
import { pick } from "../../i18n/config";

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
  done: number;
  assigned: boolean;
  certificateToken: string | null;
};

export async function getPaths(v: Viewer, locale: string): Promise<PathView[]> {
  const [paths, catalog, assignments, certs] = await Promise.all([
    db()
      .select()
      .from(t.learningPaths)
      .where(or(isNull(t.learningPaths.tenantId), eq(t.learningPaths.tenantId, v.tenant.id))),
    getCatalog(v, locale),
    db().select({ pathId: t.assignments.pathId }).from(t.assignments).where(and(eq(t.assignments.tenantId, v.tenant.id), isNotNull(t.assignments.pathId))),
    db()
      .select({ pathId: t.certificates.pathId, token: t.certificates.publicToken })
      .from(t.certificates)
      .where(and(eq(t.certificates.userId, v.user.id), isNotNull(t.certificates.pathId))),
  ]);
  const bySlug = new Map(catalog.map((m) => [m.slug, m]));
  const assignedPaths = new Set(assignments.map((a) => a.pathId));
  const certBy = new Map(certs.map((c) => [c.pathId, c.token]));
  return paths.map((p) => {
    const modules = p.moduleSlugs.map((s) => bySlug.get(s)).filter((m): m is CatalogModule => !!m);
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
      done: modules.filter((m) => m.status === "completed").length,
      assigned: assignedPaths.has(p.id) && modules.some((m) => m.assigned),
      certificateToken: certBy.get(p.id) ?? null,
    };
  });
}
