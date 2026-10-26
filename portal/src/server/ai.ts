import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "./env";
import { TUTOR_LANGUAGE, languageStyle } from "./tutor";
import { ILLUSTRATION_IDS, type Issue, type TrainingDraft, type TrainingModel, type TrainingRequest } from "./ai-verify";

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

export const lessonDraftSchema = z.object({
  title: z.string().min(3).max(120),
  subtitle: z.string().max(200),
  intro: z.string().min(10).max(1200),
  points: z.array(z.string().min(5).max(400)).min(2).max(8),
  question: z.object({
    prompt: z.string().min(5).max(400),
    options: z
      .array(z.object({ label: z.string().min(1).max(200), correct: z.boolean(), feedback: z.string().min(1).max(400) }))
      .min(2)
      .max(4),
  }),
  recap: z.array(z.string().min(3).max(300)).min(2).max(5),
});
export type LessonDraft = z.infer<typeof lessonDraftSchema>;

const LESSON_TOOL = {
  name: "save_lesson_draft",
  description: "Saves a short security awareness micro-lesson draft for human review.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Short lesson title, at most 8 words" },
      subtitle: { type: "string", description: "One sentence on what the learner will be able to do" },
      intro: { type: "string", description: "Two or three sentences that open the lesson with the real situation" },
      points: { type: "array", items: { type: "string" }, description: "3 to 6 steps the tutor says aloud, each one or two plain sentences" },
      question: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, correct: { type: "boolean" }, feedback: { type: "string", description: "Why this answer is right or wrong" } },
              required: ["label", "correct", "feedback"],
            },
            description: "3 answers, exactly one correct",
          },
        },
        required: ["prompt", "options"],
      },
      recap: { type: "array", items: { type: "string" }, description: "3 short takeaways" },
    },
    required: ["title", "subtitle", "intro", "points", "question", "recap"],
  },
};

const SYSTEM = `You write short security awareness micro-lessons for employees of a company.
Rules:
- Plain, calm language for non-technical adults. No fear, no blame, no jargon without explanation.
- Concrete actions the employee can take today (check, refuse, report through the official channel).
- Never include real personal data, real phone numbers, live malicious links or working attack instructions. Use defanged examples like example[.]com.
- Exactly one answer of the question is correct; the wrong answers are realistic mistakes.
- The draft is reviewed by a security analyst before anyone sees it.
- Answer only by calling the save_lesson_draft tool once.`;

/** Drafts a micro-lesson about a topic. Returns null when AI is not configured or the draft is unusable. */
export async function draftLesson(topic: string, locale: string): Promise<LessonDraft | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: `${SYSTEM}\nWrite everything in ${TUTOR_LANGUAGE[locale] ?? "English"}. ${languageStyle(locale)}`,
    tools: [LESSON_TOOL],
    // Forced tool_choice is rejected by current models (thinking is always on); the system prompt asks for the tool.
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: `Topic from our security team:\n${topic.slice(0, 2000)}` }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const parsed = lessonDraftSchema.safeParse(block.input);
  if (!parsed.success || parsed.data.question.options.filter((o) => o.correct).length !== 1) return null;
  return parsed.data;
}

/* ───────── full trainings (Studio "Create a training with AI") ───────── */

const TRAINING_TOOL = {
  name: "save_training",
  description: "Saves a complete security awareness training (1 to 3 lessons in the portal's lesson format) for automatic verification and human review.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Training title, at most 8 words" },
      subtitle: { type: "string", description: "One sentence on what the learner will be able to do afterwards" },
      lessons: {
        type: "array",
        description: "The lessons, in order",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "kebab-case, e.g. lesson-1" },
            title: { type: "string" },
            minutes: { type: "integer" },
            scenes: { type: "array", items: { type: "object" }, description: "Scenes in the lesson format from the system prompt" },
          },
          required: ["id", "title", "minutes", "scenes"],
        },
      },
    },
    required: ["title", "subtitle", "lessons"],
  },
};

const TRAINING_FORMAT = `Lesson format (JSON). Each lesson: {"id","title","minutes","scenes":[...]}. Every scene and beat has a unique kebab-case "id".
Scene types you may use:
- {"type":"intro","id","title","body","mood"}  (opening, 1-3 sentences)
- {"type":"tutor","id","beats":[{"id","say","mood","gesture","visual"}]}  the tutor (a friendly cat called AI Sel) speaks each beat aloud; 3-6 beats, one or two plain sentences each.
  mood: talk | think | alert | happy | celebrate. gesture (optional): wave | point-left | point-right | point-down | recite | lean-in | shield-up | shake | shrug | nod.
  visual (optional): {"kind":"illustration","id":ILLUSTRATION} or {"kind":"stat","value":"<short value>","label":"..."} or {"kind":"artifact","artifact":ARTIFACT}.
- {"type":"choice","id","question":{"prompt","options":[{"id","label","correct":true|false,"feedback"}]},"explain"}  3-4 options. Exactly one correct, unless you set "multi":true (then at least two correct and at least one wrong).
- {"type":"swipe","id","prompt","cards":[{"id","artifact":ARTIFACT,"verdict":"threat"|"safe","explain"}]}  3-5 cards, at least one threat and one safe.
- {"type":"order","id","prompt","items":[{"id","label"}],"explain"}  4-6 steps listed in the CORRECT order (the player shuffles them).
- {"type":"match","id","prompt","pairs":[{"id","left","right"}],"explain"}  3-5 pairs.
- {"type":"hotspot","id","prompt","artifact":ARTIFACT,"spots":[{"id","label","explain"}],"minToFind":N}  each spot id MUST be marked inside the artifact text as a span {"text":"...","spot":"<spot id>"}; minToFind is at most the number of spots.
- {"type":"recap","id","points":["..."],"mood":"celebrate"}  3-5 takeaways; every lesson ends with a recap.
ILLUSTRATION is one of: ${ILLUSTRATION_IDS.join(", ")}.
ARTIFACT (what the learner sees). RICH text is a string, an array of spans [{"text":"..."},{"text":"...","spot":"id"}], or an array of paragraphs (arrays of spans):
- {"kind":"email","from":{"name":RICH,"address":RICH},"subject":RICH,"time":"09:10","body":[[spans],[spans]]}
- {"kind":"sms","sender":RICH,"time":"10:02","messages":[RICH]}
- {"kind":"chat","app":"chat","contact":RICH,"messages":[{"from":"them"|"me","body":RICH}]}
- {"kind":"url","url":RICH}   {"kind":"login","brand":"...","url":RICH,"fields":["<field label>","<field label>"],"button":"<button label>"}
- {"kind":"notification","app":"...","title":RICH,"body":RICH}   {"kind":"dialog","tone":"warning","title":RICH,"body":RICH,"buttons":["..."]}
- {"kind":"file","name":RICH,"size":"<file size>","type":"pdf"}   {"kind":"call","caller":RICH,"label":"<caller label>"}
A good lesson: intro, tutor, an interactive check (choice, swipe, order, match or hotspot), a short tutor, another check, recap.`;

const TRAINING_SYSTEM = `You are an instructional designer writing security awareness trainings for employees of a company.
Rules:
- Plain, calm language for non-technical adults. No fear, no blame, no jargon without a short explanation.
- Concrete actions the employee can take today (check, refuse, report through the official channel).
- Fictional people, companies and brands only. Domains and email addresses ONLY under .example or .test (for example pay-portal.example, it@company.example). No real URLs or brands, no phone numbers (write "the number you know" instead), no personal data, no working attack instructions, no profanity.
- Facts must be correct and current. Do not invent statistics.
- Use only the scene types, moods, gestures, illustration ids and artifact kinds listed below.
- Answer only by calling the save_training tool once.

${TRAINING_FORMAT}`;

function trainingClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

function trainingBrief(req: TrainingRequest): string {
  return [
    `Write a training in ${TUTOR_LANGUAGE[req.locale] ?? "English"} (every text the learner sees, including artifacts).`,
    `Every label inside artifacts (login fields, buttons, file names and sizes, call labels, stat values) must also be in ${TUTOR_LANGUAGE[req.locale] ?? "English"}.`,
    languageStyle(req.locale),
    `Category: ${req.category}. Difficulty: ${req.difficulty}. About ${req.minutes} minutes in total, split over ${req.lessons} lesson(s).`,
    "What the training should teach, the audience and the tone, from our security team:",
    req.prompt.slice(0, 4000),
  ].join("\n");
}

/** One generation call. Returns the tool input (not yet verified) or null when the model did not call the tool. */
export async function generateTraining(req: TrainingRequest, feedback?: string[]): Promise<unknown> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const content = feedback?.length
    ? `${trainingBrief(req)}\n\nA previous attempt failed automatic verification. Write the whole training again and fix these problems:\n${feedback
        .slice(0, 30)
        .map((f) => `- ${f}`)
        .join("\n")}`
    : trainingBrief(req);
  // Streamed: a three-lesson training is long, and a non-streaming request with this max_tokens would time out.
  // No forced tool_choice: it is rejected while thinking is on; the system prompt asks for the tool instead.
  const stream = trainingClient().messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 32000,
    system: TRAINING_SYSTEM,
    tools: [TRAINING_TOOL],
    tool_choice: { type: "auto" },
    output_config: { effort: "medium" },
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "max_tokens") return null;
  const block = message.content.find((b) => b.type === "tool_use");
  return block && block.type === "tool_use" ? block.input : null;
}

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["blocking", "minor"] },
          message: { type: "string" },
          where: { type: "string" },
        },
        required: ["severity", "message", "where"],
        additionalProperties: false,
      },
    },
  },
  required: ["issues"],
  additionalProperties: false,
};

const reviewSchema = z.object({
  issues: z
    .array(z.object({ severity: z.enum(["blocking", "minor"]), message: z.string().min(1).max(600), where: z.string().max(200).optional() }))
    .max(40),
});

const REVIEW_SYSTEM = `You are a senior security awareness reviewer. You check a generated training before a human publishes it.
Report problems as issues. "blocking": a factual error or outdated or unsafe advice, a question whose marked correct answer is wrong or debatable, content that does not teach what the brief asked, text in the wrong language, real brands, people or URLs, anything harmful or offensive. "minor": unclear wording for non-technical staff, jargon, weak feedback text, tone.
"where" is "<lesson id>/<scene id>" (for example "lesson-1/check"), or empty when the issue is about the whole training. Messages are short and specific. Return an empty list when the training is good.`;

/**
 * The AI reviewer pass (verification step 3), with a structured JSON output. The messages are shown to
 * the Studio user as they are, so they are written in that person's interface language.
 */
export async function reviewTraining(req: TrainingRequest, draft: TrainingDraft, uiLocale = "en"): Promise<Issue[]> {
  const res = await trainingClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 8000,
    system: `${REVIEW_SYSTEM}\nWrite every message in ${TUTOR_LANGUAGE[uiLocale] ?? "English"}, whatever the language of the training. ${languageStyle(uiLocale)}`,
    output_config: { effort: "medium", format: { type: "json_schema", schema: REVIEW_SCHEMA } },
    messages: [{ role: "user", content: `Brief:\n${trainingBrief(req)}\n\nTraining JSON:\n${JSON.stringify(draft)}` }],
  });
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("review: no output");
  const parsed = reviewSchema.safeParse(JSON.parse(text.text));
  if (!parsed.success) throw new Error("review: bad output");
  return parsed.data.issues.map((i) => ({ severity: i.severity, message: i.message, where: i.where || undefined }));
}

/** The Anthropic-backed model client for the verification pipeline; the reviewer writes in `uiLocale`. */
export function anthropicTrainingModel(uiLocale = "en"): TrainingModel {
  return { generate: generateTraining, review: (req, draft) => reviewTraining(req, draft, uiLocale) };
}
