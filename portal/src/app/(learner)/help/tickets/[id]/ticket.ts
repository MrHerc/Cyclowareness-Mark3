import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";

/**
 * The viewer's own support ticket a /help/tickets/[id] page shows, or notFound() for a junk id or a ticket someone else
 * opened. The layout runs it before loading.tsx streams the skeleton, so those cases answer HTTP 404 instead of a 200 that
 * carries the not-found UI; cache() lets the page reuse the same lookup within the request.
 */
export const ticketForPage = cache(async (id: string) => {
  const v = await requireViewer();
  if (!isUuid(id)) notFound();
  const [ticket] = await db().select().from(t.supportTickets).where(and(eq(t.supportTickets.id, id), eq(t.supportTickets.userId, v.user.id)));
  if (!ticket) notFound();
  return { v, ticket };
});
