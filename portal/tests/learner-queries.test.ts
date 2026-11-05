import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as t from "../src/server/db/schema";
import type { Viewer } from "../src/server/auth/viewer";
import { featuresFor, withDefaults } from "../src/lib/tenant-defaults";
import { dayKey } from "../src/lib/domain/gamification";
import { DB_SETUP_TIMEOUT, addDepartment, addModule, addTenant, addUser, assignEveryone, testDb } from "./helpers/db";

const { db, ready } = testDb();
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

const { badgeFacts, badgesFor } = await import("../src/server/queries/badges");
const { continueModule, getCatalog, nextLesson, yourPath } = await import("../src/server/queries/catalog");
const learner = await import("../src/server/queries/learner");

beforeAll(ready, DB_SETUP_TIMEOUT);

const DAY = 86_400_000;

async function person(o: Partial<typeof t.users.$inferInsert> = {}) {
  const tenant = await addTenant(db);
  const user = await addUser(db, tenant.id, o);
  const v = {
    sessionId: "s",
    twoFactorVerified: true,
    user: { ...user },
    tenant: { ...tenant, settings: withDefaults(tenant.settings), features: featuresFor(tenant.plan, tenant.features) },
  } as unknown as Viewer;
  return { tenant, user, v };
}

async function policy(tenantId: string, versions: { version: number; published: boolean; translations?: Record<string, { title: string; bodyMd: string }> }[], archived = false) {
  const [p] = await db.insert(t.policies).values({ tenantId, title: "AUP", archivedAt: archived ? new Date() : null }).returning();
  const rows = [];
  for (const v of versions) {
    const [row] = await db
      .insert(t.policyVersions)
      .values({ policyId: p.id, version: v.version, title: `AUP v${v.version}`, bodyMd: "x", translations: v.translations ?? null, publishedAt: v.published ? new Date(Date.now() - (10 - v.version) * DAY) : null })
      .returning();
    rows.push(row);
  }
  return { policy: p, versions: rows };
}

describe("badgeFacts", () => {
  it("counts the facts behind every badge for one person", async () => {
    const { tenant, user } = await person({ streakLongest: 9 });
    const mod = await addModule(db, { lessons: 2 });
    await db.insert(t.lessonProgress).values(mod.lessons.map((l) => ({ userId: user.id, lessonId: l.id, completedAt: new Date() })));
    await db.insert(t.moduleProgress).values({ userId: user.id, moduleId: mod.id, status: "completed", percent: 100 });
    await db.insert(t.threatReports).values(Array.from({ length: 5 }, (_, i) => ({ tenantId: tenant.id, number: 100 + i, reporterId: user.id, channel: "email" as const, subject: "s" })));
    await db.insert(t.labAttempts).values(["inbox-triage", "inbox-triage", "link-detective", "password-forge", "mfa-fatigue"].map((exercise) => ({ tenantId: tenant.id, userId: user.id, exercise, score: 1, max: 1, xp: 0 })));
    const [path] = await db.insert(t.learningPaths).values({ key: `p-${user.id}`, title: {}, description: {}, audience: {}, recurrence: {}, standards: [], moduleSlugs: [] }).returning();
    await db.insert(t.certificates).values([
      { tenantId: tenant.id, userId: user.id, moduleId: mod.id, serial: `S-${user.id}-1`, publicToken: `P-${user.id}-1` },
      { tenantId: tenant.id, userId: user.id, pathId: path.id, serial: `S-${user.id}-2`, publicToken: `P-${user.id}-2` },
    ]);
    // Two live policies: the newest version of one is signed, the other is not.
    const a = await policy(tenant.id, [{ version: 1, published: true }, { version: 2, published: true }]);
    await policy(tenant.id, [{ version: 1, published: true }]);
    await policy(tenant.id, [{ version: 1, published: true }], true);
    await db.insert(t.policySignoffs).values({ versionId: a.versions[1].id, userId: user.id });

    expect(await badgeFacts(user.id, tenant.id)).toEqual({
      lessonsCompleted: 2,
      modulesCompleted: 1,
      reports: 5,
      longestStreak: 9,
      policiesToSign: 1,
      policiesSigned: 1,
      labGamesPlayed: 4,
      certificates: 2,
      pathsCompleted: 1,
    });
    expect(await badgesFor(user.id, tenant.id)).toEqual(["first_step", "module_master", "sharp_eye", "streak_7", "lab_explorer", "path_finisher"]);
  });

  it("is all zeros for a new person, and signing only an old version leaves the policy to sign", async () => {
    const { tenant, user } = await person();
    const p = await policy(tenant.id, [{ version: 1, published: true }, { version: 2, published: true }, { version: 3, published: false }]);
    await db.insert(t.policySignoffs).values({ versionId: p.versions[0].id, userId: user.id });
    expect(await badgeFacts(user.id, tenant.id)).toMatchObject({ lessonsCompleted: 0, reports: 0, policiesToSign: 1, policiesSigned: 0, certificates: 0 });
    expect(await badgesFor(user.id, tenant.id)).toEqual([]);
  });
});

describe("getCatalog", () => {
  it("lists published library and organisation modules with the person's progress and assignments", async () => {
    const { tenant, user, v } = await person();
    const assigned = await addModule(db, { sortOrder: 2, title: { en: "Assigned", az: "Təyin edilmiş" } });
    const library = await addModule(db, { sortOrder: 1, slug: `lib-${user.id}` });
    const own = await addModule(db, { sortOrder: 3, slug: `lib-${user.id}`, tenantId: tenant.id, origin: "custom", title: { en: "Our version" } });
    const draft = await addModule(db, { tenantId: tenant.id, status: "draft" });
    const foreign = await addModule(db, { tenantId: (await addTenant(db)).id });
    await assignEveryone(db, tenant.id, assigned.id, { dueKind: "fixed", dueDate: "2026-12-01" });
    await db.insert(t.lessonProgress).values({ userId: user.id, lessonId: assigned.lessons[1].id, completedAt: new Date() });
    await db.insert(t.moduleProgress).values({ userId: user.id, moduleId: assigned.id, status: "in_progress", percent: 33, lastLessonKey: "lesson-2", startedAt: new Date() });

    const catalog = await getCatalog(v, "az");
    const ids = catalog.map((m) => m.id);
    expect(ids).toContain(assigned.id);
    expect(ids).toContain(own.id);
    // The organisation's module with the library slug replaces the library one; drafts and other organisations' modules are not listed.
    expect(ids).not.toContain(library.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(foreign.id);
    const a = catalog.find((m) => m.id === assigned.id)!;
    expect(a).toMatchObject({ title: "Təyin edilmiş", status: "in_progress", percent: 33, lastLessonKey: "lesson-2", assigned: true, due: "2026-12-01", forYou: true });
    expect(a.lessons.map((l) => l.completed)).toEqual([false, true, false]);
    expect(nextLesson(a).key).toBe("lesson-1");
    expect(catalog.find((m) => m.id === own.id)).toMatchObject({ title: "Our version", status: "not_started", assigned: false, due: null });

    expect((await getCatalog(v, "en", true)).map((m) => m.id)).toContain(draft.id);
  });

  it("lower-cases audiences saved by older Studio versions", async () => {
    const { tenant, v } = await person();
    const mod = await addModule(db, { tenantId: tenant.id, audiences: ["Everyone", "IT"] });
    expect((await getCatalog(v, "en")).find((m) => m.id === mod.id)?.audiences).toEqual(["everyone", "it"]);
  });
});

describe("continueModule and yourPath", () => {
  type M = Parameters<typeof yourPath>[0][number];
  const m = (id: string, o: Partial<M> = {}): M =>
    ({ id, slug: id, category: "phishing", audiences: ["everyone"], title: id, subtitle: "", minutes: 5, xp: 10, difficulty: "Easy", origin: "library", sortOrder: 0, lessons: [], status: "not_started", percent: 0, lastLessonKey: null, completedAt: null, startedAt: null, assigned: false, due: null, forYou: false, ...o }) as M;

  it("orders assigned modules by due date, then the everyone track", () => {
    const path = yourPath([m("rest-b", { sortOrder: 2 }), m("late", { assigned: true, forYou: true, due: "2026-12-01" }), m("soon", { assigned: true, forYou: true, due: "2026-11-01" }), m("no-due", { assigned: true, forYou: true }), m("it-only", { audiences: ["it"] })]);
    expect(path.map((x) => x.id)).toEqual(["soon", "late", "no-due", "rest-b"]);
  });

  it("continues the most recently started module, else the first unfinished one on the path", () => {
    const older = m("older", { status: "in_progress", startedAt: new Date("2026-10-01") });
    const newer = m("newer", { status: "awaiting_attestation", startedAt: new Date("2026-10-05") });
    expect(continueModule([older, newer])?.id).toBe("newer");
    expect(continueModule([m("done", { assigned: true, status: "completed" }), m("todo", { assigned: true })])?.id).toBe("todo");
    expect(continueModule([m("done", { status: "completed" })])).toBeNull();
  });
});

describe("learner home queries", () => {
  it("lists the latest published version of each live policy, in the reader's language, with the signature", async () => {
    const { tenant, user, v } = await person();
    const a = await policy(tenant.id, [{ version: 1, published: true }, { version: 2, published: true, translations: { ru: { title: "ДИ v2", bodyMd: "x" } } }, { version: 3, published: false }]);
    await policy(tenant.id, [{ version: 1, published: true }], true);
    await db.insert(t.policySignoffs).values({ versionId: a.versions[1].id, userId: user.id });
    const rows = await learner.getPolicies(v, "ru");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ policyId: a.policy.id, versionId: a.versions[1].id, version: 2, title: "ДИ v2" });
    expect(rows[0].signedAt).toBeInstanceOf(Date);
    expect((await learner.getPolicies(v, "de"))[0].title).toBe("AUP v2");
  });

  it("sums today's XP in Baku and returns 30 days of XP for the chart", async () => {
    const { tenant, user, v } = await person();
    const now = Date.now();
    await db.insert(t.xpEvents).values([
      { tenantId: tenant.id, userId: user.id, amount: 10, reason: "lesson", at: new Date(now - 60_000) },
      { tenantId: tenant.id, userId: user.id, amount: 5, reason: "report", at: new Date(now - 30_000) },
      { tenantId: tenant.id, userId: user.id, amount: 7, reason: "lesson", at: new Date(now - 3 * DAY) },
    ]);
    expect(await learner.todayXp(v)).toBe(dayKey(new Date(now - 60_000)) === dayKey(new Date()) ? 15 : 0);
    const days = await learner.xpByDay(v);
    expect(days).toHaveLength(30);
    expect(days.at(-1)?.label).toBe(dayKey(new Date()));
    expect(days.reduce((s, d) => s + d.value, 0)).toBe(22);
    expect(days.find((d) => d.label === dayKey(new Date(now - 3 * DAY)))?.value).toBe(7);
  });

  it("lists the person's risks newest first within each status, and counts only the open ones", async () => {
    const { tenant, user, v } = await person();
    await db.insert(t.behaviorRisks).values([
      { tenantId: tenant.id, userId: user.id, kind: "policy", severity: "low", title: "closed", status: "closed", createdAt: new Date(Date.now() - 1_000) },
      { tenantId: tenant.id, userId: user.id, kind: "phishing_click", severity: "high", title: "older open", createdAt: new Date(Date.now() - 5 * DAY) },
      { tenantId: tenant.id, userId: user.id, kind: "incident", severity: "medium", title: "newer open", createdAt: new Date(Date.now() - DAY) },
    ]);
    const risks = await learner.openRisks(v);
    expect(risks.filter((r) => r.status === "open").map((r) => r.title)).toEqual(["newer open", "older open"]);
    expect(risks.filter((r) => r.status === "closed").map((r) => r.title)).toEqual(["closed"]);
    expect(await learner.openRiskCount(v)).toBe(2);
  });

  it("finds the next live session of the organisation", async () => {
    const { tenant, v } = await person();
    expect(await learner.nextLiveSession(v)).toBeNull();
    const base = { tenantId: tenant.id, durationMin: 30, location: "Room", host: "Host" };
    await db.insert(t.liveSessions).values([
      { ...base, title: "past", startsAt: new Date(Date.now() - DAY) },
      { ...base, title: "later", startsAt: new Date(Date.now() + 3 * DAY) },
      { ...base, title: "next", startsAt: new Date(Date.now() + DAY) },
    ]);
    expect((await learner.nextLiveSession(v))?.title).toBe("next");
  });

  it("finds the person's own department in the league and explains their risk score", async () => {
    const { tenant, user, v } = await person();
    const dept = await addDepartment(db, tenant.id, "Sales");
    await db.update(t.users).set({ departmentId: dept.id }).where(eq(t.users.id, user.id));
    (v.user as { departmentId: string | null }).departmentId = dept.id;
    const { rows, mine } = await learner.myLeagueRow(v);
    expect(rows.map((r) => r.id)).toEqual([dept.id]);
    expect(mine?.id).toBe(dept.id);
    expect(await learner.myRiskBreakdown(v)).toMatchObject({ score: 16 });
  });
});
