"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { actionViewer, privileged } from "../auth/viewer";
import { getCatalog } from "../queries/catalog";
import { rateLimit } from "../rate-limit";
import { recordLabAttempt } from "./attempts";
import { labScenario } from "./scenarios";
import { miniLabXp } from "../../lib/content/lab-scenario";
import { MAX_ARG, MAX_EVENTS, VM_LABS, isVmLab, miniLabDef, miniLabSlug, replay, scoreEvents, scoreRun, type LabEvent, type LabScore } from "../../components/lab/model/labs";

export type VmLabResult = { score: number; max: number; xp: number } | { error: "forbidden" | "invalid" | "rateLimited" };

const events = z.array(z.union([z.tuple([z.string().max(24)]), z.tuple([z.string().max(24), z.string().max(MAX_ARG)])])).max(MAX_EVENTS);

/**
 * Stores a finished virtual-machine lab the same way as the lab games (playLabAction): one lab_attempts row
 * per run and the lab's XP, scaled by the score, on the first run of the organisation's day. The browser sends the
 * learner's actions, not a score: the server replays them through the lab's own state machine. A module's mini-lab
 * ("mini:<slug>") is replayed against its English scenario file, so only the chosen option ids come from the browser.
 */
export async function completeVmLabAction(lab: string, log: unknown): Promise<VmLabResult> {
  const v = await actionViewer();
  const slug = typeof lab === "string" ? miniLabSlug(lab) : null;
  const mini = slug === null ? null : (labScenario(slug)?.scenario ?? null);
  if (!v.tenant.features.has("lab") || !(mini || isVmLab(lab))) return { error: "forbidden" };
  // A mini-lab counts only for a module in the viewer's catalog, as the page checks.
  if (mini && !(await getCatalog(v, "en", privileged(v, "studio.write"))).some((m) => m.slug === slug)) return { error: "forbidden" };
  const parsed = events.safeParse(log);
  if (!parsed.success) return { error: "invalid" };
  if (!(await rateLimit(`lab:${v.user.id}`, 60, 10 * 60_000)).ok) return { error: "rateLimited" };
  const actions = parsed.data as LabEvent[];
  let result: LabScore;
  let fullXp: number;
  if (mini) {
    const def = miniLabDef(mini);
    result = scoreRun(def, replay(def, actions));
    fullXp = miniLabXp(mini);
  } else {
    if (!isVmLab(lab)) return { error: "forbidden" };
    result = scoreEvents(lab, actions);
    fullXp = VM_LABS[lab].xp;
  }
  const { score, max } = result;
  const xp = await recordLabAttempt(db(), { tenantId: v.tenant.id, userId: v.user.id, exercise: lab, score, max, fullXp });
  refresh();
  return { score, max, xp };
}
