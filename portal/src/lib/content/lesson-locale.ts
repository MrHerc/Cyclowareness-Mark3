/**
 * Which stored text of a lesson (`lesson_contents`, one row per locale) a reader gets: their own
 * language, then English (every library lesson has it), then whatever the lesson exists in (a studio
 * lesson written in one language only). Used by the player, the AI tutor and the AI trainer.
 */
export function pickLessonContent<T extends { locale: string }>(contents: readonly T[], locale: string): T | undefined {
  return contents.find((c) => c.locale === locale) ?? contents.find((c) => c.locale === "en") ?? contents[0];
}

/**
 * One language for several lessons used together (a draft built from library lessons stores a single
 * content language): the wanted language when every lesson has it, otherwise English.
 */
export function sharedContentLocale(localesPerLesson: readonly (readonly string[])[], wanted: string): string {
  return localesPerLesson.length > 0 && localesPerLesson.every((locales) => locales.includes(wanted)) ? wanted : "en";
}
