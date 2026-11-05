import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import { attestModule, awardXp, completeLesson, issueCertificate, reachScene, startLesson, touchModule } from "../src/server/services/progress";
import { DB_SETUP_TIMEOUT, addModule, addTenant, addUser, testDb } from "./helpers/db";

const { db, ready } = testDb();
beforeAll(ready, DB_SETUP_TIMEOUT);

/** Noon in Baku on the given day of October 2026. */
const day = (d: number) => new Date(Date.UTC(2026, 9, d, 8, 0, 0));
const user = async (id: string) => (await db.select().from(t.users).where(eq(t.users.id, id)))[0];
const lessonRow = async (userId: string, lessonId: string) =>
  (await db.select().from(t.lessonProgress).where(and(eq(t.lessonProgress.userId, userId), eq(t.lessonProgress.lessonId, lessonId))))[0];
const moduleRow = async (userId: string, moduleId: string) =>
  (await db.select().from(t.moduleProgress).where(and(eq(t.moduleProgress.userId, userId), eq(t.moduleProgress.moduleId, moduleId))))[0];

async function setup(o: { lessons?: number; firstPosition?: number; xp?: number } = {}) {
  const tenant = await addTenant(db);
  const person = await addUser(db, tenant.id);
  const mod = await addModule(db, { lessons: o.lessons ?? 3, firstPosition: o.firstPosition, xp: o.xp ?? 100 });
  return { tenant, person, mod };
}

describe("awardXp", () => {
  it("adds XP, logs the event and starts a streak", async () => {
    const { tenant, person } = await setup();
    await awardXp(db, { tenantId: tenant.id, userId: person.id, amount: 30, reason: "lesson", ref: "x", at: day(10) });
    const u = await user(person.id);
    expect(u).toMatchObject({ xp: 30, streakCurrent: 1, streakLongest: 1, streakLastDay: "2026-10-10", lastActiveAt: day(10) });
    const events = await db.select().from(t.xpEvents).where(eq(t.xpEvents.userId, person.id));
    expect(events).toMatchObject([{ amount: 30, reason: "lesson", ref: "x", at: day(10) }]);
  });

  it("grows the streak on consecutive days, keeps it within a day and restarts it after a gap", async () => {
    const { tenant, person } = await setup();
    const award = (d: number) => awardXp(db, { tenantId: tenant.id, userId: person.id, amount: 5, reason: "report", at: day(d) });
    await award(1);
    await award(2);
    await award(2);
    expect(await user(person.id)).toMatchObject({ xp: 15, streakCurrent: 2, streakLongest: 2 });
    await award(5);
    expect(await user(person.id)).toMatchObject({ streakCurrent: 1, streakLongest: 2, streakLastDay: "2026-10-05" });
  });

  it("earns a freeze every 7 days and spends it on a single missed day", async () => {
    const { tenant, person } = await setup();
    for (let d = 1; d <= 7; d++) await awardXp(db, { tenantId: tenant.id, userId: person.id, amount: 1, reason: "lesson", at: day(d) });
    expect(await user(person.id)).toMatchObject({ streakCurrent: 7, streakFreezes: 1 });
    await awardXp(db, { tenantId: tenant.id, userId: person.id, amount: 1, reason: "lesson", at: day(9) });
    expect(await user(person.id)).toMatchObject({ streakCurrent: 8, streakFreezes: 0 });
  });

  it("never moves the streak backwards for history replayed out of order, and keeps the latest activity time", async () => {
    const { tenant, person } = await setup();
    await awardXp(db, { tenantId: tenant.id, userId: person.id, amount: 10, reason: "lesson", at: day(20) });
    await awardXp(db, { tenantId: tenant.id, userId: person.id, amount: 10, reason: "lesson", at: day(3) });
    expect(await user(person.id)).toMatchObject({ xp: 20, streakCurrent: 1, streakLastDay: "2026-10-20", lastActiveAt: day(20) });
  });
});

describe("completeLesson", () => {
  it("splits the module's XP over its lessons, the remainder going to the last lesson", async () => {
    const { tenant, person, mod } = await setup({ xp: 100 });
    const xp = [];
    for (const l of mod.lessons) xp.push((await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: l.id, at: day(1) })).xpAwarded);
    expect(xp).toEqual([33, 33, 34]);
    expect((await user(person.id)).xp).toBe(100);
  });

  it("splits the XP the same way for Studio modules, whose lessons are numbered from 1", async () => {
    const { tenant, person, mod } = await setup({ xp: 100, firstPosition: 1 });
    const xp = [];
    for (const l of mod.lessons) xp.push((await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: l.id, at: day(1) })).xpAwarded);
    expect(xp).toEqual([33, 33, 34]);
  });

  it("awards the whole module XP when a lesson's position is missing from the sequence", async () => {
    const { tenant, person, mod } = await setup({ xp: 100 });
    await db.update(t.lessons).set({ position: 7 }).where(eq(t.lessons.id, mod.lessons[2].id));
    let total = 0;
    for (const l of mod.lessons) total += (await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: l.id, at: day(1) })).xpAwarded;
    expect(total).toBe(100);
  });

  it("moves the module from in progress to awaiting the attestation", async () => {
    const { tenant, person, mod } = await setup();
    const first = await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: mod.lessons[0].id, secondsSpent: 90, at: day(1) });
    expect(first).toEqual({ xpAwarded: 33, firstTime: true, moduleStatus: "in_progress", percent: 33 });
    expect(await moduleRow(person.id, mod.id)).toMatchObject({ status: "in_progress", percent: 33, lastLessonKey: "lesson-1", startedAt: day(1) });
    await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: mod.lessons[1].id, at: day(1) });
    const last = await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: mod.lessons[2].id, at: day(2) });
    expect(last).toMatchObject({ moduleStatus: "awaiting_attestation", percent: 100 });
    expect(await moduleRow(person.id, mod.id)).toMatchObject({ status: "awaiting_attestation", completedAt: null, startedAt: day(1) });
  });

  it("awards nothing for a replay but counts the attempt, the time and the latest completion", async () => {
    const { tenant, person, mod } = await setup();
    const lesson = mod.lessons[0];
    await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: lesson.id, secondsSpent: 60, at: day(1) });
    const again = await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: lesson.id, secondsSpent: 40, at: day(4) });
    expect(again).toMatchObject({ xpAwarded: 0, firstTime: false });
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ completedAt: day(1), lastCompletedAt: day(4), xpAwarded: 33, attempts: 2, secondsSpent: 100 });
    expect((await user(person.id)).xp).toBe(33);
  });

  it("awards the lesson XP once when the same completion arrives twice at the same time", async () => {
    const { tenant, person, mod } = await setup();
    const lesson = mod.lessons[0];
    const results = await Promise.all([
      completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: lesson.id, at: day(1) }),
      completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: lesson.id, at: day(1) }),
    ]);
    expect(results.map((r) => r.xpAwarded).sort()).toEqual([0, 33]);
    expect(results.filter((r) => r.firstTime)).toHaveLength(1);
    expect((await user(person.id)).xp).toBe(33);
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ xpAwarded: 33, attempts: 2 });
    expect(await db.select().from(t.xpEvents).where(eq(t.xpEvents.userId, person.id))).toHaveLength(1);
  });

  it("refuses an unknown lesson", async () => {
    const { tenant, person } = await setup();
    await expect(completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow("Lesson not found");
  });
});

describe("startLesson and reachScene", () => {
  it("records when an attempt began, once per sitting, and the furthest scene shown; a completion clears both", async () => {
    const { tenant, person, mod } = await setup();
    const lesson = mod.lessons[0];
    const hour = 3600_000;
    await startLesson(db, { userId: person.id, lessonId: lesson.id, at: day(1) });
    await startLesson(db, { userId: person.id, lessonId: lesson.id, at: new Date(day(1).getTime() + hour) });
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ startedAt: day(1) });
    // Reopened more than four hours later: a new sitting, so the clock restarts.
    await startLesson(db, { userId: person.id, lessonId: lesson.id, at: new Date(day(1).getTime() + 5 * hour) });
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ startedAt: new Date(day(1).getTime() + 5 * hour) });
    await startLesson(db, { userId: person.id, lessonId: lesson.id, at: new Date(day(1).getTime() + 6 * hour) });
    await reachScene(db, { userId: person.id, lessonId: lesson.id, index: 3 });
    await reachScene(db, { userId: person.id, lessonId: lesson.id, index: 1 });
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ startedAt: new Date(day(1).getTime() + 5 * hour), reached: 3, completedAt: null, attempts: 0 });
    await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: lesson.id, at: day(2) });
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ startedAt: null, reached: 0, completedAt: day(2), attempts: 1 });
    await startLesson(db, { userId: person.id, lessonId: lesson.id, at: day(3) });
    expect(await lessonRow(person.id, lesson.id)).toMatchObject({ startedAt: day(3), completedAt: day(2) });
  });
});

describe("touchModule", () => {
  it("marks a module as started without completing anything, and only moves the bookmark later", async () => {
    const { person, mod } = await setup();
    await touchModule(db, { userId: person.id, moduleId: mod.id, lessonKey: "lesson-1", at: day(1) });
    expect(await moduleRow(person.id, mod.id)).toMatchObject({ status: "in_progress", percent: 0, lastLessonKey: "lesson-1", startedAt: day(1) });
    await db.update(t.moduleProgress).set({ status: "completed" }).where(eq(t.moduleProgress.userId, person.id));
    await touchModule(db, { userId: person.id, moduleId: mod.id, lessonKey: "lesson-2", at: day(5) });
    expect(await moduleRow(person.id, mod.id)).toMatchObject({ status: "completed", lastLessonKey: "lesson-2", startedAt: day(1) });
  });
});

describe("attestModule", () => {
  async function finished() {
    const s = await setup();
    for (const l of s.mod.lessons) await completeLesson(db, { tenantId: s.tenant.id, userId: s.person.id, lessonId: l.id, at: day(1) });
    return s;
  }

  it("is refused before the last lesson", async () => {
    const { tenant, person, mod } = await setup();
    expect(await attestModule(db, { tenantId: tenant.id, userId: person.id, moduleId: mod.id, text: "I agree", locale: "en" })).toBeNull();
    await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: mod.lessons[0].id });
    expect(await attestModule(db, { tenantId: tenant.id, userId: person.id, moduleId: mod.id, text: "I agree", locale: "en" })).toBeNull();
    expect(await db.select().from(t.attestations).where(eq(t.attestations.userId, person.id))).toEqual([]);
  });

  it("stores the text verbatim, completes the module, issues a certificate and closes the module's open risks", async () => {
    const { tenant, person, mod } = await finished();
    const other = await addModule(db);
    await db.insert(t.behaviorRisks).values([
      { tenantId: tenant.id, userId: person.id, kind: "phishing_click", severity: "medium", title: "Clicked", moduleId: mod.id },
      { tenantId: tenant.id, userId: person.id, kind: "policy", severity: "low", title: "Other module", moduleId: other.id },
    ]);
    const res = await attestModule(db, { tenantId: tenant.id, userId: person.id, moduleId: mod.id, text: "Mən özüm keçdim.", locale: "az", at: day(2) });
    expect(res?.publicToken).toMatch(/^[a-z2-7]+$/);
    expect(await moduleRow(person.id, mod.id)).toMatchObject({ status: "completed", percent: 100, completedAt: day(2) });
    expect(await db.select().from(t.attestations).where(eq(t.attestations.userId, person.id))).toMatchObject([{ text: "Mən özüm keçdim.", locale: "az", moduleId: mod.id, at: day(2) }]);
    const [cert] = await db.select().from(t.certificates).where(eq(t.certificates.userId, person.id));
    expect(cert).toMatchObject({ moduleId: mod.id, publicToken: res?.publicToken, serial: `${tenant.slug.toUpperCase()}-2026-000001`, evidence: "server_verified" });
    const risks = await db.select().from(t.behaviorRisks).where(eq(t.behaviorRisks.userId, person.id));
    expect(risks.find((r) => r.moduleId === mod.id)).toMatchObject({ status: "closed", closedAt: day(2) });
    expect(risks.find((r) => r.moduleId === other.id)).toMatchObject({ status: "open" });
    // Attested modules stay completed when replayed, and a second attestation is refused.
    expect((await completeLesson(db, { tenantId: tenant.id, userId: person.id, lessonId: mod.lessons[0].id })).moduleStatus).toBe("completed");
    expect(await attestModule(db, { tenantId: tenant.id, userId: person.id, moduleId: mod.id, text: "again", locale: "en" })).toBeNull();
  });

  it("issues one attestation and one certificate when the confirmation is sent twice at the same time", async () => {
    const { tenant, person, mod } = await finished();
    const results = await Promise.all([
      attestModule(db, { tenantId: tenant.id, userId: person.id, moduleId: mod.id, text: "I agree", locale: "en" }),
      attestModule(db, { tenantId: tenant.id, userId: person.id, moduleId: mod.id, text: "I agree", locale: "en" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await db.select().from(t.attestations).where(eq(t.attestations.userId, person.id))).toHaveLength(1);
    expect(await db.select().from(t.certificates).where(eq(t.certificates.userId, person.id))).toHaveLength(1);
  });
});

describe("issueCertificate", () => {
  it("numbers certificates per organisation and year, never reusing a deleted serial", async () => {
    const tenant = await addTenant(db, { slug: "acme-cert" });
    const other = await addTenant(db, { slug: "beta-cert" });
    const person = await addUser(db, tenant.id);
    const outsider = await addUser(db, other.id);
    const at = day(15);
    const a = await issueCertificate(db, { tenantId: tenant.id, userId: person.id, at });
    const b = await issueCertificate(db, { tenantId: tenant.id, userId: person.id, at });
    const c = await issueCertificate(db, { tenantId: other.id, userId: outsider.id, at });
    expect([a.serial, b.serial, c.serial]).toEqual(["ACME-CERT-2026-000001", "ACME-CERT-2026-000002", "BETA-CERT-2026-000001"]);
    await db.delete(t.certificates).where(eq(t.certificates.serial, a.serial));
    expect((await issueCertificate(db, { tenantId: tenant.id, userId: person.id, at })).serial).toBe("ACME-CERT-2026-000003");
    expect((await issueCertificate(db, { tenantId: tenant.id, userId: person.id, at: new Date(Date.UTC(2027, 0, 5)) })).serial).toBe("ACME-CERT-2027-000001");
  });

  it("hands out distinct serials to certificates issued at the same moment", async () => {
    const tenant = await addTenant(db);
    const person = await addUser(db, tenant.id);
    const serials = await Promise.all(Array.from({ length: 4 }, () => issueCertificate(db, { tenantId: tenant.id, userId: person.id, at: day(1) })));
    expect(new Set(serials.map((s) => s.serial)).size).toBe(4);
    expect(new Set(serials.map((s) => s.publicToken)).size).toBe(4);
  });
});
