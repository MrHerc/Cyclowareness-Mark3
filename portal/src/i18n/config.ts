/** Interface languages with full app translations. Lessons ship in English with localised titles. */
export const LOCALES = ["az", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";

/** The public site (landing tour) is translated into ten languages. */
export const SITE_LOCALES = ["az", "en", "ru", "tr", "ro", "ka", "uk", "de", "fr", "it"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export const LOCALE_NAMES: Record<SiteLocale, string> = {
  az: "Azərbaycanca",
  en: "English",
  ru: "Русский",
  tr: "Türkçe",
  ro: "Română",
  ka: "ქართული",
  uk: "Українська",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
};

export const LOCALE_COOKIE = "locale";

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

/** Reads a localised value from a `{ locale: text }` map with sensible fallbacks. */
export function pick(map: Record<string, string> | null | undefined, locale: string): string {
  if (!map) return "";
  return map[locale] ?? map.en ?? map.az ?? Object.values(map)[0] ?? "";
}
