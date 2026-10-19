import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";

const root = path.join(__dirname, "..", "content", "library");
const modules = JSON.parse(readFileSync(path.join(root, "modules.json"), "utf8")) as { slug: string; lessons: { id: string }[] }[];
const i18n = ["az", "ru"].map((l) => JSON.parse(readFileSync(path.join(root, `i18n.${l}.json`), "utf8")));

describe("content library", () => {
  it("has 53 modules and 106 lessons on disk", () => {
    expect(modules).toHaveLength(53);
    const files = modules.flatMap((m) => readdirSync(path.join(root, "lessons", m.slug)));
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

  it("has az and ru titles for every module and lesson", () => {
    for (const t of i18n) {
      for (const m of modules) {
        expect(t.modules[m.slug], m.slug).toHaveLength(2);
        for (const l of m.lessons) expect(t.lessons[`${m.slug}/${l.id}`], `${m.slug}/${l.id}`).toBeTruthy();
      }
    }
  });
});
