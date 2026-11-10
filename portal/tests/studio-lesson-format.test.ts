import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { lessonFileSchema } from "../src/lib/content/validate";
import { DB_SETUP_TIMEOUT, addTenant, addUser, testDb } from "./helpers/db";

/** A lesson written in the Studio is stored in the library's lesson format and passes the same schema. */
const { db, ready } = testDb();
const state = vi.hoisted(() => ({ viewer: null as unknown }));

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { APP_URL: "http://localhost:3000", TRUST_PROXY: 0, isProd: false }, appUrl: () => "http://localhost:3000" }));
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => state.viewer, actionViewer: async () => state.viewer, allowed: () => true }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en", getTranslations: async () => (key: string) => key }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { saveStudioLessonAction } = await import("../src/server/actions/secops");

beforeAll(async () => {
  await ready();
  const tenant = await addTenant(db, { plan: "professional" });
  const user = await addUser(db, tenant.id, { role: "content_creator" });
  state.viewer = { sessionId: "s", twoFactorVerified: true, user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } } satisfies Viewer;
}, DB_SETUP_TIMEOUT);

describe("Studio lesson", () => {
  it("is saved as formatVersion 1 scenes that pass the lesson schema", async () => {
    const r = await saveStudioLessonAction({
      locale: "en",
      category: "email",
      difficulty: "Easy",
      minutes: 5,
      ai: false,
      title: "Check the sender",
      subtitle: "Spot a fake sender.",
      intro: "An e-mail asks you to pay an invoice today.",
      points: ["Look at the sender's domain.", "Call the supplier on a number you know."],
      question: {
        prompt: "The bank details changed. What now?",
        options: [
          { label: "Call the supplier", correct: true, feedback: "Right." },
          { label: "Pay quickly", correct: false, feedback: "No." },
        ],
      },
      recap: ["Check the domain.", "Verify by phone."],
    });
    expect(r).toMatchObject({ ok: true });
    const [mod] = await db.select({ id: t.modules.id }).from(t.modules).where(eq(t.modules.slug, r.slug!));
    const [lesson] = await db.select({ id: t.lessons.id }).from(t.lessons).where(eq(t.lessons.moduleId, mod.id));
    const [content] = await db.select().from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
    const parsed = lessonFileSchema.safeParse({ formatVersion: 1, id: "lesson-1", title: "Check the sender", minutes: 5, scenes: content.scenes });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.scenes).toEqual(content.scenes);
    expect(content.scenes.map((s) => (s as { type: string }).type)).toEqual(["intro", "tutor", "choice", "recap"]);
  });
});
