"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { actionViewer } from "../auth/viewer";
import { rateLimit } from "../rate-limit";
import { recordLabAttempt } from "./attempts";
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
  const xp = await recordLabAttempt(db(), { tenantId: v.tenant.id, userId: v.user.id, exercise: lab, score, max, fullXp: VM_LABS[lab].xp });
  refresh();
  return { score, max, xp };
}
