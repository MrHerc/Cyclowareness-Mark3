/**
 * Languages of a policy version. The base text (title, summary, body columns) is written in the
 * organisation's default language at publish time; since the per-language editor, a copy of it marked
 * `base` sits in `translations` under that language, next to the other languages. Older versions have
 * no such copy: their base language is taken to be the organisation's default.
 */
export type PolicyText = { title: string; summary?: string; bodyMd: string; base?: boolean };
type Version = { title: string; summary: string | null; bodyMd: string; translations: Record<string, PolicyText> | null };

export function policyBaseLocale(translations: Record<string, PolicyText> | null | undefined, fallback: string): string {
  return Object.entries(translations ?? {}).find(([, x]) => x.base)?.[0] ?? fallback;
}

/** What a reader in `locale` sees: their language when the version has it, else the base text, and the language it is in. */
export function policyTextFor(version: Version, locale: string, fallbackBase: string): { title: string; summary: string | null; bodyMd: string; lang: string } {
  const own = version.translations?.[locale];
  if (own) return { title: own.title || version.title, summary: own.summary ?? (own.base ? version.summary : null), bodyMd: own.bodyMd, lang: locale };
  return { title: version.title, summary: version.summary, bodyMd: version.bodyMd, lang: policyBaseLocale(version.translations, fallbackBase) };
}
