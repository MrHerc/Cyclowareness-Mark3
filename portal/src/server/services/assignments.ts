/**
 * Resolves who has to learn what. Assignments target everyone, a department (with its
 * sub-departments) or one person, and point at a module or a learning path.
 */
import { cache } from "react";
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { bakuDayPlus } from "../../lib/time";

export type AssignedModule = {
  moduleId: string;
  assignmentId: string;
  pathId: string | null;
  /** YYYY-MM-DD, the earliest due date across assignments. */
  due: string | null;
  /**
   * When the person became subject to it: the assignment's creation, or the person's own start when
   * that is later (see assignedSince).
   */
  assignedAt: Date;
};

export type UserLite = { id: string; departmentId: string | null; createdAt: Date; activatedAt?: Date | null; departmentChangedAt?: Date | null };
type Target = Pick<typeof t.assignments.$inferSelect, "scope" | "departmentId" | "userId">;

/**
 * When a person became subject to an assignment, the start of their reminder clock: the latest of
 * the assignment's creation, the account's creation, its activation (an invite accepted later) and,
 * for a department assignment, the person's department date. Someone added, activated or moved into
 * the department today was assigned today, not when the assignment was created.
 *
 * The department date (users.department_changed_at) moves only when a department change puts the
 * person under a department assignment that did not cover them before (see gainsCoverage), so moves
 * between sub-departments of the assigning department, re-parenting and merges whose assignments
 * follow the people leave it alone. It is one date per person: when a move does add an assignment,
 * the department assignments that already covered them also count from the move (one extra reminder).
 */
export function assignedSince(a: Pick<typeof t.assignments.$inferSelect, "scope" | "createdAt">, u: UserLite): Date {
  const start = personStart(u);
  let since = a.createdAt > start ? a.createdAt : start;
  if (a.scope === "department" && u.departmentChangedAt && u.departmentChangedAt > since) since = u.departmentChangedAt;
  return since;
}

/** The person's own start: the account's creation, or its activation when an invite was accepted later. */
function personStart(u: UserLite): Date {
  return u.activatedAt && u.activatedAt > u.createdAt ? u.activatedAt : u.createdAt;
}

/** One assignment's due day (YYYY-MM-DD) for one person: the fixed date, N days after their start, or none. */
export function dueFor(a: Pick<typeof t.assignments.$inferSelect, "dueKind" | "dueDate" | "dueDays">, u: UserLite): string | null {
  return a.dueKind === "fixed" ? a.dueDate : a.dueKind === "after_joining" && a.dueDays ? bakuDayPlus(a.dueDays, personStart(u)) : null;
}

/** The people one assignment targets: everyone, a department with its sub-departments, or one person. */
export function targetsOf(a: Target, users: UserLite[], closure: Map<string, Set<string>>): UserLite[] {
  return users.filter((u) => {
    if (a.scope === "everyone") return true;
    if (a.scope === "user") return u.id === a.userId;
    return !!(a.departmentId && u.departmentId && closure.get(a.departmentId)?.has(u.departmentId));
  });
}

type DepartmentAssignment = Pick<typeof t.assignments.$inferSelect, "id" | "scope" | "departmentId">;

/** Ids of the department assignments covering a department: set on it or on a department above it. */
export function coveringAssignments(assignments: DepartmentAssignment[], closure: Map<string, Set<string>>, departmentId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!departmentId) return ids;
  for (const a of assignments) if (a.scope === "department" && a.departmentId && closure.get(a.departmentId)?.has(departmentId)) ids.add(a.id);
  return ids;
}

/** Whether a department change put someone under a department assignment that did not cover them before. */
export function gainsCoverage(before: Set<string>, after: Set<string>): boolean {
  for (const id of after) if (!before.has(id)) return true;
  return false;
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
      .select({ id: t.users.id, departmentId: t.users.departmentId, createdAt: t.users.createdAt, activatedAt: t.users.activatedAt, departmentChangedAt: t.users.departmentChangedAt })
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
  return resolveLoaded(await loadAssignments(db, tenantId, onlyUserIds));
}

function resolveLoaded({ assignments, users, closure, modulesOf }: Awaited<ReturnType<typeof loadAssignments>>): Map<string, Map<string, AssignedModule>> {
  const result = new Map<string, Map<string, AssignedModule>>();
  for (const u of users) result.set(u.id, new Map());

  for (const a of assignments) {
    const moduleIds = modulesOf(a);
    if (!moduleIds.length) continue;
    for (const u of targetsOf(a, users, closure)) {
      const due = dueFor(a, u);
      const since = assignedSince(a, u);
      const map = result.get(u.id)!;
      for (const moduleId of moduleIds) {
        const prev = map.get(moduleId);
        map.set(moduleId, {
          moduleId,
          assignmentId: prev?.assignmentId ?? a.id,
          pathId: prev?.pathId ?? a.pathId ?? null,
          due: earlier(prev?.due ?? null, due),
          assignedAt: prev && prev.assignedAt < since ? prev.assignedAt : since,
        });
      }
    }
  }
  return result;
}

/** One person's load, cached per request (a no-op outside one): the catalog and the paths pages each need it. */
const loadForUser = cache((db: DB, tenantId: string, userId: string) => loadAssignments(db, tenantId, [userId]));

export async function assignedForUser(db: DB, tenantId: string, userId: string): Promise<Map<string, AssignedModule>> {
  return resolveLoaded(await loadForUser(db, tenantId, userId)).get(userId) ?? new Map();
}

type PathAssignment = Target & Pick<typeof t.assignments.$inferSelect, "pathId" | "dueKind" | "dueDate" | "dueDays">;

/**
 * The learning paths assigned to one person, each with the earliest due day of the assignments that reach them.
 * Only assignments that target the person count: a path assigned to another department is not theirs, even when
 * some of its modules are assigned to them on their own.
 */
export function pathsAssignedTo(assignments: PathAssignment[], user: UserLite, closure: Map<string, Set<string>>): Map<string, string | null> {
  const paths = new Map<string, string | null>();
  for (const a of assignments) {
    if (!a.pathId || !targetsOf(a, [user], closure).length) continue;
    const due = dueFor(a, user);
    paths.set(a.pathId, paths.has(a.pathId) ? earlier(paths.get(a.pathId)!, due) : due);
  }
  return paths;
}

export async function assignedPathsForUser(db: DB, tenantId: string, userId: string): Promise<Map<string, string | null>> {
  const { assignments, users, closure } = await loadForUser(db, tenantId, userId);
  return users[0] ? pathsAssignedTo(assignments, users[0], closure) : new Map();
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
