import type { Locale } from "../i18n/config";

/**
 * Standard references are stored once for every language ("NIS2 Art. 21(2)(g)", "ISO/IEC 27001:2022 A.8.2").
 * Only the article abbreviation is localised when shown; identifiers and clause numbers never change.
 */
const ARTICLE: Record<string, string> = { az: "maddə", en: "Art.", ru: "ст.", tr: "md.", ro: "art.", ka: "მუხლი", uk: "ст.", de: "Art.", fr: "art.", ar: "المادة" } satisfies Record<Locale, string>;

export function localizeStandard(ref: string, locale: string): string {
  const word = ARTICLE[locale];
  return word ? ref.replace(/\bArt\.\s*/g, `${word} `) : ref;
}
