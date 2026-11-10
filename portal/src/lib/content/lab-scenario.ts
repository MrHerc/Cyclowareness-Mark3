import { z } from "zod";

/**
 * A module's mini-lab: content/library/labs/<module-slug>.<locale>.json. A few "inbox moments" built from the
 * module's own lesson artifacts (an e-mail, a text message, a call, a file, a browser tab), each a decision with
 * one safe option. The English file is the source; a translation keeps every id, the safe choice, the risk tag,
 * every address and the array lengths, and changes only the text (src/lib/content/locale-parity.ts, the same rules
 * as lessons, so the keys that hold text are names from its TRANSLATABLE list).
 */

/** What a wrong choice in a decision puts at risk; labels in learner.lab.mini.risk. */
export const RISK_TAGS = ["credentials", "malware", "money", "data", "impersonation", "account", "device"] as const;

const text = z.string().trim().min(1);
const time = z.string().regex(/^\d{2}:\d{2}$/);
const paras = z.array(text).min(1);

const artifact = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("email"),
    from: z.object({ name: text, address: text }),
    subject: text,
    time,
    body: paras,
    /** The link sits after paragraph `after`; `href` is where it really goes. */
    link: z.object({ text, href: z.url(), after: z.number().int().min(0) }).optional(),
    attachment: z.object({ name: text, size: text }).optional(),
  }),
  /** A text or messenger message: `name` is the sender as the phone shows it. */
  z.object({ kind: z.literal("sms"), name: text, time, body: paras }),
  /** A phone call: who the screen says is calling and what the caller says. */
  z.object({ kind: z.literal("call"), name: text, number: text, body: paras }),
  /** A downloaded file: `text` says where it came from. */
  z.object({ kind: z.literal("file"), name: text, size: text, text }),
  /** A browser tab: a page with optional form fields and a button. */
  z.object({ kind: z.literal("web"), title: text, url: z.url(), body: z.array(text), fields: z.array(text).optional(), button: text.optional() }),
  /** A window or notification on the screen (a system prompt, a meeting app, a pop-up). */
  z.object({ kind: z.literal("dialog"), title: text, body: paras }),
]);

const decision = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** A short name for the moment, shown in the checklist and the debrief. */
  title: text,
  prompt: text,
  artifact,
  options: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), label: text })).min(2).max(4),
  /** The id of the safe option. */
  safe: z.string(),
  /** The debrief line: why the safe option is the right one. */
  explain: text,
  risk: z.enum(RISK_TAGS),
});

export const labScenarioSchema = z.object({
  formatVersion: z.literal(1),
  module: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  intro: text,
  decisions: z.array(decision).min(3).max(5),
});

export type LabScenario = z.infer<typeof labScenarioSchema>;
export type LabDecision = LabScenario["decisions"][number];
export type LabArtifact = LabDecision["artifact"];

/** Cross-reference checks the schema cannot express. */
export function labScenarioErrors(s: LabScenario): string[] {
  const errors: string[] = [];
  if (new Set(s.decisions.map((d) => d.id)).size !== s.decisions.length) errors.push("duplicate decision id");
  for (const d of s.decisions) {
    const ids = d.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) errors.push(`${d.id}: duplicate option id`);
    if (!ids.includes(d.safe)) errors.push(`${d.id}: safe option ${d.safe} missing`);
    const a = d.artifact;
    if (a.kind === "email" && a.link && a.link.after >= a.body.length) errors.push(`${d.id}: link after a missing paragraph`);
  }
  return errors;
}

/** A mini-lab's XP: 10 for three decisions, 15 for five. */
export function miniLabXp(s: LabScenario): number {
  return 10 + Math.round((s.decisions.length - 3) * 2.5);
}
