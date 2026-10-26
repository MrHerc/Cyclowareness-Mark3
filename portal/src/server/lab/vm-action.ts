"use server";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";
import { awardXp } from "../services/progress";
import { rateLimit } from "../rate-limit";
import { dayKey } from "../../lib/domain/gamification";
import { MAX_ARG, MAX_EVENTS, VM_LABS, isVmLab, scoreEvents, type LabEvent } from "../../components/lab/model/labs";

export type VmLabResult = { score: number; max: number; xp: number } | { error: "forbidden" | "invalid" | "rateLimited" };

const events = z.array(z.union([z.tuple([z.string().max(24)]), z.tuple([z.string().max(24), z.string().max(MAX_ARG)])])).max(MAX_EVENTS);

/**
 * Stores a finished virtual-machine lab the same way as the lab games (playLabAction): one lab_attempts row
 * per run and the lab's XP, scaled by the score, on the first run of the day in Baku. The browser sends the
 * learner's actions, not a score: the server replays them through the lab's own state machine.
 */
export async function completeVmLabAction(lab: string, log: unknown): Promise<VmLabResult> {
  const v = await actionViewer();
  if (!v.tenant.features.has("lab") || !isVmLab(lab)) return { error: "forbidden" };
  const parsed = events.safeParse(log);
  if (!parsed.success) return { error: "invalid" };
  if (!(await rateLimit(`lab:${v.user.id}`, 60, 10 * 60_000)).ok) return { error: "rateLimited" };
  const { score, max } = scoreEvents(lab, parsed.data as LabEvent[]);
  const today = dayKey(new Date());
  const [{ n }] = await db()
    .select({ n: count() })
    .from(t.labAttempts)
    .where(and(eq(t.labAttempts.userId, v.user.id), eq(t.labAttempts.exercise, lab), gte(t.labAttempts.at, new Date(Date.now() - 2 * 86_400_000)), sql`to_char(${t.labAttempts.at} at time zone 'Asia/Baku', 'YYYY-MM-DD') = ${today}`));
  const xp = Number(n) === 0 ? Math.round((VM_LABS[lab].xp * score) / max) : 0;
  await db().insert(t.labAttempts).values({ tenantId: v.tenant.id, userId: v.user.id, exercise: lab, score, max, xp });
  if (xp > 0) await awardXp(db(), { tenantId: v.tenant.id, userId: v.user.id, amount: xp, reason: "lab", ref: lab });
  refresh();
  return { score, max, xp };
}
