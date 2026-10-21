import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";

/**
 * The policy a detail page shows, or notFound() for a junk id or a policy of another tenant. The layout
 * runs it before loading.tsx streams the skeleton, so those cases answer HTTP 404 instead of a 200 that
 * carries the not-found UI; cache() lets the page reuse the same lookup within the request.
 */
export const policyForPage = cache(async (id: string) => {
  const v = await requirePermission("policies.read");
  if (!isUuid(id)) notFound();
  const [policy] = await db().select().from(t.policies).where(and(eq(t.policies.id, id), eq(t.policies.tenantId, v.tenant.id)));
  if (!policy) notFound();
  return { v, policy };
});
