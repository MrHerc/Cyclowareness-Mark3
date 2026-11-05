import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";
import { LOCALES } from "../src/i18n/config";

const root = path.join(__dirname, "..", "content", "library");
const modules = JSON.parse(readFileSync(path.join(root, "modules.json"), "utf8")) as { slug: string; lessons: { id: string }[] }[];

describe("content library", () => {
  it("has 53 modules and 106 lessons on disk", () => {
    expect(modules).toHaveLength(53);
    // English originals only; the translations next to them are checked in content-locales.test.ts.
    const files = modules.flatMap((m) => readdirSync(path.join(root, "lessons", m.slug)).filter((f) => f.endsWith(".en.json")));
    expect(files).toHaveLength(106);
  });

  for (const m of modules) {
    for (const l of m.lessons) {
      it(`${m.slug}/${l.id} is a valid lesson`, () => {
        const raw = JSON.parse(readFileSync(path.join(root, "lessons", m.slug, `${l.id}.en.json`), "utf8"));
        const parsed = lessonFileSchema.parse(raw);
        expect(lessonIntegrityErrors(parsed)).toEqual([]);
      });
    }
  }

  it("refuses a malformed tutor checkpoint and one without a correct option", () => {
    const lesson = (checkpoint: unknown, stage?: unknown) => ({
      id: "l",
      title: "L",
      minutes: 1,
      scenes: [{ type: "tutor", id: "t", beats: [{ id: "b", say: "Hi", mood: "talk", checkpoint, stage }] }],
    });
    const options = [
      { id: "a", label: "A", correct: false, feedback: "No" },
      { id: "b", label: "B", correct: true, feedback: "Yes" },
    ];
    expect(lessonFileSchema.safeParse(lesson({ prompt: "Q?" })).success).toBe(false);
    expect(lessonFileSchema.safeParse(lesson({ prompt: "Q?", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] })).success).toBe(false);
    expect(lessonFileSchema.safeParse(lesson({ prompt: "Q?", options }, 3)).success).toBe(false);
    expect(lessonIntegrityErrors(lessonFileSchema.parse(lesson({ prompt: "Q?", options }, "back")))).toEqual([]);
    const noneCorrect = lessonFileSchema.parse(lesson({ prompt: "Q?", options: options.map((o) => ({ ...o, correct: false })) }));
    expect(lessonIntegrityErrors(noneCorrect)).toEqual(["t/b: checkpoint without correct option"]);
  });

  it("has 14 multi-answer choice scenes (more than one correct option, or multi: true)", () => {
    const multi: string[] = [];
    for (const m of modules) {
      for (const l of m.lessons) {
        const lesson = lessonFileSchema.parse(JSON.parse(readFileSync(path.join(root, "lessons", m.slug, `${l.id}.en.json`), "utf8")));
        for (const s of lesson.scenes) {
          if (s.type === "choice" && (s.multi || s.question.options.filter((o) => o.correct).length > 1)) multi.push(`${m.slug}/${l.id}#${s.id}`);
        }
      }
    }
    expect(multi).toHaveLength(14);
    expect(multi).toContain("app-consent-phishing/consent-screen#ac1-choice");
  });

  it.each(LOCALES.filter((l) => l !== "en"))("has %s titles for every module and lesson", (locale) => {
    const t = JSON.parse(readFileSync(path.join(root, `i18n.${locale}.json`), "utf8"));
    for (const m of modules) {
      expect(t.modules[m.slug], m.slug).toHaveLength(2);
      for (const l of m.lessons) expect(t.lessons[`${m.slug}/${l.id}`], `${m.slug}/${l.id}`).toBeTruthy();
    }
  });
});
