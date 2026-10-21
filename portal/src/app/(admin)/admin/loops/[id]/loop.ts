import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/**
 * The closed loop a detail page shows, or notFound() for a plan without the feature, a junk id or a loop
 * of another tenant. The layout runs it before loading.tsx streams the skeleton, so those cases answer
 * HTTP 404 instead of a 200 that carries the not-found UI; cache() lets the page reuse the same lookup
 * within the request.
 */
export const loopForPage = cache(async (id: string) => {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "closed_loops")) notFound();
  if (!isUuid(id)) notFound();
  const [loop] = await db().select().from(t.loops).where(and(eq(t.loops.id, id), eq(t.loops.tenantId, v.tenant.id)));
  if (!loop) notFound();
  return { v, loop };
});
