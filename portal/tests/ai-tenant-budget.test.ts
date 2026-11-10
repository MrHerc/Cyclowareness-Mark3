import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

/**
 * Every paid model call is capped per organisation and day on top of the per-person limit, so one
 * organisation's many accounts cannot spend the operator's whole model budget. Cached answers stay free.
 */
const DAY = 24 * 60 * 60_000;
const HOUR = 60 * 60_000;
const { db, ready } = testDb();
const state = vi.hoisted(() => ({
  viewer: null as unknown,
  limit: vi.fn(async (key: string, max: number, windowMs: number) => (void [key, max, windowMs], { ok: true, retryAfterMs: 0 })),
  modelCalls: 0,
  generateVerified: vi.fn(async () => ({ draft: { title: "Draft" }, verification: {} })),
  draftLesson: vi.fn(async () => ({ title: "Draft" })),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: () => {
        state.modelCalls++;
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "Because the link hides its real address." } };
            yield { type: "message_delta", delta: { stop_reason: "end_turn" } };
          },
          abort() {},
        };
      },
    };
  },
}));
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({
  env: { APP_URL: "http://localhost:3000", TRUST_PROXY: 0, isProd: false, ANTHROPIC_API_KEY: "test-key", ANTHROPIC_TUTOR_MODEL: "claude-haiku-5-5" },
  appUrl: () => "http://localhost:3000",
}));
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => state.viewer, actionViewer: async () => state.viewer, privileged: () => false }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: state.limit }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en", getTranslations: async () => (key: string) => key }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../src/server/ai-verify", async (original) => ({ ...(await original<typeof import("../src/server/ai-verify")>()), generateVerified: state.generateVerified }));
vi.mock("../src/server/ai", async (original) => ({ ...(await original<typeof import("../src/server/ai")>()), draftLesson: state.draftLesson }));

const { POST } = await import("../src/app/api/tutor/route");
const { generateTrainingAction } = await import("../src/server/actions/ai-training");
const { draftLessonAction } = await import("../src/server/actions/secops");

let tenant: typeof t.tenants.$inferSelect;
let slug: string;
const viewerFor = (user: typeof t.users.$inferSelect): Viewer => ({ sessionId: "s", twoFactorVerified: true, user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } });
const keys = () => state.limit.mock.calls.map((c) => c.slice(0, 3));
/** The organisation's day bucket is spent; every other key is fine. */
const dayBucketSpent = (prefix: string) => state.limit.mockImplementation(async (key: string) => ({ ok: !key.startsWith(prefix), retryAfterMs: key.startsWith(prefix) ? 60_000 : 0 }));

beforeAll(async () => {
  await ready();
  tenant = await addTenant(db, { plan: "professional" });
  slug = (await addModule(db, { lessons: 1 })).slug;
}, DB_SETUP_TIMEOUT);

beforeEach(() => {
  state.limit.mockReset().mockResolvedValue({ ok: true, retryAfterMs: 0 });
});

describe("AI tutor", () => {
  const ask = (question: string) => POST(new Request("http://localhost:3000/api/tutor", { method: "POST", body: JSON.stringify({ slug, lessonKey: "lesson-1", sceneId: "q1", question, locale: "en" }) }));

  it("caps model calls per organisation and day across its people, while cached answers stay free", async () => {
    const [aysel, rauf] = await Promise.all([addUser(db, tenant.id), addUser(db, tenant.id)]);
    state.viewer = viewerFor(aysel);
    const first = await ask("Why is the link unsafe?");
    expect(first.status).toBe(200);
    expect(first.headers.get("x-tutor-mode")).toBe("ai");
    await first.text();
    expect(state.modelCalls).toBe(1);
    expect(keys()).toEqual([
      [`tutor:${aysel.id}`, 20, 10 * 60_000],
      [`tutor-day:t:${tenant.id}`, 2000, DAY],
    ]);

    dayBucketSpent("tutor-day:t:");
    state.viewer = viewerFor(rauf);
    expect((await ask("What about the sender?")).status).toBe(429);
    expect(state.modelCalls).toBe(1);

    state.limit.mockClear();
    const cached = await ask("Why is the link unsafe?");
    expect(cached.status).toBe(200);
    expect(cached.headers.get("x-tutor-mode")).toBe("cache");
    expect(keys()).toEqual([[`tutor:${rauf.id}`, 20, 10 * 60_000]]);
  });
});

describe("AI course generation and lesson drafts", () => {
  const input = { prompt: "Phishing awareness for the finance team", locale: "en", category: "email", difficulty: "Easy", minutes: 10, lessons: 1 } as const;

  it("caps generated trainings per organisation and day", async () => {
    state.viewer = viewerFor(await addUser(db, tenant.id, { role: "content_creator" }));
    const user = (state.viewer as Viewer).user.id;
    expect(await generateTrainingAction(input)).toMatchObject({ ok: true });
    expect(keys()).toEqual([
      [`ai-training:${user}`, 10, HOUR],
      [`ai-training-day:t:${tenant.id}`, 50, DAY],
    ]);
    dayBucketSpent("ai-training-day:t:");
    expect(await generateTrainingAction(input)).toEqual({ ok: false, error: "rateLimited" });
    expect(state.generateVerified).toHaveBeenCalledTimes(1);
  });

  it("caps lesson drafts per organisation and day", async () => {
    state.viewer = viewerFor(await addUser(db, tenant.id, { role: "content_creator" }));
    const user = (state.viewer as Viewer).user.id;
    expect(await draftLessonAction("Password hygiene", "en")).toMatchObject({ ok: true });
    expect(keys()).toEqual([
      [`ai-draft:${user}`, 20, HOUR],
      [`ai-draft-day:t:${tenant.id}`, 100, DAY],
    ]);
    dayBucketSpent("ai-draft-day:t:");
    expect(await draftLessonAction("Password hygiene", "en")).toEqual({ ok: false, error: "rateLimited" });
    expect(state.draftLesson).toHaveBeenCalledTimes(1);
  });
});
