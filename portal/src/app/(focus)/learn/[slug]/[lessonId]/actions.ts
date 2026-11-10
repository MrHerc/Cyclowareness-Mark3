"use server";

import { and, eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db, t } from "@/server/db";
import { actionViewer, privileged } from "@/server/auth/viewer";
import { reachableModules } from "@/server/queries/catalog";
import { rateLimit } from "@/server/rate-limit";
import { pickLessonContent } from "@/lib/content/lesson-locale";
import { isLocale } from "@/i18n/config";
import type { Scene } from "@/lib/content/types";
import { captionMap } from "./caption-map";

const input = z.object({ lessonId: z.uuid(), locale: z.string().refine(isLocale) });

/**
 * Subtitles in one of the lesson's stored languages, for the text this learner hears (the row the lesson page
 * narrates for the interface language). Null when the lesson is out of reach (as on the lesson page), has no such
 * translation, or the person asked too often (the player caches every map, so a learner never gets near it).
 */
export async function loadCaptionsAction(lessonId: string, locale: string): Promise<Record<string, string> | null> {
  const v = await actionViewer();
  const p = input.safeParse({ lessonId, locale });
  if (!p.success) return null;
  if (!(await rateLimit(`captions:${v.user.id}`, 60, 10 * 60_000)).ok) return null;
  const contents = await db()
    .select({ scenes: t.lessonContents.scenes, locale: t.lessonContents.locale })
    .from(t.lessonContents)
    .innerJoin(t.lessons, eq(t.lessons.id, t.lessonContents.lessonId))
    .innerJoin(t.modules, eq(t.modules.id, t.lessons.moduleId))
    .where(and(eq(t.lessonContents.lessonId, p.data.lessonId), reachableModules(v, privileged(v, "studio.write"))));
  const narrated = pickLessonContent(contents, await getLocale());
  const other = contents.find((c) => c.locale === p.data.locale);
  if (!narrated || !other || other.locale === narrated.locale) return null;
  return captionMap(narrated.scenes as Scene[], other.scenes as Scene[]);
}
