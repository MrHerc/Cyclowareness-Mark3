/**
 * A risk title is written once and read later by people in other languages (the learner after a
 * language switch, an admin in their own language). New rows keep every UI language in
 * behavior_risks.title as JSON text, `{"az":…,"en":…,"ru":…}`; rows written before that hold one
 * plain string in the language the person had at the time.
 */
export function encodeRiskTitle(titles: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(titles).map(([lang, text]) => [lang, text.slice(0, 300)])));
}

/** Every language of a stored title, or null for an older single-language row. */
export function riskTitles(stored: string): Record<string, string> | null {
  if (!stored.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string");
    return entries.length ? Object.fromEntries(entries) : null;
  } catch {
    return null;
  }
}

/** The title in `locale` (English, then any language, when that one is missing); an older row as it was stored. */
export function riskTitle(stored: string, locale: string): string {
  const all = riskTitles(stored);
  if (!all) return stored;
  return all[locale] ?? all.en ?? Object.values(all)[0] ?? "";
}
