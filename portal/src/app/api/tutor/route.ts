import Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/server/db";
import { allowed, getViewer } from "@/server/auth/viewer";
import { rateLimit } from "@/server/rate-limit";
import { sha256Hex } from "@/server/crypto";
import { lessonContext, offlineAnswer, tutorSystemPrompt } from "@/server/tutor";
import { env } from "@/server/env";
import { pick } from "@/i18n/config";
import type { Scene } from "@/lib/content/types";

const bodySchema = z.object({
  slug: z.string().max(100),
  lessonKey: z.string().max(100),
  sceneId: z.string().max(100).nullish(),
  question: z.string().trim().min(2).max(500),
  locale: z.enum(["az", "en", "ru"]),
});

let client: Anthropic | null = null;

/**
 * AI tutor. Streams plain text. Only lesson context and the question are sent to the model;
 * nothing that identifies the learner. Answers are cached per lesson, scene and question.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return new Response("Forbidden", { status: 403 });
  const v = await getViewer();
  if (!v) return new Response("Unauthorized", { status: 401 });
  if (!v.tenant.features.has("ai_tutor")) return new Response("Not available", { status: 404 });
  if (!rateLimit(`tutor:${v.user.id}`, 20, 10 * 60_000).ok) return new Response("Too many questions", { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
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
  const row = rows.find((r) => r.locale === "en") ?? rows[0];
  if (!row) return new Response("Not found", { status: 404 });
  const scenes = row.scenes as Scene[];

  const normalised = question.toLowerCase().replace(/\s+/g, " ").replace(/[?!.]+$/, "");
  const cacheId = sha256Hex(`${locale}|${row.id}|${sceneId ?? ""}|${normalised}`);
  const [cached] = await db().select().from(t.tutorCache).where(eq(t.tutorCache.id, cacheId));
  const headers = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };
  if (cached) return new Response(cached.answer, { headers: { ...headers, "x-tutor-mode": "cache" } });

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(offlineAnswer(scenes, sceneId, question), { headers: { ...headers, "x-tutor-mode": "offline" } });
  }

  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const context = lessonContext(pick(mod.title, "en"), pick(row.title, "en"), scenes, sceneId);
  const stream = client.messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2000,
    system: tutorSystemPrompt(locale),
    messages: [{ role: "user", content: `Lesson context:\n${context}\n\nThe learner asks: ${question}` }],
  });

  const encoder = new TextEncoder();
  let answer = "";
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        if (answer.trim()) {
          await db()
            .insert(t.tutorCache)
            .values({ id: cacheId, tenantId: v.tenant.id, lessonId: row.id, question: question.slice(0, 500), answer, model: env.ANTHROPIC_MODEL })
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
