import { plain, type ChatArtifact, type Scene } from "../content/types";
import { speechText } from "./text";

/** Interface strings the player reads inside a lesson, in the lesson's language (messages: player.multiHint, player.hotspot.done). */
export type SpokenUi = { multiHint?: string; hotspotDone?: string };

type Choice = Extract<Scene, { type: "choice" }>;
type Option = Choice["question"]["options"][number];

/** Choose-all questions with more options than this get single picks only (every pick would be 2^n texts). */
const MAX_ENUMERATED_OPTIONS = 8;

/**
 * Every text ChoiceScene's feedback can speak: the explained options' feedback, then `explain`, joined
 * by a space. Which options are explained depends on the pick, so every pick the learner can check is
 * listed, and the time-up text (only `explain`).
 */
function choiceFeedback(s: Choice): string[] {
  const opts = s.question.options;
  const correct = opts.filter((o) => o.correct);
  const multi = !!s.multi || correct.length > 1;
  const said = (explained: Option[]) => [...explained.map((o) => o.feedback), s.explain].filter(Boolean).join(" ");
  const picks: Option[][] =
    multi && opts.length <= MAX_ENUMERATED_OPTIONS ? Array.from({ length: 2 ** opts.length - 1 }, (_, m) => opts.filter((_, i) => ((m + 1) >> i) & 1)) : opts.map((o) => [o]);
  return [
    said([]),
    ...picks.map((picked) => {
      const ok = picked.length === correct.length && picked.every((o) => o.correct);
      const missed = correct.filter((o) => !picked.includes(o));
      const extra = picked.filter((o) => !o.correct);
      return said(ok ? picked : multi ? [...missed, ...extra] : extra);
    }),
  ];
}

/**
 * Every string the lesson player passes to speak() when the lesson is read in the interface's own
 * language, as speechText, without repeats, in lesson order. Mirrors the speak() calls in
 * src/components/player/scenes.tsx (FeedbackCard and FeedbackSheet included): keep the two in step.
 */
export function spokenTexts(scenes: readonly Scene[], ui: SpokenUi = {}): string[] {
  const raw = scenes.flatMap((s): (string | undefined)[] => {
    switch (s.type) {
      case "tutor":
        return s.beats.flatMap((b) => {
          const checkpoint = b.checkpoint as { prompt?: string; options?: { feedback?: string }[] } | undefined;
          return [b.say, checkpoint?.prompt, ...(checkpoint?.options ?? []).map((o) => o.feedback)];
        });
      case "intro":
        return [`${s.title}. ${s.body}`];
      case "simulation":
        return [
          s.intro,
          ...s.steps.flatMap((step) => [
            step.spoken ?? step.say,
            // The tip's replay button reads `say` even when the step narrates `spoken`.
            step.say,
            ...(step.artifact.kind === "chat" ? ((step.artifact as ChatArtifact).messages ?? []).filter((m) => m.voice).map((m) => m.spoken ?? plain(m.body)) : []),
            ...step.actions.map((a) => a.feedback),
          ]),
        ];
      case "choice": {
        const multi = !!s.multi || s.question.options.filter((o) => o.correct).length > 1;
        // A choose-all prompt is read with the hint in one utterance; alone when the interface is in another language.
        return [s.question.prompt, multi && ui.multiHint ? `${s.question.prompt} ${ui.multiHint}.` : undefined, ...choiceFeedback(s)];
      }
      case "hotspot":
        return [s.prompt, ...s.spots.map((spot) => spot.explain), ui.hotspotDone];
      case "swipe":
        return [s.prompt, ...s.cards.map((card) => card.explain)];
      case "match":
      case "order":
        return [s.prompt, s.explain];
      case "scenario":
        return s.nodes.flatMap((node) => [node.spoken ?? node.text, ...(node.choices ?? []).map((c) => c.feedback)]);
      case "password":
        return [s.prompt];
      case "recap":
        return [s.points.join(". ")];
      default:
        return [];
    }
  });
  return [...new Set(raw.map((t) => (t ? speechText(t) : "")).filter(Boolean))];
}
