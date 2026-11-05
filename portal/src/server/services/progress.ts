/**
 * Learning progress: XP, streaks, lesson and module completion, attestations and certificates.
 * Every function takes the database explicitly so the seed can replay history with past dates.
 */
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { and, asc, count, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { dayKey, lessonXp, nextStreak } from "../../lib/domain/gamification";
import { isUniqueViolation } from "../db/errors";

export function randomToken(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return encodeBase32LowerCaseNoPadding(buf);
}

export async function awardXp(
  db: DB,
  p: { tenantId: string; userId: string; amount: number; reason: string; ref?: string; at?: Date },
): Promise<void> {
  const at = p.at ?? new Date();
  await db.insert(t.xpEvents).values({ tenantId: p.tenantId, userId: p.userId, amount: p.amount, reason: p.reason, ref: p.ref ?? null, at });
  const [u] = await db
    .select({ cur: t.users.streakCurrent, longest: t.users.streakLongest, last: t.users.streakLastDay, freezes: t.users.streakFreezes })
    .from(t.users)
    .where(eq(t.users.id, p.userId));
  if (!u) return;
  const day = dayKey(at);
  // Replayed history (seed) can arrive out of order; never move the streak backwards.
  const streak =
    u.last && u.last > day ? { current: u.cur, longest: u.longest, lastDay: u.last, freezes: u.freezes } : nextStreak({ current: u.cur, longest: u.longest, lastDay: u.last }, day, u.freezes);
  await db
    .update(t.users)
    .set({
      xp: sql`${t.users.xp} + ${p.amount}`,
      streakCurrent: streak.current,
      streakLongest: streak.longest,
      streakLastDay: streak.lastDay,
      streakFreezes: streak.freezes,
      lastActiveAt: sql`greatest(coalesce(${t.users.lastActiveAt}, ${at.toISOString()}::timestamptz), ${at.toISOString()}::timestamptz)`,
    })
    .where(eq(t.users.id, p.userId));
}

export type LessonCompletion = {
  xpAwarded: number;
  firstTime: boolean;
  moduleStatus: "in_progress" | "awaiting_attestation" | "completed";
  percent: number;
};

export async function completeLesson(
  db: DB,
  p: { tenantId: string; userId: string; lessonId: string; secondsSpent?: number; at?: Date },
): Promise<LessonCompletion> {
  const at = p.at ?? new Date();
  const [lesson] = await db
    .select({ id: t.lessons.id, moduleId: t.lessons.moduleId, key: t.lessons.key, position: t.lessons.position })
    .from(t.lessons)
    .where(eq(t.lessons.id, p.lessonId));
  if (!lesson) throw new Error("Lesson not found");
  const [mod] = await db.select({ xp: t.modules.xp }).from(t.modules).where(eq(t.modules.id, lesson.moduleId));
  const siblings = await db.select({ id: t.lessons.id }).from(t.lessons).where(eq(t.lessons.moduleId, lesson.moduleId)).orderBy(asc(t.lessons.position));

  // The first completion is claimed by a single statement: the row is created, or an uncompleted one
  // completed, and only that statement returns it. Two requests at the same moment (a double submit, a
  // retry) therefore cannot both see the lesson as new and award its XP twice.
  const thisLesson = and(eq(t.lessonProgress.userId, p.userId), eq(t.lessonProgress.lessonId, p.lessonId));
  const claimed = await db
    .insert(t.lessonProgress)
    .values({ userId: p.userId, lessonId: p.lessonId, completedAt: at, lastCompletedAt: at, xpAwarded: 0, attempts: 0, secondsSpent: 0 })
    .onConflictDoUpdate({ target: [t.lessonProgress.userId, t.lessonProgress.lessonId], set: { completedAt: at }, where: isNull(t.lessonProgress.completedAt) })
    .returning({ userId: t.lessonProgress.userId });
  const firstTime = claimed.length > 0;
  // The lesson's place among its siblings, not its stored position: Studio lessons are numbered from 1
  // and positions can have gaps, and the remainder of the split must still go to the last lesson.
  const index = siblings.findIndex((s) => s.id === lesson.id);
  const xp = firstTime ? lessonXp(mod.xp, siblings.length, index) : 0;

  await db
    .update(t.lessonProgress)
    .set({
      // Replayed history (seed) can arrive out of order; keep the latest completion.
      lastCompletedAt: sql`greatest(coalesce(${t.lessonProgress.lastCompletedAt}, ${at.toISOString()}::timestamptz), ${at.toISOString()}::timestamptz)`,
      xpAwarded: sql`${t.lessonProgress.xpAwarded} + ${xp}`,
      attempts: sql`${t.lessonProgress.attempts} + 1`,
      secondsSpent: sql`${t.lessonProgress.secondsSpent} + ${p.secondsSpent ?? 0}`,
      // The attempt is used up: the next one starts again from startLesson.
      startedAt: null,
      reached: 0,
    })
    .where(thisLesson);
  if (xp > 0) await awardXp(db, { tenantId: p.tenantId, userId: p.userId, amount: xp, reason: "lesson", ref: p.lessonId, at });

  const [{ done }] = await db
    .select({ done: count() })
    .from(t.lessonProgress)
    .where(
      and(
        eq(t.lessonProgress.userId, p.userId),
        inArray(
          t.lessonProgress.lessonId,
          siblings.map((s) => s.id),
        ),
        sql`${t.lessonProgress.completedAt} is not null`,
      ),
    );
  const percent = Math.round((Number(done) / siblings.length) * 100);
  const [mp] = await db
    .select({ status: t.moduleProgress.status })
    .from(t.moduleProgress)
    .where(and(eq(t.moduleProgress.userId, p.userId), eq(t.moduleProgress.moduleId, lesson.moduleId)));
  const status: LessonCompletion["moduleStatus"] =
    mp?.status === "completed" ? "completed" : percent >= 100 ? "awaiting_attestation" : "in_progress";
  await db
    .insert(t.moduleProgress)
    .values({ userId: p.userId, moduleId: lesson.moduleId, status, percent, lastLessonKey: lesson.key, startedAt: at })
    .onConflictDoUpdate({
      target: [t.moduleProgress.userId, t.moduleProgress.moduleId],
      set: { status, percent, lastLessonKey: lesson.key },
    });
  // A completed module stays completed when it is replayed, so no attestation follows. A risk
  // linked to it since then (a click in a simulation) asks for the training again: it closes once
  // every lesson of the module has been completed again after the risk opened (each lesson's
  // last_completed_at is at or after the risk), as the attestation closes it the first time.
  if (status === "completed" && percent >= 100) {
    const [replay] = await db
      .select({ lessons: count(t.lessonProgress.lastCompletedAt), oldest: sql<Date | null>`min(${t.lessonProgress.lastCompletedAt})`.mapWith(t.lessonProgress.lastCompletedAt) })
      .from(t.lessonProgress)
      .where(
        and(
          eq(t.lessonProgress.userId, p.userId),
          inArray(
            t.lessonProgress.lessonId,
            siblings.map((s) => s.id),
          ),
        ),
      );
    if (replay && Number(replay.lessons) === siblings.length && replay.oldest) {
      await db
        .update(t.behaviorRisks)
        .set({ status: "closed", closedAt: at })
        .where(
          and(
            eq(t.behaviorRisks.userId, p.userId),
            eq(t.behaviorRisks.moduleId, lesson.moduleId),
            eq(t.behaviorRisks.status, "open"),
            lte(t.behaviorRisks.createdAt, replay.oldest),
          ),
        );
    }
  }
  return { xpAwarded: xp, firstTime, moduleStatus: status, percent };
}

/**
 * Opens an attempt at a lesson: its start is recorded once, until a completion uses it up. A start
 * older than four hours is a sitting that ended: the clock restarts, so a lesson opened days ahead
 * neither satisfies the dwell nor counts as time trained.
 */
export async function startLesson(db: DB, p: { userId: string; lessonId: string; at?: Date }) {
  const at = p.at ?? new Date();
  const now = sql`${at.toISOString()}::timestamptz`;
  await db
    .insert(t.lessonProgress)
    .values({ userId: p.userId, lessonId: p.lessonId, startedAt: at })
    .onConflictDoUpdate({
      target: [t.lessonProgress.userId, t.lessonProgress.lessonId],
      set: { startedAt: sql`case when ${t.lessonProgress.startedAt} > ${now} - interval '4 hours' then ${t.lessonProgress.startedAt} else ${now} end` },
    });
}

/** The furthest scene the player showed in the current attempt; it only moves forward. */
export async function reachScene(db: DB, p: { userId: string; lessonId: string; index: number }) {
  await db
    .update(t.lessonProgress)
    .set({ reached: sql`greatest(${t.lessonProgress.reached}, ${p.index})` })
    .where(and(eq(t.lessonProgress.userId, p.userId), eq(t.lessonProgress.lessonId, p.lessonId)));
}

/** Marks the start of a module (Home "Continue" card) without completing anything. */
export async function touchModule(db: DB, p: { userId: string; moduleId: string; lessonKey: string; at?: Date }) {
  await db
    .insert(t.moduleProgress)
    .values({ userId: p.userId, moduleId: p.moduleId, status: "in_progress", percent: 0, lastLessonKey: p.lessonKey, startedAt: p.at ?? new Date() })
    .onConflictDoUpdate({ target: [t.moduleProgress.userId, t.moduleProgress.moduleId], set: { lastLessonKey: p.lessonKey } });
}

/**
 * Next serial of the organisation for the year: SLUG-2026-000042. Taken from the highest serial
 * issued so far (not the row count, which goes down when a certificate is deleted and would hand
 * out an existing serial again).
 */
async function nextSerial(db: DB, tenantId: string, at: Date): Promise<string> {
  const [tenant] = await db.select({ slug: t.tenants.slug }).from(t.tenants).where(eq(t.tenants.id, tenantId));
  // The year of the Baku day (as the certificate shows it), not of the server's own time zone.
  const prefix = `${tenant.slug.toUpperCase()}-${dayKey(at).slice(0, 4)}-`;
  // The cast matters: with a text parameter, `substring(... from ...)` is the regular-expression form.
  const rest = sql`substring(${t.certificates.serial} from ${prefix.length + 1}::int)`;
  const [row] = await db
    .select({ n: sql<number | null>`max(cast(${rest} as integer))` })
    .from(t.certificates)
    .where(and(eq(t.certificates.tenantId, tenantId), sql`starts_with(${t.certificates.serial}, ${prefix})`, sql`${rest} ~ '^[0-9]{1,9}$'`));
  return `${prefix}${String(Number(row?.n ?? 0) + 1).padStart(6, "0")}`;
}

export async function issueCertificate(
  db: DB,
  p: { tenantId: string; userId: string; moduleId?: string; pathId?: string; at?: Date },
): Promise<{ serial: string; publicToken: string }> {
  const at = p.at ?? new Date();
  // Two certificates issued at the same moment read the same highest serial; the unique index
  // refuses the second, which then takes the next one. Other errors (a second certificate for the
  // same module or path) are not retried. Each try is its own savepoint, so a refused insert does
  // not abort a transaction this runs in (attestModule).
  for (let attempt = 0; ; attempt++) {
    const serial = await nextSerial(db, p.tenantId, at);
    const publicToken = randomToken(16);
    try {
      await db.transaction((tx) =>
        tx.insert(t.certificates).values({
          tenantId: p.tenantId,
          userId: p.userId,
          moduleId: p.moduleId ?? null,
          pathId: p.pathId ?? null,
          serial,
          publicToken,
          evidence: "server_verified",
          issuedAt: at,
        }),
      );
      return { serial, publicToken };
    } catch (error) {
      if (attempt >= 7 || !isUniqueViolation(error, "certificates_serial_unique")) throw error;
    }
  }
}

/**
 * The learner confirms the module after its last lesson. Only then it counts as completed:
 * the attestation text is stored verbatim, a certificate is issued and linked risks close.
 */
export async function attestModule(
  db: DB,
  p: { tenantId: string; userId: string; moduleId: string; text: string; locale: string; at?: Date },
): Promise<{ publicToken: string } | null> {
  const at = p.at ?? new Date();
  // Only the request that moves the module out of "awaiting attestation" goes on, so a confirmation sent
  // twice (a double click, a retry) stores one attestation and issues one certificate. The completion, its
  // attestation text and the certificate are written together: compliance evidence never shows one without
  // the others, and the unique keys per person and module back the claim.
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(t.moduleProgress)
      .set({ status: "completed", completedAt: at, percent: 100 })
      .where(and(eq(t.moduleProgress.userId, p.userId), eq(t.moduleProgress.moduleId, p.moduleId), eq(t.moduleProgress.status, "awaiting_attestation")))
      .returning({ userId: t.moduleProgress.userId });
    if (!row) return null;
    await tx.insert(t.attestations).values({ tenantId: p.tenantId, userId: p.userId, moduleId: p.moduleId, text: p.text, locale: p.locale, evidence: "server_verified", at });
    const cert = await issueCertificate(tx, { tenantId: p.tenantId, userId: p.userId, moduleId: p.moduleId, at });
    await tx
      .update(t.behaviorRisks)
      .set({ status: "closed", closedAt: at })
      .where(and(eq(t.behaviorRisks.userId, p.userId), eq(t.behaviorRisks.moduleId, p.moduleId), eq(t.behaviorRisks.status, "open")));
    return { publicToken: cert.publicToken };
  });
}
