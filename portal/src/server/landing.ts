import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { COUNTRY_CODES, PRIORITY_COUNTRIES, type GuideTiming, type LandingCopy, type SiteData } from "../lib/landing";
import type { SiteLocale } from "../i18n/config";

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
/** A spoken line ({ id, text, ... }): taken whole from one language, never mixed with another. */
const isLine = (v: unknown): boolean => isRecord(v) && typeof v.text === "string";

/**
 * One scene of a language over the English scene: missing keys come from English, and plain
 * label groups (errors, employee ranges, columns) are merged key by key. Lines, lists and
 * optional voice fields stay as the language has them, so a page never speaks English text.
 */
function mergeScene(en: unknown, own: unknown): unknown {
  if (!isRecord(en) || !isRecord(own)) return own ?? en;
  const out: Json = { ...en, ...own };
  for (const [k, v] of Object.entries(en)) {
    const mine = own[k];
    if (isRecord(v) && isRecord(mine) && !isLine(v) && !isLine(mine)) out[k] = { ...v, ...mine };
  }
  return out;
}

/** A language file over English: interface labels and scene fields it does not have yet fall back to English. */
export function mergeLandingCopy(en: LandingCopy, own: Partial<LandingCopy>): LandingCopy {
  const scenes = en.scenes.map((scene, i) => mergeScene(scene, own.scenes?.[i])) as LandingCopy["scenes"];
  return { ...en, ...own, ui: { ...en.ui, ...own.ui }, scenes };
}

/** Landing copy for one language. A missing file falls back to English as a whole, a missing key to the English key. */
export const loadLanding = cache(async (locale: SiteLocale): Promise<{ copy: LandingCopy; guide: GuideTiming; fallback: boolean }> => {
  const dir = path.join(process.cwd(), "content", "landing");
  const en = JSON.parse(await readFile(path.join(dir, "en.json"), "utf8")) as { copy: LandingCopy; guide: GuideTiming };
  if (locale === "en") return { copy: en.copy, guide: en.guide, fallback: false };
  try {
    const raw = JSON.parse(await readFile(path.join(dir, `${locale}.json`), "utf8")) as { copy: Partial<LandingCopy>; guide?: GuideTiming };
    return { copy: mergeLandingCopy(en.copy, raw.copy), guide: raw.guide ?? en.guide, fallback: false };
  } catch {
    return { copy: en.copy, guide: en.guide, fallback: true };
  }
});

const EMPTY_SITE_DATA: SiteData = { contact: { email: "", phone: "" }, social: [], regNo: "", partners: [], testimonials: [] };

/** Contact details, social links, partners and testimonials shown on the public site. */
export const loadSiteData = cache(async (): Promise<SiteData> => {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "content", "landing", "site.json"), "utf8")) as SiteData;
  } catch {
    return EMPTY_SITE_DATA;
  }
});

/** Country names in the visitor's language, priority countries first (names come from the server's ICU). */
export function countryOptions(locale: string): { priority: { code: string; name: string }[]; all: { code: string; name: string }[] } {
  const names = new Intl.DisplayNames([locale, "en"], { type: "region" });
  const name = (code: string) => names.of(code) ?? code;
  const all = COUNTRY_CODES.map((code) => ({ code, name: name(code) })).sort((a, b) => a.name.localeCompare(b.name, locale));
  return { priority: PRIORITY_COUNTRIES.map((code) => ({ code, name: name(code) })), all };
}
