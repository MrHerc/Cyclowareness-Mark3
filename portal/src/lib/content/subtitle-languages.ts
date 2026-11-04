import { dirOf } from "../../i18n/config";

/**
 * Languages a learner can get AI-translated subtitles in (POST /api/subtitles): ISO 639-1 codes of
 * widely spoken languages. The languages the library ships (az en ru tr ro ka uk de fr ar) are left
 * out on purpose: their subtitles come from the stored lesson text (lesson_contents), never from the model.
 * The code also goes into the model prompt, so only these values are ever accepted.
 */
export const SUBTITLE_LANGUAGES = [
  "af", "am", "be", "bg", "bn", "bs", "ca", "cs", "da", "el",
  "es", "et", "fa", "fi", "gu", "ha", "he", "hi", "hr", "hu",
  "hy", "id", "is", "it", "ja", "kk", "km", "kn", "ko", "ky",
  "lt", "lv", "mk", "ml", "mn", "mr", "ms", "my", "ne", "nl",
  "no", "pa", "pl", "ps", "pt", "si", "sk", "sl", "so", "sq",
  "sr", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl", "ur",
  "uz", "vi", "yo", "zh", "zu",
] as const;
export type SubtitleLanguage = (typeof SUBTITLE_LANGUAGES)[number];

export function isSubtitleLanguage(value: unknown): value is SubtitleLanguage {
  return typeof value === "string" && (SUBTITLE_LANGUAGES as readonly string[]).includes(value);
}

export type SubtitleLanguageOption = { code: SubtitleLanguage; name: string; native: string; dir: "rtl" | "ltr" };

/** The picker's list: each language named in the interface language and in itself, sorted by the interface name. */
export function subtitleLanguageOptions(displayLocale: string): SubtitleLanguageOption[] {
  const names = new Intl.DisplayNames([displayLocale, "en"], { type: "language" });
  const collator = new Intl.Collator(displayLocale);
  return SUBTITLE_LANGUAGES.map((code) => ({
    code,
    name: names.of(code) ?? code,
    native: new Intl.DisplayNames([code, "en"], { type: "language" }).of(code) ?? code,
    // Captions and the transcript take it from langAttrs too (src/i18n/config.ts knows these languages).
    dir: dirOf(code),
  })).sort((a, b) => collator.compare(a.name, b.name));
}
