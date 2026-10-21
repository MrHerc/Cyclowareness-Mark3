import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/**
 * The sandbox analysis a detail page shows, or notFound() for a plan without the feature, a junk id or an
 * analysis of another tenant. The layout runs it before loading.tsx streams the skeleton, so those cases
 * answer HTTP 404 instead of a 200 that carries the not-found UI; cache() lets the page reuse the same
 * lookup within the request.
 */
export const analysisForPage = cache(async (id: string) => {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "sandbox")) notFound();
  if (!isUuid(id)) notFound();
  const [a] = await db().select().from(t.sandboxAnalyses).where(and(eq(t.sandboxAnalyses.id, id), eq(t.sandboxAnalyses.tenantId, v.tenant.id)));
  if (!a) notFound();
  return { v, a };
});
