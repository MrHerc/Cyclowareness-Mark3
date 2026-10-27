import Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, t } from "@/server/db";
import { allowed, getViewer } from "@/server/auth/viewer";
import { rateLimit } from "@/server/rate-limit";
import { sha256Hex } from "@/server/crypto";
import { sameOrigin } from "@/server/request";
import { readBodyCapped } from "@/server/request-body";
import { TUTOR_BODY_LIMIT, lessonContext, offlineAnswer, tutorRequest, tutorRequestSchema } from "@/server/tutor";
import { env } from "@/server/env";
import { pick } from "@/i18n/config";
import type { Scene } from "@/lib/content/types";
import { pickLessonContent } from "@/lib/content/lesson-locale";

let client: Anthropic | null = null;

/**
 * AI tutor. Streams plain text. Only lesson context and the question are sent to the model;
 * nothing that identifies the learner. Answers are cached per lesson, scene and question.
 */
export async function POST(request: Request) {
  // Same-origin only; a malformed or "null" Origin header is refused rather than thrown on.
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const v = await getViewer();
  if (!v) return new Response("Unauthorized", { status: 401 });
  if (!v.tenant.features.has("ai_tutor")) return new Response("Not available", { status: 404 });
  if (!(await rateLimit(`tutor:${v.user.id}`, 20, 10 * 60_000)).ok) return new Response("Too many questions", { status: 429 });

  // An aborted upload reads as an empty body and fails validation below.
  const raw = await readBodyCapped(request, TUTOR_BODY_LIMIT).catch(() => "");
  if (raw === null) return new Response("Payload too large", { status: 413 });
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {}
  const parsed = tutorRequestSchema.safeParse(json);
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const { slug, lessonKey, sceneId, question, locale } = parsed.data;

  const mods = await db()
    .select()
    .from(t.modules)
    .where(
      and(
        eq(t.modules.slug, slug),
        or(isNull(t.modules.tenantId), eq(t.modules.tenantId, v.tenant.id)),
        // Drafts are reachable only by studio authors previewing them.
        allowed(v, "studio.write") ? undefined : eq(t.modules.status, "published"),
      ),
    );
  const mod = mods.find((m) => m.tenantId) ?? mods[0];
  if (!mod) return new Response("Not found", { status: 404 });
  const rows = await db()
    .select({ id: t.lessons.id, title: t.lessons.title, scenes: t.lessonContents.scenes, locale: t.lessonContents.locale })
    .from(t.lessons)
    .innerJoin(t.lessonContents, eq(t.lessonContents.lessonId, t.lessons.id))
    .where(and(eq(t.lessons.moduleId, mod.id), eq(t.lessons.key, lessonKey)));
  // The lesson text in the learner's language when it exists (else English), so the context and the
  // offline answer quote what the learner is reading.
  const row = pickLessonContent(rows, locale);
  if (!row) return new Response("Not found", { status: 404 });
  const scenes = row.scenes as Scene[];

  const normalised = question.toLowerCase().replace(/\s+/g, " ").replace(/[?!.]+$/, "");
  // Answers grounded in a translation are cached apart from those grounded in the English text; the
  // ids of the latter stay as they were.
  const cacheId = sha256Hex(`${locale}|${row.id}|${sceneId ?? ""}|${normalised}${row.locale === "en" ? "" : `|${row.locale}`}`);
  const [cached] = await db().select().from(t.tutorCache).where(eq(t.tutorCache.id, cacheId));
  const headers = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
  if (cached) return new Response(cached.answer, { headers: { ...headers, "x-tutor-mode": "cache" } });

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(offlineAnswer(scenes, sceneId, question), { headers: { ...headers, "x-tutor-mode": "offline" } });
  }

  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const context = lessonContext(pick(mod.title, row.locale), pick(row.title, row.locale), scenes);
  const stream = client.messages.stream(tutorRequest(env.ANTHROPIC_TUTOR_MODEL, locale, context, scenes.find((s) => s.id === sceneId), question));

  // Wait for the first words before answering: a model that fails before saying anything gets the
  // offline answer marked as such, so the client reads it with a voice of the lesson's language and shows the offline note.
  const events = stream[Symbol.asyncIterator]();
  let first = "";
  try {
    for (;;) {
      const next = await events.next();
      if (next.done) break;
      const event = next.value;
      if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
        first = event.delta.text;
        break;
      }
    }
  } catch {
    first = "";
  }
  if (!first) {
    stream.abort();
    return new Response(offlineAnswer(scenes, sceneId, question), { headers: { ...headers, "x-tutor-mode": "offline" } });
  }

  const encoder = new TextEncoder();
  let answer = first;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(first));
        let stop: string | null = null;
        for await (const event of { [Symbol.asyncIterator]: () => events }) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          } else if (event.type === "message_delta") stop = event.delta.stop_reason;
        }
        // A refused or cut-off answer reaches this learner only; it is never cached for the next one.
        if (answer.trim() && stop === "end_turn") {
          await db()
            .insert(t.tutorCache)
            .values({ id: cacheId, tenantId: v.tenant.id, lessonId: row.id, question: question.slice(0, 500), answer, model: env.ANTHROPIC_TUTOR_MODEL })
            .onConflictDoNothing();
        }
      } catch {
        if (!answer) controller.enqueue(encoder.encode(offlineAnswer(scenes, sceneId, question)));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, { headers: { ...headers, "x-tutor-mode": "ai" } });
}
