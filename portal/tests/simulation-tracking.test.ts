import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

// Side effects outside the database are not under test here.
vi.mock("../src/server/services/events", () => ({ emitEvent: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/mail", () => ({ queueEmail: vi.fn() }));
vi.mock("../src/server/sms", () => ({ sendSms: vi.fn(), smsAvailable: () => false }));
vi.mock("../src/server/env", () => ({ env: {}, appUrl: () => "http://localhost:3000" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130" }) }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

const { recordClick, recordOpen, recordSubmit } = await import("../src/server/services/campaigns");
const { attestModule, completeLesson, issueCertificate, randomToken } = await import("../src/server/services/progress");
const { trackingView } = await import("../src/server/tracking");

let tenantId = "";
let userId = "";
let moduleId = "";
let lessonIds: string[] = [];
let seq = 0;

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  const [user] = await db.insert(t.users).values({ tenantId, email: "aysel@acme.test", name: "Aysel", locale: "en" }).returning();
  userId = user.id;
  // "payslip" (a harvest template) trains with the global phishing-email module.
  const [mod] = await db
    .insert(t.modules)
    .values({ slug: "phishing-email", category: "phishing", audiences: [], title: { en: "Phishing" }, subtitle: { en: "" }, minutes: 10, xp: 100, difficulty: "Easy" })
    .returning();
  moduleId = mod.id;
  const lessons = await db
    .insert(t.lessons)
    .values([0, 1, 2].map((position) => ({ moduleId, key: `l${position}`, title: { en: `Lesson ${position}` }, minutes: 3, position })))
    .returning();
  lessonIds = lessons.sort((a, b) => a.position - b.position).map((l) => l.id);
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

async function recipient(status: (typeof t.CAMPAIGN_STATUS)[number] = "running") {
  const [c] = await db.insert(t.campaigns).values({ tenantId, name: `Payslip ${++seq}`, channel: "email", templateKey: "payslip", audience: "all", status }).returning();
  const token = randomToken(16);
  const [r] = await db.insert(t.campaignRecipients).values({ campaignId: c.id, userId, token, sentAt: new Date() }).returning();
  return { campaign: c, recipient: r, token };
}

const recipientRow = async (id: string) => (await db.select().from(t.campaignRecipients).where(eq(t.campaignRecipients.id, id)))[0];
const openRisks = () =>
  db
    .select()
    .from(t.behaviorRisks)
    .where(and(eq(t.behaviorRisks.userId, userId), eq(t.behaviorRisks.moduleId, moduleId), eq(t.behaviorRisks.status, "open")));

describe("cancelled simulation campaign", () => {
  beforeEach(async () => {
    await db.delete(t.behaviorRisks);
  });

  it("counts opens, clicks and submissions while the campaign runs", async () => {
    const { recipient: r, token } = await recipient("running");
    await recordOpen(db, token);
    expect((await recipientRow(r.id)).openedAt).not.toBeNull();
    const view = await recordClick(db, token, "link");
    expect(view?.cancelled).toBe(false);
    await recordSubmit(db, token);
    const row = await recipientRow(r.id);
    expect(row.clickedAt).not.toBeNull();
    expect(row.submittedAt).not.toBeNull();
    expect((await openRisks()).map((x) => x.severity)).toEqual(["high"]);
  });

  it("records nothing and skips the fake sign-in once cancelled", async () => {
    const { recipient: r, token } = await recipient("cancelled");
    await recordOpen(db, token);
    const view = await trackingView(token, "link");
    expect(view?.harvest).toBe(false);
    await recordSubmit(db, token);
    const row = await recipientRow(r.id);
    expect(row.openedAt).toBeNull();
    expect(row.clickedAt).toBeNull();
    expect(row.submittedAt).toBeNull();
    expect(await openRisks()).toHaveLength(0);
  });

  it("still shows the fake sign-in of a running harvest campaign", async () => {
    const { token } = await recipient("running");
    expect((await trackingView(token, "link"))?.harvest).toBe(true);
  });
});

describe("risk linked to the training module", () => {
  beforeEach(async () => {
    await db.delete(t.behaviorRisks);
    await db.delete(t.moduleProgress);
    await db.delete(t.lessonProgress);
    // One attestation and certificate per person and module: the previous test's must go with its progress.
    await db.delete(t.certificates);
    await db.delete(t.attestations);
  });

  async function finishModule() {
    for (const lessonId of lessonIds) await completeLesson(db, { tenantId, userId, lessonId });
    expect(await attestModule(db, { tenantId, userId, moduleId, text: "I confirm", locale: "en" })).not.toBeNull();
  }

  it("is closed by the attestation when the module was not completed yet", async () => {
    await recordClick(db, (await recipient()).token, "link");
    expect(await openRisks()).toHaveLength(1);
    await finishModule();
    expect(await openRisks()).toHaveLength(0);
  });

  it("is closed by replaying a module completed before the click", async () => {
    await finishModule();
    await recordClick(db, (await recipient()).token, "link");
    expect(await openRisks()).toHaveLength(1);
    // Earlier lessons alone are not the training again.
    const first = await completeLesson(db, { tenantId, userId, lessonId: lessonIds[0] });
    expect(first.moduleStatus).toBe("completed");
    expect(await openRisks()).toHaveLength(1);
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[1] });
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[2] });
    expect(await openRisks()).toHaveLength(0);
    const [mp] = await db.select().from(t.moduleProgress).where(and(eq(t.moduleProgress.userId, userId), eq(t.moduleProgress.moduleId, moduleId)));
    expect(mp.status).toBe("completed");
  });

  it("stays open when only the last lesson is replayed after the click", async () => {
    await finishModule();
    await recordClick(db, (await recipient()).token, "link");
    const last = await completeLesson(db, { tenantId, userId, lessonId: lessonIds[2] });
    expect(last.moduleStatus).toBe("completed");
    expect(await openRisks()).toHaveLength(1);
    // Replaying it again does not count as the other lessons either.
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[2] });
    expect(await openRisks()).toHaveLength(1);
  });

  it("closes once every lesson is replayed after the click, in any order", async () => {
    await finishModule();
    await recordClick(db, (await recipient()).token, "link");
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[2] });
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[0] });
    expect(await openRisks()).toHaveLength(1);
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[1] });
    expect(await openRisks()).toHaveLength(0);
    const rows = await db.select().from(t.lessonProgress).where(eq(t.lessonProgress.userId, userId));
    // completed_at keeps the first completion; last_completed_at moved to the replay.
    for (const row of rows) expect(row.lastCompletedAt!.getTime()).toBeGreaterThan(row.completedAt!.getTime());
  });

  it("does not close a risk opened after a replayed lesson's time", async () => {
    await finishModule();
    await recordClick(db, (await recipient()).token, "link");
    await completeLesson(db, { tenantId, userId, lessonId: lessonIds[2], at: new Date(Date.now() - 86_400_000) });
    expect(await openRisks()).toHaveLength(1);
  });
});

describe("certificate serials", () => {
  it("number by the Baku year, so a certificate from the first hours of 1 January starts the new year", async () => {
    // 31 December 21:30 UTC is 1 January 01:30 in Baku.
    const first = await issueCertificate(db, { tenantId, userId, at: new Date("2026-12-31T21:30:00Z") });
    const [row] = await db.select({ serial: t.certificates.serial }).from(t.certificates).where(eq(t.certificates.publicToken, first.publicToken));
    expect(row.serial).toBe("ACME-2027-000001");
    expect((await issueCertificate(db, { tenantId, userId, at: new Date("2026-12-31T19:30:00Z") })).serial).toMatch(/^ACME-2026-/);
  });
});
