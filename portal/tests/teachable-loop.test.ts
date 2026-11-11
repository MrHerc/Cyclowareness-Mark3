import { and, eq, isNotNull, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { TEMPLATES, TEMPLATE_BY_KEY, templateText } from "../src/lib/campaigns/templates";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";
import { dayPlus } from "../src/lib/time";
import { LOCALES } from "../src/i18n/config";
import { messagesFor } from "../src/i18n/translator";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

/** The teachable-moment loop: click → micro-lesson → re-simulation (services/teachable.ts). */
const { db, ready } = testDb();
let viewer: Viewer;
let locale = "en";
let smsOn = true;

vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));
vi.mock("../src/server/env", () => ({ env: { isProd: false }, appUrl: () => "https://portal.example" }));
vi.mock("../src/server/sms", () => ({ smsAvailable: () => smsOn, sendSms: vi.fn(async () => ({ ok: true, simulated: true })) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: async () => locale,
  getTranslations: async (o: { locale: string; namespace: string }) => createTranslator({ ...(await messagesFor(o.locale)), namespace: o.namespace as never }),
}));
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => viewer, allowed: () => false, privileged: () => false, hasFeature: () => true }));
// The next `notifyFails` notices throw, as a failing write would.
let notifyFails = 0;
vi.mock("../src/server/services/notify", async (original) => {
  const m = await original<typeof import("../src/server/services/notify")>();
  return {
    ...m,
    notifyUsers: async (...a: Parameters<typeof m.notifyUsers>) => {
      if (notifyFails > 0) {
        notifyFails--;
        throw new Error("notify failed");
      }
      return m.notifyUsers(...a);
    },
  };
});

const { campaignTick, launchCampaign, recordClick, setCampaignStatus } = await import("../src/server/services/campaigns");
const { microLesson, resimAt, resimTemplate, teachableTick } = await import("../src/server/services/teachable");
const { getCatalog } = await import("../src/server/queries/catalog");
const learning = await import("../src/server/actions/learning");
const workspace = await import("../src/server/actions/workspace");
const secops = await import("../src/server/actions/secops");
const campaignActions = await import("../src/server/actions/campaigns");

beforeAll(async () => {
  await ready();
  // The library modules the templates train with.
  for (const slug of new Set(TEMPLATES.map((x) => x.moduleSlug))) await addModule(db, { slug, lessons: 1 });
}, DB_SETUP_TIMEOUT);
beforeEach(() => {
  smsOn = true;
  locale = "en";
  notifyFails = 0;
});

async function org(o: { teachable?: boolean; timeZone?: string; personLocale?: string; people?: number } = {}) {
  const base = withDefaults({ defaultLocale: "en", locales: ["en", "az"], timeZone: o.timeZone ?? "Asia/Baku" });
  const settings = { ...base, learning: { ...base.learning, teachable: o.teachable ?? true } };
  const tenant = await addTenant(db, { plan: "enterprise_hrm", settings });
  const people = [];
  for (let i = 0; i < (o.people ?? 1); i++) people.push(await addUser(db, tenant.id, { locale: o.personLocale ?? "en", phone: `+99450${String(1_000_000 + Math.floor(Math.random() * 8_999_999))}` }));
  return { tenant: { ...tenant, settings: withDefaults(tenant.settings) }, people };
}

/** A launched campaign of `templateKey` to the whole organisation; returns each person's tracking token. */
async function clickable(tenantId: string, templateKey = "payslip") {
  const tpl = TEMPLATE_BY_KEY.get(templateKey)!;
  const [c] = await db.insert(t.campaigns).values({ tenantId, name: `Sim ${templateKey}`, channel: tpl.channel, templateKey, audience: "all", status: "draft" }).returning();
  expect(await launchCampaign(db, c.id, null)).toMatchObject({ ok: true });
  const rows = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, c.id));
  return { campaign: c, token: (userId: string) => rows.find((r) => r.userId === userId)!.token };
}

const loopsOf = (tenantId: string) => db.select().from(t.teachableLoops).where(eq(t.teachableLoops.tenantId, tenantId));
const teachableAssignments = (tenantId: string) => db.select().from(t.assignments).where(and(eq(t.assignments.tenantId, tenantId), eq(t.assignments.reason, "teachable")));
const personCampaigns = (tenantId: string) => db.select().from(t.campaigns).where(and(eq(t.campaigns.tenantId, tenantId), eq(t.campaigns.audience, "person")));
const asViewer = (tenant: Awaited<ReturnType<typeof org>>["tenant"], user: typeof t.users.$inferSelect): Viewer => ({
  sessionId: "s",
  twoFactorVerified: true,
  user,
  tenant: { ...tenant, features: featuresFor(tenant.plan, tenant.features) },
} as unknown as Viewer);

/** Takes the micro-lesson of `slug` through the server-verified path as `user`. */
async function finish(tenant: Awaited<ReturnType<typeof org>>["tenant"], user: typeof t.users.$inferSelect, slug = "teachable:payslip") {
  viewer = asViewer(tenant, user);
  await learning.startLessonAction(slug, "lesson-1");
  await db.update(t.lessonProgress).set({ startedAt: new Date(Date.now() - 120_000) }).where(and(eq(t.lessonProgress.userId, user.id), isNotNull(t.lessonProgress.startedAt)));
  // intro, steps, hotspot, check, recap: the last scene is index 4.
  await learning.reachSceneAction(slug, "lesson-1", 4);
  return learning.completeLessonAction({ slug, lessonKey: "lesson-1", answers: [{ sceneId: "hotspot", picked: ["s1"] }, { sceneId: "check", picked: ["o2"] }] });
}

/** Moves every loop of the organisation past the 21-day fallback, so its re-simulation is due. */
const backdate = (tenantId: string) => db.update(t.teachableLoops).set({ assignedAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(t.teachableLoops.tenantId, tenantId));

/** A payslip click whose re-simulation (the Medium invoice) is scheduled and not launched yet. */
async function scheduledResim(o: Parameters<typeof org>[0] = {}) {
  const { tenant, people } = await org(o);
  const [p] = people;
  const { token } = await clickable(tenant.id);
  await recordClick(db, token(p.id), "link");
  await teachableTick(db, tenant, new Date());
  await backdate(tenant.id);
  await teachableTick(db, tenant, new Date());
  const [resim] = await personCampaigns(tenant.id);
  expect(resim).toMatchObject({ userId: p.id, status: "scheduled" });
  return { tenant, p, resim };
}

describe("click → micro-lesson", () => {
  it("assigns one micro-lesson within the hour, in the person's language, and replaying the click or the step changes nothing", async () => {
    const { tenant, people } = await org({ personLocale: "ru", people: 2 });
    const [p, other] = people;
    const { campaign, token } = await clickable(tenant.id);
    await recordClick(db, token(p.id), "link");
    await recordClick(db, token(p.id), "link");
    const now = new Date();
    expect(await teachableTick(db, tenant, now)).toBe(1);
    expect(await teachableTick(db, tenant, new Date(now.getTime() + 60_000))).toBe(0);

    const loops = await loopsOf(tenant.id);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({ userId: p.id, sourceCampaignId: campaign.id, status: "assigned", resimCampaignId: null });
    const [mod] = await db.select().from(t.modules).where(eq(t.modules.id, loops[0].microModuleId));
    expect(mod).toMatchObject({ tenantId: tenant.id, slug: "teachable:payslip", status: "published", audiences: [] });
    // The organisation's languages and the person's own (ru is not one of the organisation's).
    const [lesson] = await db.select().from(t.lessons).where(eq(t.lessons.moduleId, mod.id));
    const texts = await db.select({ locale: t.lessonContents.locale }).from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
    expect(texts.map((x) => x.locale).sort()).toEqual(["az", "en", "ru"]);

    const assignments = await teachableAssignments(tenant.id);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ moduleId: mod.id, scope: "user", userId: p.id, dueKind: "fixed", dueDate: dayPlus(7, "Asia/Baku", now) });
    // The click's risk now asks for the micro-lesson.
    const risks = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, p.id));
    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ moduleId: mod.id, status: "open", dueDate: dayPlus(7, "Asia/Baku", now) });
    const notices = await db.select().from(t.notifications).where(and(eq(t.notifications.userId, p.id), eq(t.notifications.kind, "assignment")));
    expect(notices.map((n) => n.href)).toEqual(["/learn/teachable:payslip"]);

    // Only the person it was assigned to sees it in their catalog.
    expect((await getCatalog(asViewer(tenant, p), "ru")).some((m) => m.slug === "teachable:payslip")).toBe(true);
    expect((await getCatalog(asViewer(tenant, other), "en")).some((m) => m.slug === "teachable:payslip")).toBe(false);
  }, 60_000);

  it("is completed through the server-verified path, without attestation, and closes the click's risk and the loop", async () => {
    const { tenant, people } = await org();
    const [p] = people;
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    viewer = asViewer(tenant, p);
    const slug = "teachable:payslip";
    await learning.startLessonAction(slug, "lesson-1");
    await db.update(t.lessonProgress).set({ startedAt: new Date(Date.now() - 120_000) }).where(and(eq(t.lessonProgress.userId, p.id), isNotNull(t.lessonProgress.startedAt)));
    // intro, steps, hotspot, check, recap: the last scene is index 4.
    await learning.reachSceneAction(slug, "lesson-1", 4);
    const res = await learning.completeLessonAction({ slug, lessonKey: "lesson-1", answers: [{ sceneId: "hotspot", picked: ["s1"] }, { sceneId: "check", picked: ["o2"] }] });
    expect(res).toMatchObject({ ok: true, moduleStatus: "completed" });
    const [risk] = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, p.id));
    expect(risk.status).toBe("closed");
    const [loop] = await loopsOf(tenant.id);
    expect(loop.status).toBe("completed");
    expect(loop.completedAt).toBeInstanceOf(Date);
    expect(await db.select().from(t.attestations).where(eq(t.attestations.userId, p.id))).toHaveLength(0);
  }, 60_000);

  it("refuses the micro-lesson to a person of the organisation it was not assigned to", async () => {
    const { tenant, people } = await org({ people: 2 });
    const [p, other] = people;
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    expect(await finish(tenant, other)).toMatchObject({ ok: false });
    expect(await db.select().from(t.moduleProgress).where(eq(t.moduleProgress.userId, other.id))).toHaveLength(0);
    expect(await db.select().from(t.xpEvents).where(eq(t.xpEvents.userId, other.id))).toHaveLength(0);
  }, 60_000);

  it("asks again for a lesson taken in an earlier loop, and taking it again closes the new risk", async () => {
    const { tenant, people } = await org();
    const [p] = people;
    const first = await clickable(tenant.id);
    await recordClick(db, first.token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    expect(await finish(tenant, p)).toMatchObject({ ok: true, moduleStatus: "completed" });

    const second = await clickable(tenant.id);
    await recordClick(db, second.token(p.id), "link");
    expect(await teachableTick(db, tenant, new Date())).toBe(1);
    const [mod] = await db.select().from(t.modules).where(and(eq(t.modules.tenantId, tenant.id), eq(t.modules.slug, "teachable:payslip")));
    const [mp] = await db.select().from(t.moduleProgress).where(and(eq(t.moduleProgress.userId, p.id), eq(t.moduleProgress.moduleId, mod.id)));
    expect(mp).toMatchObject({ status: "in_progress", completedAt: null });
    expect((await db.select().from(t.behaviorRisks).where(and(eq(t.behaviorRisks.userId, p.id), eq(t.behaviorRisks.status, "open")))).map((r) => r.sourceRef)).toEqual([second.campaign.id]);

    expect(await finish(tenant, p)).toMatchObject({ ok: true, moduleStatus: "completed" });
    expect(await db.select().from(t.behaviorRisks).where(and(eq(t.behaviorRisks.userId, p.id), eq(t.behaviorRisks.status, "open")))).toHaveLength(0);
    expect((await loopsOf(tenant.id)).map((l) => l.status)).toEqual(["completed", "completed"]);
  }, 60_000);

  it("never touches another organisation's recipients", async () => {
    const a = await org();
    const b = await org();
    const { token } = await clickable(b.tenant.id);
    await recordClick(db, token(b.people[0].id), "link");
    const [before] = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, b.people[0].id));
    expect(await teachableTick(db, a.tenant, new Date())).toBe(0);
    expect(await loopsOf(b.tenant.id)).toHaveLength(0);
    expect((await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, b.people[0].id)))[0].moduleId).toBe(before.moduleId);
    expect(await db.select().from(t.modules).where(eq(t.modules.tenantId, a.tenant.id))).toHaveLength(0);
    expect(await teachableTick(db, b.tenant, new Date())).toBe(1);
    const [mod] = await db.select().from(t.modules).where(eq(t.modules.id, (await loopsOf(b.tenant.id))[0].microModuleId));
    expect(mod.tenantId).toBe(b.tenant.id);
  }, 60_000);

  it("is refused as an administrator's assignment or path module, and an assignment made before that can still be completed", async () => {
    const { tenant, people } = await org({ people: 2 });
    const [p, other] = people;
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    const [mod] = await db.select().from(t.modules).where(and(eq(t.modules.tenantId, tenant.id), eq(t.modules.slug, "teachable:payslip")));
    viewer = asViewer(tenant, await addUser(db, tenant.id, { role: "tenant_admin" }));
    const assign = { target: "module" as const, targetId: mod.id, scope: "everyone" as const, departmentId: null, userId: null, dueKind: "none" as const, dueDate: null, dueDays: null, reason: null };
    expect(await workspace.createAssignmentAction(assign)).toEqual({ ok: false });
    const path = { sourceId: null, title: "Onboarding", description: "", audience: "", recurrence: "", standards: "", mandatory: false, labIds: [] };
    expect(await secops.savePathAction({ ...path, id: null, moduleSlugs: [mod.slug] })).toMatchObject({ ok: false });
    // An older assignment to someone without a loop opens the lesson, as the catalog shows it.
    await db.insert(t.assignments).values({ tenantId: tenant.id, moduleId: mod.id, scope: "user", userId: other.id });
    expect(await finish(tenant, other)).toMatchObject({ ok: true, moduleStatus: "completed" });
  }, 60_000);

  it("creates nothing while the organisation has switched the loop off", async () => {
    const { tenant, people } = await org({ teachable: false });
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(people[0].id), "link");
    expect(await teachableTick(db, tenant, new Date())).toBe(0);
    expect(await loopsOf(tenant.id)).toHaveLength(0);
    expect(await teachableAssignments(tenant.id)).toHaveLength(0);
    expect(await db.select().from(t.modules).where(eq(t.modules.tenantId, tenant.id))).toHaveLength(0);
  }, 60_000);

  it("starts no loop for a click in a live drill campaign", async () => {
    const { tenant, people } = await org({ people: 2 });
    const [p, other] = people;
    const drill = await clickable(tenant.id);
    await db.insert(t.drillRuns).values({ tenantId: tenant.id, campaignId: drill.campaign.id, templateKey: "payslip", durationMs: 60_000, simMinutes: 60, events: [], baseline: { avgRisk: 50, scores: {} }, startedAt: new Date() });
    await recordClick(db, drill.token(p.id), "link");
    // The control: the same click in an ordinary campaign starts one.
    const real = await clickable(tenant.id, "invoice");
    await recordClick(db, real.token(other.id), "link");
    expect(await teachableTick(db, tenant, new Date())).toBe(1);
    expect((await loopsOf(tenant.id)).map((l) => [l.userId, l.sourceCampaignId])).toEqual([[other.id, real.campaign.id]]);
    expect((await teachableAssignments(tenant.id)).map((a) => a.userId)).toEqual([other.id]);
    expect(await db.select().from(t.notifications).where(and(eq(t.notifications.userId, p.id), eq(t.notifications.kind, "assignment")))).toHaveLength(0);
  }, 60_000);

  it("starts nothing for a suspended clicker or a click older than a day", async () => {
    const { tenant, people } = await org({ people: 2 });
    const [suspended, late] = people;
    const { campaign, token } = await clickable(tenant.id);
    await recordClick(db, token(suspended.id), "link");
    await recordClick(db, token(late.id), "link");
    await db.update(t.users).set({ status: "suspended" }).where(eq(t.users.id, suspended.id));
    await db
      .update(t.campaignRecipients)
      .set({ clickedAt: new Date(Date.now() - 25 * 3_600_000) })
      .where(and(eq(t.campaignRecipients.campaignId, campaign.id), eq(t.campaignRecipients.userId, late.id)));
    expect(await teachableTick(db, tenant, new Date())).toBe(0);
    expect(await loopsOf(tenant.id)).toHaveLength(0);
  }, 60_000);

  it("isolates a click that fails: the other clicks and the due re-simulations still go ahead, and the next tick retries it", async () => {
    const { tenant, people } = await org({ people: 3 });
    const [a, b, earlier] = people;
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(earlier.id), "link");
    await teachableTick(db, tenant, new Date());
    await backdate(tenant.id);
    await recordClick(db, token(a.id), "link");
    await recordClick(db, token(b.id), "link");
    notifyFails = 1;
    expect(await teachableTick(db, tenant, new Date())).toBe(1);
    const loops = await loopsOf(tenant.id);
    expect(loops.find((l) => l.userId === earlier.id)).toMatchObject({ status: "resim", resimCampaignId: expect.any(String) });
    expect(loops.filter((l) => l.userId !== earlier.id)).toHaveLength(1);
    // The failed click's transaction left nothing behind: no assignment without its loop.
    expect(await teachableAssignments(tenant.id)).toHaveLength(2);
    expect(await teachableTick(db, tenant, new Date())).toBe(1);
    expect((await loopsOf(tenant.id)).map((l) => l.userId).sort()).toEqual([a.id, b.id, earlier.id].sort());
  }, 60_000);
});

describe("re-simulation", () => {
  it("is scheduled 14 days after the lesson at 10:00 in the organisation's zone, once, at the next difficulty, and its result is recorded", async () => {
    const { tenant, people } = await org({ timeZone: "America/New_York" });
    const [p] = people;
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    // Completed at 22:00 on 28 February in New York; day 14 is 14 March, after the switch to summer time (UTC-4).
    await db.update(t.teachableLoops).set({ status: "completed", completedAt: new Date("2026-03-01T03:00:00Z") }).where(eq(t.teachableLoops.tenantId, tenant.id));
    const due = new Date("2026-03-14T14:00:00Z");
    expect(resimAt((await loopsOf(tenant.id))[0], "America/New_York")).toEqual(due);

    await teachableTick(db, tenant, new Date(due.getTime() - 60_000));
    expect(await personCampaigns(tenant.id)).toHaveLength(0);
    await teachableTick(db, tenant, due);
    await teachableTick(db, tenant, new Date(due.getTime() + 2 * 3_600_000));
    const resims = await personCampaigns(tenant.id);
    expect(resims).toHaveLength(1);
    // Same channel, next difficulty: the Easy payslip is followed by the Medium invoice.
    expect(resims[0]).toMatchObject({ channel: "email", templateKey: "invoice", userId: p.id, status: "scheduled" });
    const [loop] = await loopsOf(tenant.id);
    expect(loop).toMatchObject({ resimCampaignId: resims[0].id, status: "resim" });

    // The normal sending path launches it to that one person only.
    await campaignTick(db);
    const recipients = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, resims[0].id));
    expect(recipients.map((r) => r.userId)).toEqual([p.id]);
    expect(await setCampaignStatus(db, tenant.id, resims[0].id, "completed")).toBe(true);
    await teachableTick(db, tenant, new Date(due.getTime() + 3 * 3_600_000));
    expect((await loopsOf(tenant.id))[0]).toMatchObject({ resimResult: "passed", status: "closed" });
  }, 60_000);

  it("waits while the channel cannot send and goes out 21 days after an unfinished lesson once it can", async () => {
    const { tenant, people } = await org();
    const { token } = await clickable(tenant.id, "parcel-sms");
    await recordClick(db, token(people[0].id), "link");
    await teachableTick(db, tenant, new Date());
    const [loop] = await loopsOf(tenant.id);
    const due = resimAt(loop, "Asia/Baku");
    expect(due).toEqual(new Date(`${dayPlus(21, "Asia/Baku", loop.assignedAt)}T06:00:00Z`));
    smsOn = false;
    await teachableTick(db, tenant, due);
    expect(await personCampaigns(tenant.id)).toHaveLength(0);
    expect((await loopsOf(tenant.id))[0].status).toBe("assigned");
    smsOn = true;
    await teachableTick(db, tenant, new Date(due.getTime() + 3_600_000));
    const resims = await personCampaigns(tenant.id);
    expect(resims).toHaveLength(1);
    expect(resims[0]).toMatchObject({ channel: "sms", templateKey: "prize-sms" });
  }, 60_000);

  it("after the 21-day fallback: a late lesson is still recorded, a click in the re-simulation starts no loop, and switched off its result is still recorded", async () => {
    const { tenant, people } = await org();
    const [p] = people;
    const { token } = await clickable(tenant.id);
    await recordClick(db, token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    await db.update(t.teachableLoops).set({ assignedAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(t.teachableLoops.tenantId, tenant.id));
    await teachableTick(db, tenant, new Date());
    const [resim] = await personCampaigns(tenant.id);
    expect((await loopsOf(tenant.id))[0]).toMatchObject({ status: "resim", completedAt: null });

    // The lesson taken after the re-simulation was scheduled.
    expect(await finish(tenant, p)).toMatchObject({ ok: true, moduleStatus: "completed" });
    const [late] = await loopsOf(tenant.id);
    expect(late.status).toBe("resim");
    expect(late.completedAt).toBeInstanceOf(Date);

    await campaignTick(db);
    const [r] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, resim.id));
    await recordClick(db, r.token, "link");
    expect(await teachableTick(db, tenant, new Date())).toBe(0);
    expect(await loopsOf(tenant.id)).toHaveLength(1);

    const off = { ...tenant, settings: { ...tenant.settings, learning: { ...tenant.settings.learning, teachable: false } } };
    expect(await setCampaignStatus(db, tenant.id, resim.id, "completed")).toBe(true);
    await teachableTick(db, off, new Date());
    expect((await loopsOf(tenant.id))[0]).toMatchObject({ resimResult: "clicked", status: "closed" });
  }, 60_000);

  it("ends an SMS loop without a re-simulation for a person without a phone, and never records an unsent one as passed", async () => {
    const { tenant, people } = await org({ people: 2 });
    const [noPhone, p] = people;
    const { token } = await clickable(tenant.id, "parcel-sms");
    await recordClick(db, token(noPhone.id), "link");
    await recordClick(db, token(p.id), "link");
    await teachableTick(db, tenant, new Date());
    await db.update(t.users).set({ phone: null }).where(eq(t.users.id, noPhone.id));
    await db.update(t.teachableLoops).set({ assignedAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(t.teachableLoops.tenantId, tenant.id));
    await teachableTick(db, tenant, new Date());
    const resims = await personCampaigns(tenant.id);
    expect(resims.map((c) => c.userId)).toEqual([p.id]);
    expect((await loopsOf(tenant.id)).find((l) => l.userId === noPhone.id)).toMatchObject({ status: "closed", resimCampaignId: null });

    // Launched, but the text message never went out (no gateway run): the campaign ends without a result.
    await campaignTick(db);
    expect(await setCampaignStatus(db, tenant.id, resims[0].id, "completed")).toBe(true);
    await teachableTick(db, tenant, new Date());
    expect((await loopsOf(tenant.id)).find((l) => l.userId === p.id)).toMatchObject({ resimResult: null, status: "closed" });
  }, 60_000);

  it("sends one person one re-simulation at a time when two of their loops are due on the same tick", async () => {
    const { tenant, people } = await org();
    const [p] = people;
    for (const key of ["payslip", "invoice"]) {
      const { token } = await clickable(tenant.id, key);
      await recordClick(db, token(p.id), "link");
    }
    await teachableTick(db, tenant, new Date());
    expect(await loopsOf(tenant.id)).toHaveLength(2);
    await db.update(t.teachableLoops).set({ assignedAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(t.teachableLoops.tenantId, tenant.id));
    await teachableTick(db, tenant, new Date());
    await teachableTick(db, tenant, new Date(Date.now() + 3_600_000));
    expect(await personCampaigns(tenant.id)).toHaveLength(1);
    expect((await loopsOf(tenant.id)).map((l) => l.status).sort()).toEqual(["assigned", "resim"]);
  }, 60_000);

  it("isolates a re-simulation that fails: the other due loop still gets one, the results are still recorded, and the next tick retries it", async () => {
    const { tenant, people } = await org({ people: 3 });
    const [a, b, c] = people;
    const { token } = await clickable(tenant.id);
    // c's re-simulation goes out first; it ends just before the failing tick, whose step 3 records it.
    await recordClick(db, token(c.id), "link");
    await teachableTick(db, tenant, new Date());
    await backdate(tenant.id);
    await teachableTick(db, tenant, new Date());
    const [resim] = await personCampaigns(tenant.id);
    await campaignTick(db);
    await recordClick(db, token(a.id), "link");
    await recordClick(db, token(b.id), "link");
    await teachableTick(db, tenant, new Date());
    await backdate(tenant.id);
    expect(await setCampaignStatus(db, tenant.id, resim.id, "completed")).toBe(true);
    // a's re-simulation cannot be written, as a failing insert would.
    await db.execute(sql.raw(`create function fail_resim() returns trigger language plpgsql as $$ begin if new.user_id = '${a.id}' then raise exception 'resim refused'; end if; return new; end $$`));
    await db.execute(sql.raw("create trigger fail_resim before insert on campaigns for each row execute function fail_resim()"));
    try {
      await teachableTick(db, tenant, new Date());
    } finally {
      await db.execute(sql.raw("drop trigger fail_resim on campaigns"));
      await db.execute(sql.raw("drop function fail_resim"));
    }
    const loops = await loopsOf(tenant.id);
    expect(loops.find((l) => l.userId === a.id)).toMatchObject({ resimCampaignId: null, status: "assigned" });
    expect(loops.find((l) => l.userId === b.id)).toMatchObject({ resimCampaignId: expect.any(String), status: "resim" });
    expect(loops.find((l) => l.userId === c.id)).toMatchObject({ resimResult: "passed", status: "closed" });
    await teachableTick(db, tenant, new Date());
    expect((await loopsOf(tenant.id)).find((l) => l.userId === a.id)).toMatchObject({ resimCampaignId: expect.any(String), status: "resim" });
  }, 60_000);

  it("names no person: not in the campaign's name, its audit entry, the click's risk or the webhook payload", async () => {
    const { tenant, p, resim } = await scheduledResim();
    expect(resim.name).toBe("Overdue invoice: re-simulation");
    const [created] = await db.select().from(t.auditLog).where(and(eq(t.auditLog.action, "campaign.created"), eq(t.auditLog.targetId, resim.id)));
    expect(JSON.stringify(created.meta)).not.toContain(p.name);
    const settings = { ...tenant.settings, integrations: { ...tenant.settings.integrations, webhookEnabled: true, webhookUrl: "https://siem.example/hook", webhookEvents: ["phishing.clicked"] } };
    await db.update(t.tenants).set({ settings }).where(eq(t.tenants.id, tenant.id));
    await campaignTick(db);
    const [r] = await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.campaignId, resim.id));
    await recordClick(db, r.token, "link");
    const [risk] = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.sourceRef, resim.id));
    expect(risk.title).not.toContain(p.name);
    const deliveries = await db.select().from(t.webhookDeliveries).where(eq(t.webhookDeliveries.tenantId, tenant.id));
    expect(deliveries.map((d) => d.payload)).toMatchObject([{ event: "phishing.clicked", data: { campaign: "Overdue invoice: re-simulation", userId: p.id } }]);
    expect(JSON.stringify(deliveries[0].payload)).not.toContain(p.name);
  }, 60_000);

  it("is cancelled when its launch is refused, and its loop closes without a result and without a 'did not start' notice", async () => {
    const { tenant, p, resim } = await scheduledResim();
    const admin = await addUser(db, tenant.id, { role: "tenant_admin" });
    // Suspended in the minute between scheduling and launch: the audience is empty.
    await db.update(t.users).set({ status: "suspended" }).where(eq(t.users.id, p.id));
    await campaignTick(db);
    expect((await db.select().from(t.campaigns).where(eq(t.campaigns.id, resim.id)))[0].status).toBe("cancelled");
    expect((await db.select().from(t.auditLog).where(and(eq(t.auditLog.action, "campaign.launch_blocked"), eq(t.auditLog.targetId, resim.id))))[0].meta).toMatchObject({ reason: "empty" });
    expect(await db.select().from(t.notifications).where(and(eq(t.notifications.userId, admin.id), eq(t.notifications.kind, "campaign")))).toHaveLength(0);
    await teachableTick(db, tenant, new Date());
    expect((await loopsOf(tenant.id))[0]).toMatchObject({ status: "closed", resimResult: null });
  }, 60_000);

  it("records a reported re-simulation as reported, also once the campaign ends, and a cancelled one closes without a result", async () => {
    const reported = await scheduledResim();
    await campaignTick(db);
    await db.update(t.campaignRecipients).set({ reportedAt: new Date() }).where(eq(t.campaignRecipients.campaignId, reported.resim.id));
    await teachableTick(db, reported.tenant, new Date());
    expect((await loopsOf(reported.tenant.id))[0]).toMatchObject({ resimResult: "reported", status: "resim" });
    expect(await setCampaignStatus(db, reported.tenant.id, reported.resim.id, "completed")).toBe(true);
    await teachableTick(db, reported.tenant, new Date());
    expect((await loopsOf(reported.tenant.id))[0]).toMatchObject({ resimResult: "reported", status: "closed" });

    const cancelled = await scheduledResim();
    expect(await setCampaignStatus(db, cancelled.tenant.id, cancelled.resim.id, "cancelled")).toBe(true);
    await teachableTick(db, cancelled.tenant, new Date());
    expect((await loopsOf(cancelled.tenant.id))[0]).toMatchObject({ resimResult: null, status: "closed" });
  }, 60_000);

  it("refuses an administrator's edit of a re-simulation, which stays with its one person", async () => {
    const { tenant, p, resim } = await scheduledResim();
    viewer = asViewer(tenant, await addUser(db, tenant.id, { role: "tenant_admin" }));
    const edit = { name: "Org-wide", templateKey: "invoice", audience: "all" as const, departmentId: null, scheduledAt: null };
    expect(await campaignActions.saveCampaignAction({ id: resim.id, ...edit })).toEqual({ ok: false });
    expect((await db.select().from(t.campaigns).where(eq(t.campaigns.id, resim.id)))[0]).toMatchObject({ audience: "person", userId: p.id, status: "scheduled", name: resim.name });
    // The control: an ordinary draft takes the same edit.
    const [plain] = await db.insert(t.campaigns).values({ tenantId: tenant.id, name: "Plain", channel: "email", templateKey: "payslip", audience: "all", status: "draft" }).returning();
    expect(await campaignActions.saveCampaignAction({ id: plain.id, ...edit })).toEqual({ ok: true, id: plain.id });
  }, 60_000);

  it("schedules nothing while switched off, for a suspended person, or for a voice or USB loop, which closes", async () => {
    const off = await org({ teachable: false });
    const onFirst = { ...off.tenant, settings: { ...off.tenant.settings, learning: { ...off.tenant.settings.learning, teachable: true } } };
    const sim = await clickable(off.tenant.id);
    await recordClick(db, sim.token(off.people[0].id), "link");
    await teachableTick(db, onFirst, new Date());
    await backdate(off.tenant.id);
    await teachableTick(db, off.tenant, new Date());
    expect(await personCampaigns(off.tenant.id)).toHaveLength(0);
    expect((await loopsOf(off.tenant.id))[0].status).toBe("assigned");

    const suspended = await org();
    const s = await clickable(suspended.tenant.id);
    await recordClick(db, s.token(suspended.people[0].id), "link");
    await teachableTick(db, suspended.tenant, new Date());
    await backdate(suspended.tenant.id);
    await db.update(t.users).set({ status: "suspended" }).where(eq(t.users.id, suspended.people[0].id));
    await teachableTick(db, suspended.tenant, new Date());
    expect(await personCampaigns(suspended.tenant.id)).toHaveLength(0);
    expect((await loopsOf(suspended.tenant.id))[0].status).toBe("assigned");

    const usb = await org();
    const u = await clickable(usb.tenant.id, "usb-parcel");
    await recordClick(db, u.token(usb.people[0].id), "link");
    await teachableTick(db, usb.tenant, new Date());
    await backdate(usb.tenant.id);
    await teachableTick(db, usb.tenant, new Date());
    expect(await personCampaigns(usb.tenant.id)).toHaveLength(0);
    expect((await loopsOf(usb.tenant.id))[0]).toMatchObject({ status: "closed", resimCampaignId: null });
  }, 60_000);

  it("picks the same channel at the next difficulty, staying at Hard and on the plan", () => {
    const all = featuresFor("enterprise_hrm", {});
    const key = (k: string, f = all) => resimTemplate(TEMPLATE_BY_KEY.get(k)!, f)?.key;
    expect(key("payslip")).toBe("invoice");
    expect(key("invoice")).toBe("bank-details");
    expect(key("bank-details")).toBe("keynote");
    expect(key("prize-sms")).toBe("bank-sms");
    // Without SMS on the plan there is nothing to send.
    expect(key("parcel-sms", featuresFor("essentials", {}))).toBeUndefined();
  });
});

describe("micro-lesson content", () => {
  it("passes the lesson schema for every template in all ten languages", async () => {
    for (const tpl of TEMPLATES) {
      for (const l of LOCALES) {
        const lesson = await microLesson(tpl, l);
        const parsed = lessonFileSchema.safeParse({ formatVersion: 1, id: "lesson-1", title: lesson.title, minutes: 2, scenes: lesson.scenes });
        expect(parsed.success, `${tpl.key} ${l}`).toBe(true);
        expect(lessonIntegrityErrors(parsed.data!), `${tpl.key} ${l}`).toEqual([]);
        expect(lesson.title).toContain(templateText(tpl.name, l));
      }
    }
  }, 60_000);
});
