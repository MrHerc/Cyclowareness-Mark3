import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { awardXp } from "../services/progress";
import { dayKey } from "../../lib/domain/gamification";

/**
 * Stores one lab run (a lab game or a virtual-machine lab) and awards the lab's XP, scaled by the score,
 * on the first run of the day in Baku. Returns the XP awarded. The person's row is locked before the
 * count, so parallel runs are counted one after another and only one of them earns the day's XP.
 */
export async function recordLabAttempt(
  db: DB,
  p: { tenantId: string; userId: string; exercise: string; score: number; max: number; fullXp: number },
): Promise<number> {
  const today = dayKey(new Date());
  return db.transaction(async (tx) => {
    await tx.select({ id: t.users.id }).from(t.users).where(eq(t.users.id, p.userId)).for("update");
    const [{ n }] = await tx
      .select({ n: count() })
      .from(t.labAttempts)
      .where(and(eq(t.labAttempts.userId, p.userId), eq(t.labAttempts.exercise, p.exercise), gte(t.labAttempts.at, new Date(Date.now() - 2 * 86_400_000)), sql`to_char(${t.labAttempts.at} at time zone 'Asia/Baku', 'YYYY-MM-DD') = ${today}`));
    const xp = Number(n) === 0 ? Math.round((p.fullXp * p.score) / p.max) : 0;
    await tx.insert(t.labAttempts).values({ tenantId: p.tenantId, userId: p.userId, exercise: p.exercise, score: p.score, max: p.max, xp });
    if (xp > 0) await awardXp(tx, { tenantId: p.tenantId, userId: p.userId, amount: xp, reason: "lab", ref: p.exercise });
    return xp;
  });
}
