import type { LessonDraft } from "@/server/ai";
import { plain, type EmailArtifact, type Scene, type SmsArtifact, type Span } from "./types";

/**
 * The scenes of a Studio lesson and back. Scene ids are fixed (intro, steps, swipe, hotspot, check, recap) and
 * item ids follow their position, so an edited lesson keeps the ids its answers and progress rows point to.
 */

const MOODS = ["talk", "think", "alert", "talk", "happy", "talk", "think", "talk"] as const;

/**
 * The body's paragraphs as spans, each target marked (`s1`, `s2`, …) where its text first appears within one line,
 * without overlapping another. Null when a target cannot be placed so; the Studio form checks with it too.
 */
export function markTargets(body: string, targets: readonly { text: string }[]): Span[][] | null {
  const placed = new Set<number>();
  const paragraphs = body
    .split(/\r?\n/)
    .filter((p) => p.trim())
    .map((p) => {
      const spans: Span[] = [];
      let rest = p;
      for (;;) {
        let at = -1;
        let i = -1;
        for (let j = 0; j < targets.length; j++) {
          const found = placed.has(j) ? -1 : rest.indexOf(targets[j].text);
          if (found >= 0 && (at < 0 || found < at)) [at, i] = [found, j];
        }
        if (at < 0) break;
        if (at) spans.push({ text: rest.slice(0, at) });
        spans.push({ text: targets[i].text, spot: `s${i + 1}` });
        placed.add(i);
        rest = rest.slice(at + targets[i].text.length);
      }
      if (rest) spans.push({ text: rest });
      return spans;
    });
  return placed.size === targets.length ? paragraphs : null;
}

/** Null when the draft breaks a rule its schema cannot state: one correct answer, a threat among the cards, every target in the e-mail. */
export function studioScenes(d: LessonDraft): Scene[] | null {
  if (d.question.options.filter((o) => o.correct).length !== 1) return null;
  if (d.swipe && !d.swipe.cards.some((c) => c.verdict === "threat")) return null;
  const body = d.hotspot ? markTargets(d.hotspot.body, d.hotspot.targets) : null;
  if (d.hotspot && !body) return null;
  return [
    { type: "intro", id: "intro", title: d.title, body: d.intro, mood: "talk" },
    { type: "tutor", id: "steps", beats: d.points.map((say, i) => ({ id: `b${i + 1}`, say, mood: MOODS[i % MOODS.length] })) },
    ...(d.swipe
      ? [
          {
            type: "swipe" as const,
            id: "swipe",
            prompt: d.swipe.prompt,
            cards: d.swipe.cards.map((c, i) => ({ id: `c${i + 1}`, artifact: { kind: "sms" as const, sender: [{ text: c.from }], messages: [[{ text: c.text }]] }, verdict: c.verdict, explain: c.explain })),
          },
        ]
      : []),
    ...(d.hotspot && body
      ? [
          {
            type: "hotspot" as const,
            id: "hotspot",
            prompt: d.hotspot.prompt,
            artifact: { kind: "email" as const, from: { address: d.hotspot.from }, subject: d.hotspot.subject, body },
            spots: d.hotspot.targets.map((t, i) => ({ id: `s${i + 1}`, label: t.label, explain: t.explain })),
            minToFind: d.hotspot.targets.length,
          },
        ]
      : []),
    { type: "choice", id: "check", question: { prompt: d.question.prompt, options: d.question.options.map((o, i) => ({ id: `o${i + 1}`, label: o.label, correct: o.correct, feedback: o.feedback })) } },
    { type: "recap", id: "recap", points: d.recap, mood: "celebrate" },
  ];
}

/** Equal as JSON, whatever the key order (jsonb reorders keys) and with undefined fields left out. */
export const sameJson = (a: unknown, b: unknown) => {
  const canon = (x: unknown) => JSON.stringify(x, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([k], [l]) => (k < l ? -1 : 1))) : v));
  return canon(a) === canon(b);
};

/**
 * The draft a Studio lesson was built from, to edit it again; null for any other lesson (an AI training, the library),
 * including one that only shares the ids: its scenes must rebuild exactly, or saving the form would drop what it cannot show.
 */
export function studioDraft(scenes: readonly Scene[], subtitle: string): LessonDraft | null {
  const by = new Map(scenes.map((s) => [s.id, s]));
  const [intro, steps, swipe, hotspot, check, recap] = ["intro", "steps", "swipe", "hotspot", "check", "recap"].map((id) => by.get(id));
  if (intro?.type !== "intro" || steps?.type !== "tutor" || check?.type !== "choice" || recap?.type !== "recap") return null;
  const mail = hotspot?.type === "hotspot" ? (hotspot.artifact as EmailArtifact) : null;
  const spans = mail && Array.isArray(mail.body) ? (mail.body as Span[][]).flat() : [];
  const draft: LessonDraft = {
    title: intro.title,
    subtitle,
    intro: intro.body,
    points: steps.beats.map((b) => b.say),
    question: { prompt: check.question.prompt, options: check.question.options.map((o) => ({ label: o.label, correct: o.correct, feedback: o.feedback })) },
    recap: recap.points,
    ...(swipe?.type === "swipe"
      ? { swipe: { prompt: swipe.prompt, cards: swipe.cards.map((c) => ({ from: plain((c.artifact as SmsArtifact).sender), text: plain((c.artifact as SmsArtifact).messages?.[0]), verdict: c.verdict, explain: c.explain })) } }
      : {}),
    ...(hotspot?.type === "hotspot" && mail
      ? {
          hotspot: {
            prompt: hotspot.prompt,
            from: plain(mail.from?.address),
            subject: plain(mail.subject),
            body: plain(mail.body),
            targets: hotspot.spots.map((s) => ({ text: spans.find((x) => x.spot === s.id)?.text ?? "", label: s.label, explain: s.explain })),
          },
        }
      : {}),
  };
  return sameJson(studioScenes(draft), scenes) ? draft : null;
}
