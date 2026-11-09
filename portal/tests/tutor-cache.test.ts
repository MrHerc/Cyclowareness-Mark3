import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
let viewer: Viewer;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { TRUST_PROXY: 0, ANTHROPIC_API_KEY: "test-key", ANTHROPIC_TUTOR_MODEL: "claude-test" }, appUrl: () => "http://localhost:3000" }));
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer, allowed: () => false }));
// A model that answers every question with the same words and finishes cleanly, so the answer is cached.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: () => ({
        abort() {},
        async *[Symbol.asyncIterator]() {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Check " } };
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "the sender." } };
          yield { type: "message_delta", delta: { stop_reason: "end_turn" } };
        },
      }),
    };
  },
}));

const { POST } = await import("../src/app/api/tutor/route");

beforeAll(ready, DB_SETUP_TIMEOUT);

async function ask(tenant: typeof t.tenants.$inferSelect, user: typeof t.users.$inferSelect, slug: string) {
  viewer = { sessionId: "s", twoFactorVerified: true, user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } };
  const body = JSON.stringify({ slug, lessonKey: "lesson-1", sceneId: "q1", question: "Why is this unsafe?", locale: "en" });
  const res = await POST(new Request("http://localhost:3000/api/tutor", { method: "POST", headers: { origin: "http://localhost:3000" }, body }));
  return { mode: res.headers.get("x-tutor-mode"), text: await res.text() };
}

describe("POST /api/tutor", () => {
  it("caches an answer per organisation: the same question on a shared library lesson makes one row for each", async () => {
    const mod = await addModule(db, { lessons: 1 });
    const a = await addTenant(db, { plan: "professional" });
    const b = await addTenant(db, { plan: "professional" });
    const ua = await addUser(db, a.id);
    const ub = await addUser(db, b.id);
    expect(await ask(a, ua, mod.slug)).toEqual({ mode: "ai", text: "Check the sender." });
    expect(await ask(a, ua, mod.slug)).toEqual({ mode: "cache", text: "Check the sender." });
    // The other organisation gets its own answer, never A's row.
    expect(await ask(b, ub, mod.slug)).toEqual({ mode: "ai", text: "Check the sender." });
    const rows = await db.select().from(t.tutorCache).where(eq(t.tutorCache.lessonId, mod.lessons[0].id));
    expect(rows.map((r) => r.tenantId).sort()).toEqual([a.id, b.id].sort());
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
});
