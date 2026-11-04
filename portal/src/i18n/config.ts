/**
 * Interface languages with full app translations. Every library lesson is served in each of them
 * (`<lesson>.<locale>.json`). Arabic is written right to left (`dirOf`) and formatted as "ar", not
 * "ar-SA": Western digits and the Gregorian calendar; "ar-SA" is only the speech tag.
 */
export const LOCALES = ["az", "en", "ru", "tr", "ro", "ka", "uk", "de", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";

/** The public site (landing tour) has the same ten languages. */
export const SITE_LOCALES = LOCALES;
export type SiteLocale = Locale;

export const LOCALE_NAMES: Record<Locale, string> = {
  az: "Azərbaycanca",
  en: "English",
  ru: "Русский",
  tr: "Türkçe",
  ro: "Română",
  ka: "ქართული",
  uk: "Українська",
  de: "Deutsch",
  fr: "Français",
  ar: "العربية",
};

export const LOCALE_COOKIE = "locale";

/** Languages written right to left: the interface's Arabic, and the AI subtitle languages fa, he, ps and ur. */
export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar", "fa", "he", "ps", "ur"]);

/** Text direction of a locale or BCP-47 tag ("ar", "ar-SA"). */
export function dirOf(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale.split("-")[0].toLowerCase()) ? "rtl" : "ltr";
}

/** `lang` and `dir` for an element whose content language can differ from the page's. */
export function langAttrs(locale: string): { lang: string; dir: "rtl" | "ltr" } {
  return { lang: locale, dir: dirOf(locale) };
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === "string" && (SITE_LOCALES as readonly string[]).includes(value);
}

/** Picks the best supported language from an Accept-Language header. */
export function negotiate<T extends string>(header: string | null | undefined, supported: readonly T[], fallback: T): T {
  if (!header) return fallback;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0] as T;
    if (supported.includes(base)) return base;
  }
  return fallback;
}

/** Browser languages without an interface translation, mapped to the closest one (post-Soviet languages read Russian). */
export const UI_ALIAS: Record<string, Locale> = { be: "ru", kk: "ru", ky: "ru", uz: "ru" };

/**
 * The interface language of a signed-out visitor from the browser's languages. Outside Azerbaijan an
 * unknown language gets English (the product is sold globally); in Azerbaijan, or with no header at all,
 * Azerbaijani. Shared by the request config and src/app/global-error.tsx (which has no server).
 */
export function browserUiLocale(acceptLanguage: string | null | undefined, country: string | null | undefined): Locale {
  const fallback: Locale = country?.toUpperCase() === "AZ" || !acceptLanguage ? DEFAULT_LOCALE : "en";
  const best = negotiate(acceptLanguage, [...LOCALES, ...Object.keys(UI_ALIAS)], fallback);
  return isLocale(best) ? best : (UI_ALIAS[best] ?? fallback);
}

/** Reads a localised value from a `{ locale: text }` map with sensible fallbacks. */
export function pick(map: Record<string, string> | null | undefined, locale: string): string {
  if (!map) return "";
  return map[locale] ?? map.en ?? map.az ?? Object.values(map)[0] ?? "";
}
