import { and, eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import { can, PERMISSION_FEATURE, type Permission } from "../src/server/auth/permissions";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { messagesFor } from "../src/i18n/translator";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
let locale = "en";
type V = { user: typeof t.users.$inferSelect; tenant: { id: string; slug: string; name: string; plan: t.Plan; branding: t.TenantBranding; settings: t.TenantSettings; features: Set<string> } };
let viewer: V;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: {}, appUrl: () => "https://portal.example" }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => locale,
  getTranslations: async (o: { locale: string; namespace: string }) => createTranslator({ ...(await messagesFor(o.locale)), namespace: o.namespace as never }),
}));
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => viewer,
  allowed: (v: V, p: Permission) => can(v.user.role, p) && (!PERMISSION_FEATURE[p] || v.tenant.features.has(PERMISSION_FEATURE[p]!)),
}));
const queueEmail = vi.fn();
vi.mock("../src/server/mail", () => ({ queueEmail: (...a: unknown[]) => queueEmail(...a), renderEmailHtml: (text: string) => `<p>${text}</p>` }));

const learning = await import("../src/server/actions/learning");

beforeAll(ready, DB_SETUP_TIMEOUT);
beforeEach(() => {
  locale = "en";
  queueEmail.mockReset();
});

async function setup(o: { plan?: t.Plan; role?: t.Role; settings?: (s: t.TenantSettings) => t.TenantSettings } = {}) {
  const base = withDefaults({ defaultLocale: "en" });
  const tenant = await addTenant(db, { plan: o.plan ?? "enterprise_hrm", settings: o.settings ? o.settings(base) : base });
  const user = await addUser(db, tenant.id, { role: o.role ?? "learner" });
  viewer = { user, tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) } };
  return { tenant, user };
}

const finish = (slug: string, lessonKey: string, answers: Parameters<typeof learning.completeLessonAction>[0]["answers"] = []) =>
  learning.completeLessonAction({ slug, lessonKey, seconds: 120, answers });

describe("completing lessons", () => {
  it("walks a module lesson by lesson to the attestation, storing answers and the new risk score", async () => {
    const { tenant, user } = await setup();
    const mod = await addModule(db, { xp: 90, category: "accounts" });
    const first = await finish(mod.slug, "lesson-1", [
      { sceneId: "q1", correct: true, firstTry: true },
      { sceneId: "sim", itemId: "link", correct: false, firstTry: true, outcome: "risky" },
    ]);
    expect(first).toEqual({ ok: true, xp: 30, moduleStatus: "in_progress", nextKey: "lesson-2" });
    const answers = await db.select().from(t.answers).where(eq(t.answers.userId, user.id));
    expect(answers).toHaveLength(2);
    expect(answers.find((a) => a.sceneId === "sim")).toMatchObject({ tenantId: tenant.id, itemId: "link", outcome: "risky", category: "accounts", correct: false });
    await finish(mod.slug, "lesson-2");
    const last = await finish(mod.slug, "lesson-3");
    expect(last).toEqual({ ok: true, xp: 30, moduleStatus: "awaiting_attestation", nextKey: null });
    const [row] = await db.select().from(t.users).where(eq(t.users.id, user.id));
    expect(row.xp).toBe(90);
    // Recomputed from evidence instead of the default 50 for a new account.
    expect(row.riskScore).not.toBe(50);
  });

  it("queues the 'simulation.risky' event for an organisation that subscribed to it", async () => {
    const { tenant } = await setup({
      settings: (s) => ({ ...s, integrations: { ...s.integrations, webhookEnabled: true, webhookUrl: "https://siem.example/hook", webhookEvents: ["simulation.risky"] } }),
    });
    const mod = await addModule(db);
    await finish(mod.slug, "lesson-1", [{ sceneId: "sim", correct: false, firstTry: true, outcome: "compromised" }]);
    const [delivery] = await db.select().from(t.webhookDeliveries).where(eq(t.webhookDeliveries.tenantId, tenant.id));
    expect(delivery.payload).toMatchObject({ event: "simulation.risky", data: { module: mod.slug, lesson: "lesson-1", choices: 1 } });
  });

  it("refuses malformed input, unknown modules and lessons without writing anything", async () => {
    const { user } = await setup();
    const mod = await addModule(db);
    expect(await learning.completeLessonAction({ slug: mod.slug, lessonKey: "lesson-1", seconds: 5 * 3600, answers: [] })).toEqual({ ok: false, xp: 0 });
    expect(await learning.completeLessonAction({ slug: mod.slug, lessonKey: "lesson-1", seconds: 10, answers: Array.from({ length: 401 }, () => ({ sceneId: "q", correct: true, firstTry: true })) })).toEqual({ ok: false, xp: 0 });
    expect(await finish("no-such-module", "lesson-1")).toEqual({ ok: false, xp: 0 });
    expect(await finish(mod.slug, "no-such-lesson")).toEqual({ ok: false, xp: 0 });
    expect(await db.select().from(t.lessonProgress).where(eq(t.lessonProgress.userId, user.id))).toEqual([]);
  });

  it("keeps draft modules from learners but lets Studio authors preview them", async () => {
    await setup();
    const draft = await addModule(db, { status: "draft", tenantId: viewer.tenant.id, origin: "ai", firstPosition: 1 });
    expect(await finish(draft.slug, "lesson-1")).toEqual({ ok: false, xp: 0 });
    await setup({ role: "content_creator" });
    const own = await addModule(db, { status: "draft", tenantId: viewer.tenant.id, origin: "ai", firstPosition: 1 });
    expect((await finish(own.slug, "lesson-1")).ok).toBe(true);
  });

  it("uses the organisation's own module where it shares a slug with the library", async () => {
    const { user } = await setup();
    const library = await addModule(db, { slug: "shared-slug-a" });
    const own = await addModule(db, { slug: "shared-slug-a", tenantId: viewer.tenant.id, origin: "custom" });
    await finish("shared-slug-a", "lesson-1");
    const [progress] = await db.select().from(t.moduleProgress).where(eq(t.moduleProgress.userId, user.id));
    expect(progress.moduleId).toBe(own.id);
    expect(progress.moduleId).not.toBe(library.id);
  });

  it("bookmarks an opened lesson for the Home 'Continue' card", async () => {
    const { user } = await setup();
    const mod = await addModule(db);
    await learning.startLessonAction(mod.slug, "lesson-2");
    const [progress] = await db.select().from(t.moduleProgress).where(eq(t.moduleProgress.userId, user.id));
    expect(progress).toMatchObject({ moduleId: mod.id, status: "in_progress", lastLessonKey: "lesson-2" });
  });
});

describe("attesting a module", () => {
  it("is refused until the last lesson, then stores the organisation's own wording and issues the certificate", async () => {
    const { user } = await setup({ settings: (s) => ({ ...s, attestationText: { ...s.attestationText, ru: "Я подтверждаю." } }) });
    locale = "ru";
    const mod = await addModule(db, { lessons: 2 });
    expect(await learning.attestModuleAction(mod.slug)).toEqual({ ok: false });
    await finish(mod.slug, "lesson-1");
    await finish(mod.slug, "lesson-2");
    const res = await learning.attestModuleAction(mod.slug);
    expect(res).toEqual({ ok: true, token: expect.stringMatching(/^[a-z2-7]+$/) });
    const [attestation] = await db.select().from(t.attestations).where(eq(t.attestations.userId, user.id));
    expect(attestation).toMatchObject({ text: "Я подтверждаю.", locale: "ru", moduleId: mod.id });
    expect(await learning.attestModuleAction(mod.slug)).toEqual({ ok: false });
  });

  it("issues the learning path certificate once, when the path's last module is attested", async () => {
    const { user } = await setup();
    const a = await addModule(db, { lessons: 1 });
    const b = await addModule(db, { lessons: 1 });
    const [path] = await db
      .insert(t.learningPaths)
      .values({ tenantId: viewer.tenant.id, key: `path-${a.slug}`, title: { en: "Path" }, description: { en: "" }, audience: { en: "" }, recurrence: { en: "" }, standards: [], moduleSlugs: [a.slug, b.slug] })
      .returning();
    const pathCerts = () => db.select().from(t.certificates).where(and(eq(t.certificates.userId, user.id), eq(t.certificates.pathId, path.id)));
    await finish(a.slug, "lesson-1");
    await learning.attestModuleAction(a.slug);
    expect(await pathCerts()).toHaveLength(0);
    await finish(b.slug, "lesson-1");
    await learning.attestModuleAction(b.slug);
    expect(await pathCerts()).toHaveLength(1);
    // Replaying a module of a finished path does not issue another one.
    await finish(a.slug, "lesson-1");
    expect(await pathCerts()).toHaveLength(1);
  });
});

describe("module ratings", () => {
  it("stores ratings anonymously and refuses ratings outside 1–5", async () => {
    const { tenant } = await setup();
    const mod = await addModule(db);
    expect(await learning.rateModuleAction({ slug: mod.slug, rating: 6 })).toEqual({ ok: false });
    expect(await learning.rateModuleAction({ slug: mod.slug, rating: 0 })).toEqual({ ok: false });
    expect(await learning.rateModuleAction({ slug: "no-such-module", rating: 4 })).toEqual({ ok: false });
    expect(await learning.rateModuleAction({ slug: mod.slug, rating: 4, comment: "  " })).toEqual({ ok: true });
    expect(await learning.rateModuleAction({ slug: mod.slug, rating: 2, comment: " Too long " })).toEqual({ ok: true });
    const rows = await db.select().from(t.feedback).where(eq(t.feedback.tenantId, tenant.id));
    expect(rows.map((r) => [r.userId, r.rating, r.comment, r.topic, r.moduleId])).toEqual(
      expect.arrayContaining([
        [null, 4, null, "module", mod.id],
        [null, 2, "Too long", "module", mod.id],
      ]),
    );
  });
});

describe("problem reports", () => {
  const form = (values: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(values)) f.set(k, v);
    return f;
  };

  it("needs a message of at least three characters", async () => {
    await setup();
    expect(await learning.reportProblemAction(undefined, form({ message: " a " }))).toEqual({ error: "message" });
  });

  it("stores the report and emails the helpdesk, naming the lesson in the organisation's language", async () => {
    const { tenant, user } = await setup({ settings: (s) => ({ ...s, email: { enabled: true, helpdesk: "help@acme.example" } }) });
    const mod = await addModule(db, { title: { en: "Phishing basics", az: "Fişinq əsasları" } });
    const res = await learning.reportProblemAction(undefined, form({ message: "The video does not play", context: `lesson:${mod.slug}/lesson-2#scene-3` }));
    expect(res).toEqual({ ok: true });
    const [row] = await db.select().from(t.problemReports).where(eq(t.problemReports.tenantId, tenant.id));
    expect(row).toMatchObject({ userId: user.id, message: "The video does not play", context: `lesson:${mod.slug}/lesson-2#scene-3`, status: "new" });
    expect(queueEmail).toHaveBeenCalledTimes(1);
    const mail = queueEmail.mock.calls[0][2];
    expect(mail).toMatchObject({ to: "help@acme.example", kind: "problem", subject: "Problem report: lesson “Lesson 2” in “Phishing basics”", lang: "en" });
    expect(mail.text).toContain(user.email);
    expect(mail.text).toContain("https://portal.example/admin/problems");
  });

  it("does not email when the organisation has no helpdesk address", async () => {
    await setup();
    expect(await learning.reportProblemAction(undefined, form({ message: "Broken page", context: "page:/learn" }))).toEqual({ ok: true });
    expect(queueEmail).not.toHaveBeenCalled();
  });
});
