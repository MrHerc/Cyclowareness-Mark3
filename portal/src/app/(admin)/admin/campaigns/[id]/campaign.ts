import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";

/**
 * The campaign a detail page shows, or notFound() for a junk id or a campaign of another tenant. The
 * layout runs it before loading.tsx streams the skeleton, so those cases answer HTTP 404 instead of a 200
 * that carries the not-found UI; cache() lets the page reuse the same lookup within the request.
 */
export const campaignForPage = cache(async (id: string) => {
  const v = await requirePermission("campaigns.read");
  if (!isUuid(id)) notFound();
  const [c] = await db().select().from(t.campaigns).where(and(eq(t.campaigns.id, id), eq(t.campaigns.tenantId, v.tenant.id)));
  if (!c) notFound();
  return { v, c };
});
