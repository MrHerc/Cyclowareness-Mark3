import { z } from "zod";

/** Structural validation for lesson files (run at seed time and in tests). */

const artifact = z.object({ kind: z.enum(["email", "chat", "sms", "dialog", "login", "url", "notification", "permission", "call", "file", "qr", "wifi"]) }).passthrough();
const visual = z.union([
  z.object({ kind: z.literal("illustration"), id: z.string() }),
  z.object({ kind: z.literal("artifact"), artifact }),
  z.object({ kind: z.literal("stat"), value: z.string(), label: z.string() }),
]);
const outcome = z.enum(["safe", "risky", "compromised"]);
const option = z.object({ id: z.string(), label: z.string(), correct: z.boolean(), feedback: z.string() });
// The player dereferences a checkpoint's options, so a malformed one must fail here, not for every learner.
export const checkpointSchema = z.object({ prompt: z.string(), options: z.array(option).min(2) });

const scene = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tutor"),
    id: z.string(),
    beats: z.array(z.object({ id: z.string(), say: z.string().min(1), mood: z.string(), gesture: z.string().optional(), visual: visual.optional(), highlight: z.string().optional(), checkpoint: checkpointSchema.optional(), stage: z.string().optional() }).passthrough()).min(1),
  }),
  z.object({ type: z.literal("intro"), id: z.string(), title: z.string(), body: z.string() }).passthrough(),
  z.object({
    type: z.literal("simulation"),
    id: z.string(),
    environment: z.enum(["inbox", "phone", "browser", "desktop", "call"]),
    title: z.string(),
    intro: z.string(),
    steps: z.array(
      z.object({
        id: z.string(),
        artifact,
        actions: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string(), outcome, feedback: z.string(), next: z.string().optional() })).min(1),
      }).passthrough(),
    ).min(1),
  }),
  z.object({
    type: z.literal("choice"),
    id: z.string(),
    question: z.object({ prompt: z.string(), options: z.array(option).min(2) }),
    multi: z.boolean().optional(),
    visual: visual.optional(),
  }).passthrough(),
  z.object({ type: z.literal("hotspot"), id: z.string(), prompt: z.string(), artifact, spots: z.array(z.object({ id: z.string(), label: z.string(), explain: z.string() })).min(1), minToFind: z.number().int().min(1) }),
  z.object({ type: z.literal("swipe"), id: z.string(), prompt: z.string(), cards: z.array(z.object({ id: z.string(), artifact, verdict: z.enum(["threat", "safe"]), explain: z.string() })).min(1) }),
  z.object({ type: z.literal("match"), id: z.string(), prompt: z.string(), pairs: z.array(z.object({ id: z.string(), left: z.string(), right: z.string() })).min(2) }).passthrough(),
  z.object({ type: z.literal("order"), id: z.string(), prompt: z.string(), items: z.array(z.object({ id: z.string(), label: z.string() })).min(2) }).passthrough(),
  z.object({
    type: z.literal("scenario"),
    id: z.string(),
    title: z.string(),
    start: z.string(),
    nodes: z.array(z.object({ id: z.string(), text: z.string(), choices: z.array(z.object({ label: z.string(), next: z.string().optional(), outcome: outcome.optional(), feedback: z.string() })).optional() }).passthrough()).min(1),
  }),
  z.object({ type: z.literal("password"), id: z.string(), prompt: z.string(), targetScore: z.number().int().min(0).max(4), tips: z.array(z.string()) }),
  z.object({ type: z.literal("recap"), id: z.string(), points: z.array(z.string()).min(1) }).passthrough(),
]);

export const lessonFileSchema = z.object({
  id: z.string(),
  title: z.string(),
  minutes: z.number().int().positive(),
  scenes: z.array(scene).min(1),
});

/** Cross-reference checks the type system can't express. */
export function lessonIntegrityErrors(lesson: z.infer<typeof lessonFileSchema>): string[] {
  const errors: string[] = [];
  for (const s of lesson.scenes) {
    if (s.type === "scenario") {
      const ids = new Set(s.nodes.map((n) => n.id));
      if (!ids.has(s.start)) errors.push(`${s.id}: start node ${s.start} missing`);
      for (const n of s.nodes) for (const c of n.choices ?? []) if (c.next && !ids.has(c.next)) errors.push(`${s.id}/${n.id}: next ${c.next} missing`);
    }
    if (s.type === "simulation") {
      const ids = new Set(s.steps.map((st) => st.id));
      for (const st of s.steps) for (const a of st.actions) if (a.next && !ids.has(a.next)) errors.push(`${s.id}/${st.id}: next ${a.next} missing`);
    }
    if (s.type === "tutor") for (const b of s.beats) if (b.checkpoint && !b.checkpoint.options.some((o) => o.correct)) errors.push(`${s.id}/${b.id}: checkpoint without correct option`);
    if (s.type === "choice" && !s.question.options.some((o) => o.correct)) errors.push(`${s.id}: no correct option`);
    if (s.type === "hotspot" && s.minToFind > s.spots.length) errors.push(`${s.id}: minToFind > spots`);
  }
  return errors;
}
