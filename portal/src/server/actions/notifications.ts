"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";

export async function markNotificationsReadAction(): Promise<void> {
  const v = await actionViewer();
  await db()
    .update(t.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(t.notifications.userId, v.user.id), isNull(t.notifications.readAt)));
  refresh();
}
