import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { scopeDepartmentIds } from "@/server/queries/admin";

/**
 * The person a profile page shows, or notFound() for a junk id, someone in another tenant, a deleted
 * account or (for a department head) someone outside the headed departments. The layout runs it before
 * loading.tsx streams the skeleton, so those cases answer HTTP 404 instead of a 200 that carries the
 * not-found UI; cache() lets the page reuse the same lookup within the request.
 */
export const personForPage = cache(async (id: string) => {
  const v = await requirePermission("people.read");
  if (!isUuid(id)) notFound();
  const [person] = await db()
    .select({ u: t.users, dept: t.departments.name })
    .from(t.users)
    .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
    .where(and(eq(t.users.id, id), eq(t.users.tenantId, v.tenant.id)));
  if (!person || person.u.status === "deleted") notFound();
  const scope = await scopeDepartmentIds(v);
  if (scope && !(person.u.departmentId && scope.has(person.u.departmentId))) notFound();
  return { v, person };
});
