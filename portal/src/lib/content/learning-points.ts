/** A "What you will learn" line, with the language of its text when that comes from another stored locale. */
export type LearningPoint = { text: string; lang?: string };

/**
 * "What you will learn" on a module page, without AI: the lessons' recap points taken in turns (every lesson's
 * first point, then every lesson's second…), so each lesson is represented, without repeats, at most `max`.
 * Lessons without a recap (a studio lesson) top the list up with their titles, up to three lines.
 * `points` is the recap points of the lesson's chosen text (pickLessonContent); anything but strings is ignored.
 */
export function learningPoints(lessons: readonly { title: string; points?: unknown; lang?: string }[], max = 5): LearningPoint[] {
  const out: LearningPoint[] = [];
  const add = (text: unknown, lang?: string) => {
    const v = typeof text === "string" ? text.trim() : "";
    if (v && out.length < max && !out.some((p) => p.text === v)) out.push({ text: v, lang });
  };
  const recaps = lessons.map((l) => (Array.isArray(l.points) ? l.points : []));
  const rounds = Math.max(0, ...recaps.map((r) => r.length));
  for (let i = 0; i < rounds; i++) recaps.forEach((r, k) => add(r[i], lessons[k].lang));
  for (const l of lessons) if (out.length < 3) add(l.title);
  return out;
}
