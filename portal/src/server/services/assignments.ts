/**
 * Resolves who has to learn what. Assignments target everyone, a department (with its
 * sub-departments) or one person, and point at a module or a learning path.
 */
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";

export type AssignedModule = {
  moduleId: string;
  assignmentId: string;
  pathId: string | null;
  /** YYYY-MM-DD, the earliest due date across assignments. */
  due: string | null;
};

export type UserLite = { id: string; departmentId: string | null; createdAt: Date };
type Target = Pick<typeof t.assignments.$inferSelect, "scope" | "departmentId" | "userId">;

/** The people one assignment targets: everyone, a department with its sub-departments, or one person. */
export function targetsOf(a: Target, users: UserLite[], closure: Map<string, Set<string>>): UserLite[] {
  return users.filter((u) => {
    if (a.scope === "everyone") return true;
    if (a.scope === "user") return u.id === a.userId;
    return !!(a.departmentId && u.departmentId && closure.get(a.departmentId)?.has(u.departmentId));
  });
}

/** All department ids under each department (inclusive). */
export function departmentClosure(departments: { id: string; parentId: string | null }[]): Map<string, Set<string>> {
  const children = new Map<string, string[]>();
  for (const d of departments) {
    if (!d.parentId) continue;
    const list = children.get(d.parentId) ?? [];
    list.push(d.id);
    children.set(d.parentId, list);
  }
  const closure = new Map<string, Set<string>>();
  for (const d of departments) {
    const set = new Set<string>([d.id]);
    const stack = [...(children.get(d.id) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (set.has(id)) continue;
      set.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    closure.set(d.id, set);
  }
  return closure;
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Module ids visible to a tenant for a slug: the tenant's own module wins over the library one. */
async function moduleIdsBySlug(db: DB, tenantId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: t.modules.id, slug: t.modules.slug, tenantId: t.modules.tenantId })
    .from(t.modules)
    .where(and(or(isNull(t.modules.tenantId), eq(t.modules.tenantId, tenantId)), eq(t.modules.status, "published")));
  const map = new Map<string, string>();
  for (const r of rows) if (!map.has(r.slug) || r.tenantId) map.set(r.slug, r.id);
  return map;
}

/** Assignments, people, department closure and path contents of a tenant, loaded once. */
async function loadAssignments(db: DB, tenantId: string, onlyUserIds?: string[]) {
  const [assignments, departments, users, slugMap] = await Promise.all([
    db.select().from(t.assignments).where(eq(t.assignments.tenantId, tenantId)),
    db.select({ id: t.departments.id, parentId: t.departments.parentId }).from(t.departments).where(eq(t.departments.tenantId, tenantId)),
    db
      .select({ id: t.users.id, departmentId: t.users.departmentId, createdAt: t.users.createdAt })
      .from(t.users)
      .where(
        and(
          eq(t.users.tenantId, tenantId),
          ne(t.users.status, "deleted"),
          onlyUserIds && onlyUserIds.length ? inArray(t.users.id, onlyUserIds) : undefined,
        ),
      ),
    moduleIdsBySlug(db, tenantId),
  ]);
  const pathIds = [...new Set(assignments.map((a) => a.pathId).filter((x): x is string => !!x))];
  const paths = pathIds.length
    ? await db.select({ id: t.learningPaths.id, moduleSlugs: t.learningPaths.moduleSlugs }).from(t.learningPaths).where(inArray(t.learningPaths.id, pathIds))
    : [];
  const pathModules = new Map(paths.map((p) => [p.id, p.moduleSlugs.map((s) => slugMap.get(s)).filter((x): x is string => !!x)]));
  const closure = departmentClosure(departments);
  const modulesOf = (a: (typeof assignments)[number]) => (a.moduleId ? [a.moduleId] : a.pathId ? (pathModules.get(a.pathId) ?? []) : []);
  return { assignments, users: users as UserLite[], closure, modulesOf };
}

export async function resolveAssignments(db: DB, tenantId: string, onlyUserIds?: string[]): Promise<Map<string, Map<string, AssignedModule>>> {
  const { assignments, users, closure, modulesOf } = await loadAssignments(db, tenantId, onlyUserIds);
  const result = new Map<string, Map<string, AssignedModule>>();
  for (const u of users) result.set(u.id, new Map());

  for (const a of assignments) {
    const moduleIds = modulesOf(a);
    if (!moduleIds.length) continue;
    for (const u of targetsOf(a, users, closure)) {
      const due = a.dueKind === "fixed" ? a.dueDate : a.dueKind === "after_joining" && a.dueDays ? addDays(u.createdAt, a.dueDays) : null;
      const map = result.get(u.id)!;
      for (const moduleId of moduleIds) {
        const prev = map.get(moduleId);
        map.set(moduleId, {
          moduleId,
          assignmentId: prev?.assignmentId ?? a.id,
          pathId: prev?.pathId ?? a.pathId ?? null,
          due: earlier(prev?.due ?? null, due),
        });
      }
    }
  }
  return result;
}

export async function assignedForUser(db: DB, tenantId: string, userId: string): Promise<Map<string, AssignedModule>> {
  return (await resolveAssignments(db, tenantId, [userId])).get(userId) ?? new Map();
}

/**
 * Users targeted by each assignment (for "9 of 34 completed" on the assignments page and the
 * "new assignment" notice). Two assignments covering the same module both report their full audience.
 */
export async function assignmentTargets(db: DB, tenantId: string): Promise<Map<string, Set<string>>> {
  const { assignments, users, closure, modulesOf } = await loadAssignments(db, tenantId);
  const byAssignment = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!modulesOf(a).length) continue;
    byAssignment.set(a.id, new Set(targetsOf(a, users, closure).map((u) => u.id)));
  }
  return byAssignment;
}
