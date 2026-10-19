"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, t } from "../db";
import { actionViewer } from "../auth/viewer";

const prefsSchema = z
  .object({
    soundOn: z.boolean(),
    motion: z.enum(["full", "calm", "still"]),
    timerPref: z.enum(["standard", "more", "off"]),
    tourDone: z.boolean(),
  })
  .partial();

/** Learner preferences (sound, motion, question timer, onboarding tour). */
export async function setPreferencesAction(input: z.infer<typeof prefsSchema>): Promise<{ ok: boolean }> {
  const v = await actionViewer();
  const p = prefsSchema.safeParse(input);
  if (!p.success || !Object.keys(p.data).length) return { ok: false };
  await db().update(t.users).set(p.data).where(eq(t.users.id, v.user.id));
  if (p.data.motion) refresh();
  return { ok: true };
}
