import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "./env";
import { TUTOR_LANGUAGE } from "./tutor";

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
- The draft is reviewed by a security analyst before anyone sees it.`;

/** Drafts a micro-lesson about a topic. Returns null when AI is not configured or the draft is unusable. */
export async function draftLesson(topic: string, locale: string): Promise<LessonDraft | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: `${SYSTEM}\nWrite everything in ${TUTOR_LANGUAGE[locale] ?? "English"}.`,
    tools: [LESSON_TOOL],
    tool_choice: { type: "tool", name: LESSON_TOOL.name },
    messages: [{ role: "user", content: `Topic from our security team:\n${topic.slice(0, 2000)}` }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const parsed = lessonDraftSchema.safeParse(block.input);
  if (!parsed.success || parsed.data.question.options.filter((o) => o.correct).length !== 1) return null;
  return parsed.data;
}
