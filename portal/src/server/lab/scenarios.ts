import fs from "node:fs";
import path from "node:path";
import { labScenarioErrors, labScenarioSchema, type LabScenario } from "../../lib/content/lab-scenario";

const DIR = path.join(process.cwd(), "content", "library", "labs");
// One read per file and server process, like the brand registry (content/ ships with the server).
const cache = new Map<string, LabScenario | null>();

function read(slug: string, locale: string): LabScenario | null {
  const key = `${slug}.${locale}`;
  if (!cache.has(key)) {
    let found: LabScenario | null = null;
    try {
      const parsed = labScenarioSchema.safeParse(JSON.parse(fs.readFileSync(path.join(DIR, `${key}.json`), "utf8")));
      if (parsed.success && parsed.data.module === slug && !labScenarioErrors(parsed.data).length) found = parsed.data;
    } catch {
      // A missing or unreadable file is no mini-lab in this language.
    }
    cache.set(key, found);
  }
  return cache.get(key) ?? null;
}

/**
 * A module's mini-lab in the learner's language, or the English original when there is no valid translation;
 * `lang` is the language of the text. Scoring always reads the English file: translations keep its ids.
 */
export function labScenario(slug: string, locale = "en"): { scenario: LabScenario; lang: string } | null {
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z]{2}$/.test(locale)) return null;
  const own = locale === "en" ? null : read(slug, locale);
  if (own) return { scenario: own, lang: locale };
  const en = read(slug, "en");
  return en && { scenario: en, lang: "en" };
}
