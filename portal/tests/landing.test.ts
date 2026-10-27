import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mergeLandingCopy } from "../src/server/landing";
import { SITE_LOCALES } from "../src/i18n/config";
import type { LandingCopy } from "../src/lib/landing";

const dir = path.join(__dirname, "..", "content", "landing");
const read = (locale: string) => JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), "utf8")) as { copy: LandingCopy };

/** Every leaf path ("copy.ui.forget", "copy.scenes[6].errors.consent", ...). */
function leaves(value: unknown, prefix = "", out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  else out.add(prefix);
  return out;
}

/** Optional per language: voice hints for the speech engine, and the note shown only on the English fallback page. */
const OPTIONAL = [/\.spoken$/, /\.emotion$/, /\.voice$/, /^copy\.ui\.fallbackNote$/];

describe("landing copy", () => {
  const en = leaves(read("en"));

  it.each(SITE_LOCALES.filter((l) => l !== "en"))("%s has every English key", (locale) => {
    const own = leaves(read(locale));
    const missing = [...en].filter((k) => !own.has(k) && !OPTIONAL.some((re) => re.test(k)));
    expect(missing).toEqual([]);
  });

  it.each(SITE_LOCALES)("%s has no empty interface label", (locale) => {
    const { copy } = read(locale);
    for (const [k, v] of Object.entries(copy.ui)) if (k !== "fallbackNote") expect(v.trim(), `${locale} ui.${k}`).not.toBe("");
    expect(copy.scenes[6].kind).toBe("demo");
    if (copy.scenes[6].kind === "demo") {
      expect(copy.scenes[6].countryPrompt.trim(), locale).not.toBe("");
      expect(copy.scenes[6].errors.consent.trim(), locale).not.toBe("");
    }
  });

  it.each(SITE_LOCALES)("%s shows a sample in exactly the site languages", (locale) => {
    const scene = read(locale).copy.scenes.find((s) => s.kind === "languages");
    const samples = scene?.kind === "languages" ? scene.samples.map((s) => s.locale) : [];
    expect(samples.sort()).toEqual([...SITE_LOCALES].sort());
  });

  it("falls back to English per key without mixing spoken lines", () => {
    const en = read("en").copy;
    const de = read("de").copy;
    const partial = { ...de, ui: { ...de.ui, forget: undefined as unknown as string }, scenes: de.scenes.map((s, i) => (i === 6 ? { ...s, countryPrompt: undefined, errors: { required: "Pflicht" } } : s)) } as unknown as LandingCopy;
    delete (partial.ui as Record<string, unknown>).forget;
    const merged = mergeLandingCopy(en, partial);
    expect(merged.ui.forget).toBe(en.ui.forget);
    expect(merged.ui.signIn).toBe(de.ui.signIn);
    const demo = merged.scenes[6];
    if (demo.kind !== "demo" || en.scenes[6].kind !== "demo" || de.scenes[6].kind !== "demo") throw new Error("demo scene");
    expect(demo.errors.required).toBe("Pflicht");
    expect(demo.errors.consent).toBe(en.scenes[6].errors.consent);
    expect(demo.invite).toEqual(de.scenes[6].invite);
  });
});
