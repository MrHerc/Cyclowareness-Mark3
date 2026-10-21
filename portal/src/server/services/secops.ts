import { and, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import type { LoopStage } from "../db/schema";
import { audit } from "./audit";
import { emitEvent } from "./events";
import { notifyUsers, type Localized } from "./notify";
import { recomputeRisk } from "./risk";
import { insertNumbered } from "./threats";
import { pick } from "../../i18n/config";
import { bakuDayPlus, todayInBaku } from "../../lib/time";

/* ───────── closed loops ───────── */

/**
 * A closed loop follows one real threat from intake to the training it produced:
 * intake → analysis → conversion → approval → targeting → training → feedback.
 */
export async function createLoop(
  db: DB,
  p: { tenantId: string; title: string; sourceType: (typeof t.loops.$inferInsert)["sourceType"]; sourceId?: string | null; verdict?: (typeof t.loops.$inferInsert)["verdict"]; stage?: LoopStage; actorId: string | null; incidentId?: string | null },
): Promise<string> {
  const stage = p.stage ?? "analysis";
  const now = new Date();
  const [loop] = await db
    .insert(t.loops)
    .values({ tenantId: p.tenantId, title: p.title.slice(0, 300), stage, verdict: p.verdict ?? "pending", sourceType: p.sourceType, sourceId: p.sourceId ?? null, incidentId: p.incidentId ?? null, createdAt: now, updatedAt: now })
    .returning({ id: t.loops.id });
  const last = t.LOOP_STAGES.indexOf(stage);
  await db.insert(t.loopEvents).values(t.LOOP_STAGES.slice(0, last + 1).map((s, i) => ({ loopId: loop.id, stage: s, actorId: i === 0 ? null : p.actorId, at: new Date(now.getTime() + i) })));
  return loop.id;
}

/** Moves a loop forward to `to` (never backwards). Returns false when the move is not allowed. */
export async function advanceLoop(db: DB, p: { tenantId: string; loopId: string; to: LoopStage; actorId: string | null; note?: string | null; verdict?: (typeof t.loops.$inferInsert)["verdict"] }): Promise<boolean> {
  const [loop] = await db.select().from(t.loops).where(and(eq(t.loops.id, p.loopId), eq(t.loops.tenantId, p.tenantId)));
  if (!loop || loop.closedAt) return false;
  const from = t.LOOP_STAGES.indexOf(loop.stage);
  const to = t.LOOP_STAGES.indexOf(p.to);
  if (to <= from) return false;
  const now = new Date();
  await db.insert(t.loopEvents).values(t.LOOP_STAGES.slice(from + 1, to + 1).map((s, i) => ({ loopId: loop.id, stage: s, actorId: p.actorId, note: s === p.to ? (p.note ?? null) : null, at: new Date(now.getTime() + i) })));
  await db
    .update(t.loops)
    .set({ stage: p.to, updatedAt: now, ...(p.verdict ? { verdict: p.verdict } : {}) })
    .where(eq(t.loops.id, loop.id));
  if (p.actorId) await audit(db, { tenantId: p.tenantId, actorId: p.actorId, action: "loop.advanced", targetType: "loop", targetId: loop.id, meta: { stage: p.to } });
  return true;
}

/** Closes a loop: it reaches the feedback stage and stops counting as open work. */
export async function closeLoop(db: DB, p: { tenantId: string; loopId: string; actorId: string; note?: string | null }): Promise<boolean> {
  const [loop] = await db.select().from(t.loops).where(and(eq(t.loops.id, p.loopId), eq(t.loops.tenantId, p.tenantId)));
  if (!loop || loop.closedAt) return false;
  if (loop.stage !== "feedback") await advanceLoop(db, { tenantId: p.tenantId, loopId: loop.id, to: "feedback", actorId: p.actorId, note: p.note });
  else if (p.note) await db.insert(t.loopEvents).values({ loopId: loop.id, stage: "feedback", actorId: p.actorId, note: p.note });
  await db.update(t.loops).set({ closedAt: new Date(), updatedAt: new Date() }).where(eq(t.loops.id, loop.id));
  await audit(db, { tenantId: p.tenantId, actorId: p.actorId, action: "loop.closed", targetType: "loop", targetId: loop.id });
  return true;
}

/* ───────── targeted training ───────── */

/**
 * Gives specific people one module because of a real event (incident, approved material).
 * It shows up under "My open risks" with a due date and closes when they finish the module.
 * People who already have an open risk from the same source are skipped, and so are people who
 * already completed the module: their risk could never close. `title` may depend on the
 * person's language (it is stored per person and used in their notification). The emails join the
 * outbox and the job runner's mail step sends them, so neither a request nor the tick waits for the
 * mail server once per person.
 */
export async function targetTraining(
  db: DB,
  p: {
    tenantId: string;
    userIds: string[];
    moduleId: string;
    severity: (typeof t.SEVERITY)[number];
    kind: (typeof t.behaviorRisks.$inferInsert)["kind"];
    title: Localized;
    sourceRef: string;
    dueDate?: string | null;
    note?: { title: string; body: string } | null;
  },
): Promise<string[]> {
  if (!p.userIds.length) return [];
  const [mod] = await db.select({ slug: t.modules.slug, title: t.modules.title }).from(t.modules).where(eq(t.modules.id, p.moduleId));
  if (!mod) return [];
  const people = await db
    .select({ id: t.users.id, locale: t.users.locale })
    .from(t.users)
    .where(and(eq(t.users.tenantId, p.tenantId), inArray(t.users.id, p.userIds), eq(t.users.status, "active")));
  if (!people.length) return [];
  const existing = await db
    .select({ userId: t.behaviorRisks.userId })
    .from(t.behaviorRisks)
    .where(and(eq(t.behaviorRisks.tenantId, p.tenantId), eq(t.behaviorRisks.sourceRef, p.sourceRef), eq(t.behaviorRisks.status, "open")));
  const completed = await db
    .select({ userId: t.moduleProgress.userId })
    .from(t.moduleProgress)
    .where(and(eq(t.moduleProgress.moduleId, p.moduleId), inArray(t.moduleProgress.userId, people.map((u) => u.id)), eq(t.moduleProgress.status, "completed")));
  const skip = new Set([...existing, ...completed].map((e) => e.userId));
  const targetPeople = people.filter((u) => !skip.has(u.id));
  const targets = targetPeople.map((u) => u.id);
  if (!targets.length) return [];
  const due = p.dueDate ?? bakuDayPlus(7);
  const titleFor = (locale: string) => (typeof p.title === "function" ? p.title(locale) : p.title);
  await db.insert(t.behaviorRisks).values(targetPeople.map((u) => ({ tenantId: p.tenantId, userId: u.id, kind: p.kind, severity: p.severity, title: titleFor(u.locale).slice(0, 300), sourceRef: p.sourceRef, moduleId: p.moduleId, dueDate: due })));
  // Module title and reason in each person's own language.
  const moduleTitle = (locale: string) => pick(mod.title, locale);
  const note = p.note;
  await notifyUsers(db, p.tenantId, targets, "assignment", { module: moduleTitle, dueDate: due, link: `/learn/${mod.slug}`, reason: titleFor }, { title: note?.title ?? moduleTitle, body: note ? note.body.slice(0, 280) : titleFor, href: `/learn/${mod.slug}` }, { defer: true });
  await recomputeRisk(db, p.tenantId, targets);
  return targets;
}

/** First-try accuracy (0–100) per person for one module, from their recorded answers. */
export async function moduleScores(db: DB, moduleId: string, userIds: string[]): Promise<Map<string, number>> {
  if (!userIds.length) return new Map();
  const rows = await db
    .select({ userId: t.answers.userId, total: sql<number>`count(*)`, correct: sql<number>`count(*) filter (where ${t.answers.correct})` })
    .from(t.answers)
    .innerJoin(t.lessons, eq(t.lessons.id, t.answers.lessonId))
    .where(and(eq(t.lessons.moduleId, moduleId), inArray(t.answers.userId, userIds), eq(t.answers.firstTry, true)))
    .groupBy(t.answers.userId);
  return new Map(rows.filter((r) => Number(r.total) > 0).map((r) => [r.userId, Math.round((100 * Number(r.correct)) / Number(r.total))]));
}

/* ───────── incidents ───────── */

export async function createIncident(
  db: DB,
  p: {
    tenantId: string;
    actorId: string;
    title: string;
    description?: string | null;
    severity: (typeof t.SEVERITY)[number];
    source: (typeof t.incidents.$inferInsert)["source"];
    confidential?: boolean;
    live?: boolean;
    iocs?: t.Ioc[];
    mitre?: string[];
    sandboxId?: string | null;
    reportId?: string | null;
    trainingModuleId?: string | null;
    minScore?: number | null;
    dueDate?: string | null;
    targetUserIds?: string[];
  },
): Promise<{ id: string; number: number }> {
  const { number, row } = await insertNumbered(db, t.incidents, p.tenantId, 20, async (number) => {
    const [inserted] = await db
      .insert(t.incidents)
      .values({
        tenantId: p.tenantId,
        number,
        title: p.title.slice(0, 300),
        description: p.description?.slice(0, 8000) ?? null,
        severity: p.severity,
        source: p.source,
        confidential: !!p.confidential,
        live: !!p.live,
        iocs: p.iocs ?? [],
        mitre: p.mitre ?? [],
        sandboxId: p.sandboxId ?? null,
        reportId: p.reportId ?? null,
        trainingModuleId: p.trainingModuleId ?? null,
        minScore: p.minScore ?? null,
        dueDate: p.dueDate ?? null,
        targetUserIds: p.targetUserIds ?? [],
        createdBy: p.actorId,
      })
      .returning({ id: t.incidents.id });
    return inserted;
  });
  if (p.sandboxId) await db.update(t.sandboxAnalyses).set({ incidentId: row.id }).where(and(eq(t.sandboxAnalyses.id, p.sandboxId), eq(t.sandboxAnalyses.tenantId, p.tenantId)));
  await audit(db, { tenantId: p.tenantId, actorId: p.actorId, action: "incident.created", targetType: "incident", targetId: row.id, meta: { number: `IR-${number}`, severity: p.severity } });
  // Confidential incidents never leave the platform with details.
  await emitEvent(db, p.tenantId, "incident.created", p.confidential ? { number: `IR-${number}`, severity: p.severity, confidential: true } : { number: `IR-${number}`, title: p.title, severity: p.severity, source: p.source, iocs: p.iocs ?? [], mitre: p.mitre ?? [] });
  return { id: row.id, number };
}

/** Assigns the incident's training module to its target people (the "auto-training" step). */
export async function assignIncidentTraining(db: DB, p: { tenantId: string; incidentId: string; actorId: string | null }): Promise<number> {
  const [inc] = await db.select().from(t.incidents).where(and(eq(t.incidents.id, p.incidentId), eq(t.incidents.tenantId, p.tenantId)));
  if (!inc || !inc.trainingModuleId || !inc.targetUserIds.length) return 0;
  // People added after the first run get the training; anyone who already had it (open or closed) is left alone.
  const had = new Set(
    (
      await db
        .select({ userId: t.behaviorRisks.userId })
        .from(t.behaviorRisks)
        .where(and(eq(t.behaviorRisks.tenantId, p.tenantId), eq(t.behaviorRisks.sourceRef, `IR-${inc.number}`), eq(t.behaviorRisks.moduleId, inc.trainingModuleId)))
    ).map((r) => r.userId),
  );
  const assigned = await targetTraining(db, {
    tenantId: p.tenantId,
    userIds: inc.targetUserIds.filter((u) => !had.has(u)),
    moduleId: inc.trainingModuleId,
    severity: inc.severity,
    kind: "incident",
    // Confidential incidents show a neutral title to the people being trained.
    title: inc.confidential ? `IR-${inc.number}` : `IR-${inc.number}: ${inc.title}`,
    sourceRef: `IR-${inc.number}`,
    dueDate: inc.dueDate && inc.dueDate >= todayInBaku() ? inc.dueDate : null,
  });
  await db.update(t.incidents).set({ autoTrainingAt: new Date() }).where(eq(t.incidents.id, inc.id));
  if (assigned.length) {
    // The loop opened from the report this incident came from counts the trained people and moves to "training".
    const linked = await db
      .update(t.loops)
      .set({ trainedCount: sql`${t.loops.trainedCount} + ${assigned.length}`, updatedAt: new Date() })
      .where(and(eq(t.loops.tenantId, p.tenantId), eq(t.loops.incidentId, inc.id)))
      .returning({ id: t.loops.id });
    for (const loop of linked) await advanceLoop(db, { tenantId: p.tenantId, loopId: loop.id, to: "training", actorId: p.actorId });
  }
  await audit(db, { tenantId: p.tenantId, actorId: p.actorId, action: "incident.auto_training", targetType: "incident", targetId: inc.id, meta: { number: `IR-${inc.number}`, count: assigned.length } });
  return assigned.length;
}
