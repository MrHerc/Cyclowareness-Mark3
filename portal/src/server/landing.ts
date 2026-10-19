import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { COUNTRY_CODES, PRIORITY_COUNTRIES, type GuideTiming, type LandingCopy, type SiteData } from "../lib/landing";
import type { SiteLocale } from "../i18n/config";

/** Landing copy for one language (falls back to English if a file is missing). */
export const loadLanding = cache(async (locale: SiteLocale): Promise<{ copy: LandingCopy; guide: GuideTiming; fallback: boolean }> => {
  const dir = path.join(process.cwd(), "content", "landing");
  try {
    const raw = JSON.parse(await readFile(path.join(dir, `${locale}.json`), "utf8"));
    return { copy: raw.copy, guide: raw.guide, fallback: false };
  } catch {
    const raw = JSON.parse(await readFile(path.join(dir, "en.json"), "utf8"));
    return { copy: raw.copy, guide: raw.guide, fallback: true };
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
