import { and, eq, isNull, or } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db, t } from "@/server/db";
import { allowed, getViewer } from "@/server/auth/viewer";
import { rateLimit } from "@/server/rate-limit";
import { sameOrigin } from "@/server/request";
import { readBodyCapped } from "@/server/request-body";
import { env } from "@/server/env";
import { SUBTITLE_MAX_SOURCE_CHARS, cachedSubtitles, runningTranslation, spokenTexts, subtitleCacheId, subtitleMap, subtitleSourceLines, translateOnce } from "@/server/subtitles";
import type { Scene } from "@/lib/content/types";
import { pickLessonContent } from "@/lib/content/lesson-locale";
import { isSubtitleLanguage } from "@/lib/content/subtitle-languages";

const requestSchema = z.object({ lessonId: z.uuid(), target: z.string().refine(isSubtitleLanguage) });

const TEN_MINUTES = 10 * 60_000;
const DAY = 24 * 60 * 60_000;

function reply(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

const refused = (error: string, status: number, retryAfterMs?: number) => reply({ error }, status, retryAfterMs ? { "retry-after": String(Math.ceil(retryAfterMs / 1000)) } : {});

/**
 * AI-translated subtitles of a lesson in a language the library does not ship. Body {lessonId, target};
 * the answer is {lang, source, lines}: each string the player speaks (from the lesson text it narrates
 * in this request's interface language) mapped to its translation. Only lesson text goes to the model.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return refused("forbidden", 403);
  const v = await getViewer();
  if (!v) return refused("unauthorized", 401);
  if (!v.tenant.features.has("ai_tutor")) return refused("not_available", 404);
  // Request volume only (a lesson opened many times, cache hits included); model calls have their own limits below.
  const limit = await rateLimit(`subtitles:${v.user.id}`, 60, TEN_MINUTES);
  if (!limit.ok) return refused("rate_limited", 429, limit.retryAfterMs);

  const raw = await readBodyCapped(request, 1024).catch(() => "");
  if (raw === null) return refused("too_large", 413);
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) return refused("bad_request", 400);
  const { lessonId, target } = parsed.data;

  const contents = await db()
    .select({ scenes: t.lessonContents.scenes, locale: t.lessonContents.locale })
    .from(t.lessonContents)
    .innerJoin(t.lessons, eq(t.lessons.id, t.lessonContents.lessonId))
    .innerJoin(t.modules, eq(t.modules.id, t.lessons.moduleId))
    .where(
      and(
        eq(t.lessonContents.lessonId, lessonId),
        or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)),
        // Drafts are reachable only by studio authors previewing them.
        allowed(v, "studio.write") ? undefined : eq(t.modules.status, "published"),
      ),
    );
  // The same text the player narrates for this person (src/app/(focus)/learn/[slug]/[lessonId]/page.tsx).
  const row = pickLessonContent(contents, await getLocale());
  if (!row) return refused("not_found", 404);

  const spoken = spokenTexts(row.scenes as Scene[]);
  const lines = subtitleSourceLines(spoken);
  const answer = (translated: readonly string[]) => reply({ lang: target, source: row.locale, lines: subtitleMap(spoken, lines, translated) });
  const settled = (translated: readonly string[] | null) => (translated ? answer(translated) : refused("ai_failed", 502));
  if (!lines.length) return answer([]);
  const id = subtitleCacheId(lessonId, row.locale, target, lines);
  const cached = await cachedSubtitles(id, lines);
  if (cached) return answer(cached);
  // The same text already being translated here: wait for it, which costs nothing either.
  const pending = runningTranslation(id);
  if (pending) return settled(await pending);

  if (!env.ANTHROPIC_API_KEY) return refused("ai_unavailable", 503);
  if (lines.reduce((n, line) => n + line.length, 0) > SUBTITLE_MAX_SOURCE_CHARS) return refused("too_long", 422);
  // Model calls only (a cached translation costs nothing): what one person can spend in ten minutes, and one person and one organisation in a day.
  for (const [key, max, windowMs] of [
    [`subtitles-ai:${v.user.id}`, 6, TEN_MINUTES],
    [`subtitles-day:${v.user.id}`, 30, DAY],
    [`subtitles-day:t:${v.tenant.id}`, 300, DAY],
  ] as const) {
    const spent = await rateLimit(key, max, windowMs);
    if (!spent.ok) return refused("rate_limited", 429, spent.retryAfterMs);
  }
  return settled(await translateOnce(id, lessonId, row.locale, target, lines));
}
