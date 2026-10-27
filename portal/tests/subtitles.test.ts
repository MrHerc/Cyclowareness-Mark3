import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { plain, type Scene } from "../src/lib/content/types";
import { TRANSLATABLE } from "../src/lib/content/locale-parity";
import { SUBTITLE_LANGUAGES, isSubtitleLanguage, subtitleLanguageOptions } from "../src/lib/content/subtitle-languages";

const state = vi.hoisted(() => ({
  viewer: null as null | { user: { id: string }; tenant: { id: string; features: Set<string> } },
  studio: false,
  locale: "en",
  env: { APP_URL: "http://localhost:3000", TRUST_PROXY: 0, ANTHROPIC_API_KEY: "test-key" as string | undefined, ANTHROPIC_TUTOR_MODEL: "claude-haiku-5-5" },
}));
const limit = vi.hoisted(() => vi.fn(async (key: string, max: number, windowMs: number) => (void [key, max, windowMs], { ok: true, retryAfterMs: 0 })));

// The model translates each line by prefixing it; `answer` lets a test break the reply.
type ModelParams = { model: string; system: string; tools: { name: string; strict?: boolean }[]; tool_choice: unknown; messages: { content: string }[] };
const model = vi.hoisted(() => ({
  calls: [] as ModelParams[],
  answer: null as null | ((lines: string[]) => unknown),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: (params: ModelParams) => {
        model.calls.push(params);
        const text = params.messages[0].content;
        const lines = JSON.parse(text.slice(text.indexOf("\n") + 1)) as string[];
        return {
          finalMessage: async () =>
            model.answer?.(lines) ?? { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_1", name: "save_subtitles", input: { lines: lines.map((l) => `ES ${l}`) } }] },
        };
      },
    };
  },
}));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: state.env, appUrl: () => state.env.APP_URL }));
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => state.viewer, allowed: () => state.studio }));
vi.mock("next-intl/server", () => ({ getLocale: async () => state.locale }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: limit }));

const { spokenTexts, subtitleSourceLines, subtitleCacheId, subtitleMap, validTranslation, subtitleSystemPrompt } = await import("../src/server/subtitles");
const { POST } = await import("../src/app/api/subtitles/route");

const root = path.join(__dirname, "..", "content", "library");
const lessonScenes = (slug: string, id: string, locale = "en") => (JSON.parse(readFileSync(path.join(root, "lessons", slug, `${id}.${locale}.json`), "utf8")) as { scenes: Scene[] }).scenes;
const said = (scenes: Scene[]) => spokenTexts(scenes).map((s) => s.parts.join(s.sep));
const sceneOf = <K extends Scene["type"]>(scenes: Scene[], type: K) => scenes.find((s): s is Extract<Scene, { type: K }> => s.type === type)!;

describe("spokenTexts", () => {
  it("lists the strings the player speaks in real lessons, composed the way the scenes compose them", () => {
    const ceo = lessonScenes("phishing-email", "ceo-fraud");
    const intro = sceneOf(ceo, "intro");
    expect(said(ceo)).toContain(`${intro.title}. ${intro.body}`);

    const consent = lessonScenes("app-consent-phishing", "consent-screen");
    const choice = sceneOf(consent, "choice");
    const [send, offline, profile] = choice.question.options;
    const recap = sceneOf(consent, "recap");
    expect(said(consent)).toEqual(
      expect.arrayContaining([
        choice.question.prompt,
        // Time up: the explanation only; right: the picked options' feedback; wrong: the missed then the extra ones'.
        choice.explain,
        `${send.feedback} ${offline.feedback} ${choice.explain}`,
        `${offline.feedback} ${profile.feedback} ${choice.explain}`,
        recap.points.join(". "),
      ]),
    );

    const call = lessonScenes("authority-scams", "fake-prosecutor-call");
    const sim = sceneOf(call, "simulation");
    const step = sim.steps.find((s) => s.spoken)!;
    const order = sceneOf(call, "order");
    // A call step narrates `spoken`; the tip's replay button reads `say`.
    expect(said(call)).toEqual(expect.arrayContaining([sim.intro, step.spoken, step.say, ...step.actions.map((a) => a.feedback), order.prompt, order.explain]));

    const meeting = lessonScenes("app-consent-phishing", "meeting-code");
    const scenario = sceneOf(meeting, "scenario");
    expect(said(meeting)).toEqual(expect.arrayContaining(scenario.nodes.flatMap((n) => [n.spoken ?? n.text, ...(n.choices ?? []).map((c) => c.feedback)])));

    const mfa = lessonScenes("passwords-mfa", "mfa");
    const beats = mfa.flatMap((s) => (s.type === "tutor" ? s.beats : []));
    const checkpoint = beats.find((b) => b.checkpoint)!.checkpoint as { prompt: string; options: { feedback: string }[] };
    expect(said(mfa)).toEqual(expect.arrayContaining([...beats.map((b) => b.say), checkpoint.prompt, ...checkpoint.options.map((o) => o.feedback)]));
  });

  it("speaks only text a translation changes (the TRANSLATABLE keys), in every library lesson", () => {
    const modules = JSON.parse(readFileSync(path.join(root, "modules.json"), "utf8")) as { slug: string; lessons: { id: string }[] }[];
    for (const m of modules) {
      for (const l of m.lessons) {
        const scenes = lessonScenes(m.slug, l.id);
        const text = new Set<string>();
        const walk = (v: unknown) => {
          if (!v || typeof v !== "object") return;
          for (const [k, x] of Object.entries(v)) {
            if (TRANSLATABLE.has(k) && typeof x === "string") text.add(x);
            else if (TRANSLATABLE.has(k) && Array.isArray(x)) {
              for (const y of x) if (typeof y === "string") text.add(y);
              // A chat message's body is rich text (spans) the narrator reads as plain text.
              if (x.some((y) => typeof y === "object")) text.add(plain(x as never));
            }
            walk(x);
          }
        };
        walk(scenes);
        for (const s of spokenTexts(scenes)) for (const part of s.parts) expect(text.has(part), `${m.slug}/${l.id}: ${part}`).toBe(true);
      }
    }
  });

  it("is stable and has the same shape in every language of a lesson", () => {
    for (const [slug, id] of [
      ["app-consent-phishing", "consent-screen"],
      ["authority-scams", "fake-prosecutor-call"],
      ["app-consent-phishing", "meeting-code"],
      ["passwords-mfa", "mfa"],
    ]) {
      const en = spokenTexts(lessonScenes(slug, id));
      expect(spokenTexts(lessonScenes(slug, id))).toEqual(en);
      for (const locale of ["az", "ru"]) {
        expect(spokenTexts(lessonScenes(slug, id, locale)).map((s) => [s.parts.length, s.sep]), `${slug}/${id}.${locale}`).toEqual(en.map((s) => [s.parts.length, s.sep]));
      }
    }
  });
});

describe("subtitle lines and cache", () => {
  const call = lessonScenes("authority-scams", "fake-prosecutor-call");

  it("sends each distinct spoken text once, in first-spoken order, without stage directions", () => {
    const spoken = spokenTexts(call);
    const lines = subtitleSourceLines(spoken);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.some((l) => /<breath>|<[a-z -]+>/.test(l))).toBe(false);
    expect(spoken.some((s) => s.parts.some((p) => p.includes("<breath>")))).toBe(true);
    expect(subtitleSourceLines(spoken)).toEqual(lines);

    // The map is keyed by the exact string passed to speak(); the caption is the translation of what is heard.
    const map = subtitleMap(spoken, lines, lines.map((l) => `ES ${l}`));
    const step = sceneOf(call, "simulation").steps.find((s) => s.spoken?.includes("<breath>"))!;
    expect(map[step.spoken!]).toBe(`ES ${step.spoken!.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()}`);
  });

  it("joins composed strings from their translated parts", () => {
    const scenes: Scene[] = [
      { type: "intro", id: "i", title: "Your turn", body: "Friday, 15:05." },
      { type: "recap", id: "r", points: ["Check the sender", "Report it"] },
    ];
    const spoken = spokenTexts(scenes);
    const lines = subtitleSourceLines(spoken);
    expect(lines).toEqual(["Your turn", "Friday, 15:05.", "Check the sender", "Report it"]);
    expect(subtitleMap(spoken, lines, ["Tu turno", "Viernes, 15:05.", "Comprueba el remitente", "Denúncialo"])).toEqual({
      "Your turn. Friday, 15:05.": "Tu turno. Viernes, 15:05.",
      "Check the sender. Report it": "Comprueba el remitente. Denúncialo",
    });
  });

  it("changes the cache key when the lesson text, the languages or the lesson change", () => {
    const lines = subtitleSourceLines(spokenTexts(call));
    const id = subtitleCacheId("lesson-1", "en", "es", lines);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(subtitleCacheId("lesson-1", "en", "es", [...lines])).toBe(id);
    const edited = [...lines];
    edited[3] = `${edited[3]}!`;
    expect(subtitleCacheId("lesson-1", "en", "es", edited)).not.toBe(id);
    expect(subtitleCacheId("lesson-1", "en", "es", [...lines].reverse())).not.toBe(id);
    expect(subtitleCacheId("lesson-1", "en", "es", lines.slice(1))).not.toBe(id);
    expect(subtitleCacheId("lesson-1", "en", "pt", lines)).not.toBe(id);
    expect(subtitleCacheId("lesson-1", "az", "es", lines)).not.toBe(id);
    expect(subtitleCacheId("lesson-2", "en", "es", lines)).not.toBe(id);
  });

  it("accepts only one non-empty, bounded line per source line", () => {
    const source = ["Check the sender.", "Report it."];
    expect(validTranslation(source, ["Comprueba el remitente.", "Denúncialo."])).toBe(true);
    expect(validTranslation(source, ["Comprueba el remitente."])).toBe(false);
    expect(validTranslation(source, ["Comprueba el remitente.", "Denúncialo.", "Extra."])).toBe(false);
    expect(validTranslation(source, ["Comprueba el remitente.", "  "])).toBe(false);
    expect(validTranslation(source, ["Comprueba el remitente.", "x".repeat(121)])).toBe(false);
    expect(validTranslation(source, ["Comprueba el remitente.", 3])).toBe(false);
    expect(validTranslation(source, { lines: source })).toBe(false);
  });

  it("names both languages in the prompt", () => {
    expect(subtitleSystemPrompt("az", "es")).toContain("from Azerbaijani into Spanish (es)");
  });
});

describe("subtitle languages", () => {
  const SHIPPED = ["az", "en", "ru", "tr", "ro", "ka", "uk", "de", "fr", "ar"];

  it("never offers a language the library ships", () => {
    expect(SUBTITLE_LANGUAGES.filter((c) => SHIPPED.includes(c))).toEqual([]);
    expect(new Set(SUBTITLE_LANGUAGES).size).toBe(SUBTITLE_LANGUAGES.length);
    for (const code of SUBTITLE_LANGUAGES) expect(code).toMatch(/^[a-z]{2}$/);
    for (const bad of [...SHIPPED, "xx", "ES", "es-ES", "__proto__", "", null, 1]) expect(isSubtitleLanguage(bad), String(bad)).toBe(false);
  });

  it("names each language in the interface language and in itself, sorted for the picker", () => {
    const options = subtitleLanguageOptions("en");
    expect(options).toHaveLength(SUBTITLE_LANGUAGES.length);
    expect(options.find((o) => o.code === "es")).toEqual({ code: "es", name: "Spanish", native: "español", dir: "ltr" });
    expect(options.find((o) => o.code === "he")?.dir).toBe("rtl");
    expect(options.map((o) => o.name)).toEqual([...options.map((o) => o.name)].sort((a, b) => a.localeCompare(b, "en")));
    expect(subtitleLanguageOptions("ru").find((o) => o.code === "es")?.name).toBe("испанский");
  });
});

describe("POST /api/subtitles", () => {
  const USER = "00000000-0000-4000-8000-000000000001";
  let own = "";
  let other = "";
  let library = "";
  let foreign = "";
  let draft = "";
  const enScenes = lessonScenes("app-consent-phishing", "consent-screen");
  const azScenes = lessonScenes("app-consent-phishing", "consent-screen", "az");

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    POST(
      new Request("http://localhost:3000/api/subtitles", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  beforeAll(async () => {
    await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
    [{ id: own }, { id: other }] = await db
      .insert(t.tenants)
      .values([
        { slug: "acme", name: "Acme", branding: {} as never, settings: {} as never },
        { slug: "globex", name: "Globex", branding: {} as never, settings: {} as never },
      ])
      .returning();
    const mod = { category: "phishing", audiences: [], title: { en: "M" }, subtitle: { en: "" }, minutes: 5, xp: 10, difficulty: "Easy" as const };
    const [lib, globex, unpublished] = await db
      .insert(t.modules)
      .values([
        { ...mod, slug: "app-consent-phishing", tenantId: null },
        { ...mod, slug: "globex-own", tenantId: other },
        { ...mod, slug: "acme-draft", tenantId: own, status: "draft" },
      ])
      .returning();
    const lesson = { key: "l1", title: { en: "L" }, minutes: 5, position: 1 };
    [{ id: library }, { id: foreign }, { id: draft }] = await db
      .insert(t.lessons)
      .values([
        { ...lesson, moduleId: lib.id },
        { ...lesson, moduleId: globex.id },
        { ...lesson, moduleId: unpublished.id },
      ])
      .returning();
    await db.insert(t.lessonContents).values([
      { lessonId: library, locale: "en", scenes: enScenes },
      { lessonId: library, locale: "az", scenes: azScenes },
      { lessonId: foreign, locale: "en", scenes: enScenes },
      { lessonId: draft, locale: "en", scenes: enScenes },
    ]);
    // Starting the embedded database and applying the migrations takes a while.
  }, 180_000);

  beforeEach(() => {
    state.viewer = { user: { id: USER }, tenant: { id: own, features: new Set(["ai_tutor"]) } };
    state.studio = false;
    state.locale = "en";
    state.env.ANTHROPIC_API_KEY = "test-key";
    model.answer = null;
    limit.mockReset().mockResolvedValue({ ok: true, retryAfterMs: 0 });
  });

  it("translates what the player narrates with one model call, then serves the cached translation", async () => {
    const before = model.calls.length;
    const res = await post({ lessonId: library, target: "es" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { lang: string; source: string; lines: Record<string, string> };
    expect(body.lang).toBe("es");
    expect(body.source).toBe("en");
    expect(Object.keys(body.lines).sort()).toEqual([...new Set(said(enScenes))].sort());
    const choice = sceneOf(enScenes, "choice");
    expect(body.lines[choice.question.prompt]).toBe(`ES ${choice.question.prompt}`);
    expect(body.lines[choice.explain!]).toBe(`ES ${choice.explain}`);

    expect(model.calls.length).toBe(before + 1);
    const request = model.calls.at(-1)!;
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.tools[0]).toMatchObject({ name: "save_subtitles", strict: true });
    expect(request.tool_choice).toEqual({ type: "auto" });
    expect(request.system).toContain("into Spanish (es)");
    expect(request.messages[0].content).not.toContain(USER);

    const again = await post({ lessonId: library, target: "es" });
    expect(await again.json()).toEqual(body);
    expect(model.calls.length).toBe(before + 1);
    const rows = await db.select().from(t.aiCache).where(and(eq(t.aiCache.lessonId, library), eq(t.aiCache.locale, "es")));
    expect(rows).toEqual([expect.objectContaining({ kind: "subtitles", model: "claude-haiku-5-5" })]);
  });

  it("translates the lesson text in the person's interface language, else English", async () => {
    state.locale = "az";
    const az = (await (await post({ lessonId: library, target: "es" })).json()) as { source: string; lines: Record<string, string> };
    expect(az.source).toBe("az");
    expect(Object.keys(az.lines).sort()).toEqual([...new Set(said(azScenes))].sort());

    // No Russian text in this test database: the player narrates English, so the English subtitles come back.
    state.locale = "ru";
    const calls = model.calls.length;
    const ru = (await (await post({ lessonId: library, target: "es" })).json()) as { source: string };
    expect(ru.source).toBe("en");
    expect(model.calls.length).toBe(calls);
  });

  it("translates again when the lesson text changes", async () => {
    await post({ lessonId: library, target: "it" });
    const calls = model.calls.length;
    const recap = sceneOf(enScenes, "recap");
    const points = [...recap.points.slice(0, -1), "Report odd consent screens."];
    const edited = enScenes.map((s) => (s.type === "recap" ? { ...recap, points } : s));
    await db.update(t.lessonContents).set({ scenes: edited }).where(and(eq(t.lessonContents.lessonId, library), eq(t.lessonContents.locale, "en")));
    try {
      const body = (await (await post({ lessonId: library, target: "it" })).json()) as { lines: Record<string, string> };
      expect(model.calls.length).toBe(calls + 1);
      expect(body.lines[points.join(". ")]).toBe(points.map((p) => `ES ${p}`).join(". "));
    } finally {
      await db.update(t.lessonContents).set({ scenes: enScenes }).where(and(eq(t.lessonContents.lessonId, library), eq(t.lessonContents.locale, "en")));
    }
  });

  it("answers 503 without an API key unless the translation is cached", async () => {
    await post({ lessonId: library, target: "es" });
    state.env.ANTHROPIC_API_KEY = undefined;
    const calls = model.calls.length;
    const res = await post({ lessonId: library, target: "nl" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ai_unavailable" });
    expect((await post({ lessonId: library, target: "es" })).status).toBe(200);
    expect(model.calls.length).toBe(calls);
  });

  it("rejects shipped, unknown and malformed languages and ids", async () => {
    const calls = model.calls.length;
    for (const target of ["az", "en", "ru", "tr", "ro", "ka", "uk", "de", "fr", "ar", "xx", "ES", "es-ES", "", "__proto__", null, 7]) {
      const res = await post({ lessonId: library, target });
      expect(res.status, String(target)).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_request" });
    }
    expect((await post({ lessonId: "not-a-uuid", target: "es" })).status).toBe(400);
    expect((await post({ target: "es" })).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ lessonId: library, target: "es", pad: "x".repeat(2000) })).status).toBe(413);
    expect(model.calls.length).toBe(calls);
  });

  it("hides other organisations' lessons, and drafts from everyone but studio authors", async () => {
    const calls = model.calls.length;
    for (const lessonId of [foreign, draft, "00000000-0000-4000-8000-00000000ffff"]) {
      const res = await post({ lessonId, target: "es" });
      expect(res.status, lessonId).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
    expect(model.calls.length).toBe(calls);
    state.studio = true;
    expect((await post({ lessonId: draft, target: "es" })).status).toBe(200);
    expect((await post({ lessonId: foreign, target: "es" })).status).toBe(404);
  });

  it("needs the same origin, a signed-in person and the AI tutor feature", async () => {
    expect((await post({ lessonId: library, target: "es" }, { origin: "https://evil.test" })).status).toBe(403);
    state.viewer = null;
    expect((await post({ lessonId: library, target: "es" })).status).toBe(401);
    state.viewer = { user: { id: USER }, tenant: { id: own, features: new Set() } };
    const res = await post({ lessonId: library, target: "es" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_available" });
    expect(limit).not.toHaveBeenCalled();
  });

  it("limits request volume per person, and model calls per person per ten minutes and per person and organisation per day", async () => {
    limit.mockResolvedValueOnce({ ok: false, retryAfterMs: 29_500 });
    const res = await post({ lessonId: library, target: "es" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(limit).toHaveBeenCalledWith(`subtitles:${USER}`, 60, 10 * 60_000);

    // A cached translation costs nothing: only the request-volume limit counts it.
    limit.mockClear();
    expect((await post({ lessonId: library, target: "es" })).status).toBe(200);
    expect(limit.mock.calls.map((c) => c[0])).toEqual([`subtitles:${USER}`]);

    limit.mockClear().mockImplementation(async (key: string) => ({ ok: !key.startsWith("subtitles-day:t:"), retryAfterMs: key.startsWith("subtitles-day:t:") ? 60_000 : 0 }));
    const calls = model.calls.length;
    const capped = await post({ lessonId: library, target: "pt" });
    expect(capped.status).toBe(429);
    expect(model.calls.length).toBe(calls);
    expect(limit.mock.calls.map((c) => c.slice(0, 3))).toEqual([
      [`subtitles:${USER}`, 60, 10 * 60_000],
      [`subtitles-ai:${USER}`, 6, 10 * 60_000],
      [`subtitles-day:${USER}`, 30, 24 * 60 * 60_000],
      [`subtitles-day:t:${own}`, 300, 24 * 60 * 60_000],
    ]);
  });

  it("makes one model call for concurrent requests of the same translation", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    model.answer = (lines) => gate.then(() => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_1", name: "save_subtitles", input: { lines: lines.map((l) => `FI ${l}`) } }] }));
    const calls = model.calls.length;
    const pending = [post({ lessonId: library, target: "fi" }), post({ lessonId: library, target: "fi" }), post({ lessonId: library, target: "fi" })];
    await vi.waitFor(() => expect(model.calls.length).toBe(calls + 1));
    // Give the other requests time to find the running translation before it finishes.
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    const bodies = await Promise.all((await Promise.all(pending)).map((r) => (expect(r.status).toBe(200), r.json())));
    expect(model.calls.length).toBe(calls + 1);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(Object.values((bodies[0] as { lines: Record<string, string> }).lines).every((l) => l.startsWith("FI "))).toBe(true);
  });

  it("refuses an unusable model answer without caching it or showing internals", async () => {
    const answers: ((lines: string[]) => unknown)[] = [
      (lines) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_1", name: "save_subtitles", input: { lines: lines.slice(1) } }] }),
      (lines) => ({ stop_reason: "max_tokens", content: [{ type: "tool_use", id: "tu_1", name: "save_subtitles", input: { lines } }] }),
      () => ({ stop_reason: "refusal", content: [] }),
      () => {
        throw new Error("upstream 529 overloaded sk-ant-secret");
      },
    ];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const answer of answers) {
        model.answer = answer;
        const res = await post({ lessonId: library, target: "sv" });
        expect(res.status).toBe(502);
        expect(await res.text()).toBe(JSON.stringify({ error: "ai_failed" }));
      }
      // Each failure is logged, by its error class only: never the message, which can carry a key or the lesson text.
      const logged = warn.mock.calls.map((c) => c.join(" "));
      expect(logged).toHaveLength(answers.length);
      expect(logged.at(-1)).toBe("[subtitles] translation into sv failed: Error");
      expect(logged.join(" ")).not.toMatch(/sk-ant|overloaded|529/);
    } finally {
      warn.mockRestore();
    }
    expect(await db.select().from(t.aiCache).where(eq(t.aiCache.locale, "sv"))).toEqual([]);
  });
});
