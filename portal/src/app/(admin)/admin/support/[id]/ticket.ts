import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

/**
 * The support ticket a detail page shows, or notFound() for a plan without the feature, a junk id or a
 * ticket of another tenant. The layout runs it before loading.tsx streams the skeleton, so those cases
 * answer HTTP 404 instead of a 200 that carries the not-found UI; cache() lets the page reuse the same
 * lookup within the request.
 */
export const ticketForPage = cache(async (id: string) => {
  const v = await requirePermission("support.manage");
  if (!hasFeature(v, "support")) notFound();
  if (!isUuid(id)) notFound();
  const [ticket] = await db().select().from(t.supportTickets).where(and(eq(t.supportTickets.id, id), eq(t.supportTickets.tenantId, v.tenant.id)));
  if (!ticket) notFound();
  return { v, ticket };
});
