/**
 * Checks translated lesson files against their English originals.
 *   npx tsx scripts/check-lesson-locales.ts                      every translation (<lesson>.<locale>.json)
 *   npx tsx scripts/check-lesson-locales.ts <file.az.json> ...    only these files
 *   npx tsx scripts/check-lesson-locales.ts --coverage           also: every English lesson has a translation in every interface locale
 * Mini-labs (content/library/labs/<module>.<locale>.json) are checked the same way with the lab scenario schema.
 * Each file must pass its schema, the integrity rules and the locale parity rules (src/lib/content/locale-parity.ts).
 * Exit code 1 when anything fails (or, with --coverage, a lesson translation is missing; mini-labs get their own count).
 */
import fs from "node:fs";
import path from "node:path";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";
import { labScenarioErrors, labScenarioSchema } from "../src/lib/content/lab-scenario";
import { localeParityErrors } from "../src/lib/content/locale-parity";
import { LOCALES } from "../src/i18n/config";

const TRANSLATION = /\.(?!en\.)[a-z]{2}\.json$/;

const ROOT = path.join(process.cwd(), "content", "library", "lessons");
const LABS = path.join(process.cwd(), "content", "library", "labs");
const labFiles = (pattern: RegExp) => (fs.existsSync(LABS) ? fs.readdirSync(LABS).filter((f) => pattern.test(f)) : []);

function allTranslations(): string[] {
  const out: string[] = [];
  for (const mod of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (TRANSLATION.test(f)) out.push(path.join(dir, f));
  }
  return [...out, ...labFiles(TRANSLATION).map((f) => path.join(LABS, f))];
}

/** Schema and integrity errors of a lesson file, or of a mini-lab file when it sits in the labs folder. */
function contentErrors(file: string, doc: unknown): string[] {
  const parsed = path.dirname(file) === LABS ? labScenarioSchema.safeParse(doc) : lessonFileSchema.safeParse(doc);
  if (!parsed.success) return parsed.error.issues.slice(0, 10).map((i) => `schema ${i.path.join(".")}: ${i.message}`);
  const integrity = "decisions" in parsed.data ? labScenarioErrors(parsed.data) : lessonIntegrityErrors(parsed.data);
  return integrity.map((e) => `integrity: ${e}`);
}

const coverage = process.argv.includes("--coverage");
const named = process.argv.slice(2).filter((a) => a !== "--coverage");
const files = named.length ? named.map((f) => path.resolve(f)) : allTranslations();
let failed = 0;
for (const file of files) {
  const enFile = file.replace(/\.[a-z]{2}\.json$/, ".en.json");
  const rel = path.relative(process.cwd(), file);
  const errors: string[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`not valid JSON: ${(e as Error).message}`);
  }
  if (doc !== undefined) {
    errors.push(...contentErrors(file, doc));
    if (!fs.existsSync(enFile)) errors.push(`no English original ${path.relative(process.cwd(), enFile)}`);
    else errors.push(...localeParityErrors(JSON.parse(fs.readFileSync(enFile, "utf8")), doc));
  }
  if (errors.length) {
    failed++;
    console.log(`FAIL ${rel}\n  ${errors.slice(0, 40).join("\n  ")}${errors.length > 40 ? `\n  … ${errors.length - 40} more` : ""}`);
  } else console.log(`ok   ${rel}`);
}
console.log(`\n${files.length - failed} of ${files.length} files pass`);

let missing = 0;
if (coverage) {
  let english = 0;
  const locales = LOCALES.filter((l) => l !== "en");
  for (const mod of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".en.json"))) {
      english++;
      for (const locale of locales) {
        const translated = path.join(dir, f.replace(/\.en\.json$/, `.${locale}.json`));
        if (fs.existsSync(translated)) continue;
        missing++;
        console.log(`MISSING ${path.relative(process.cwd(), translated)}`);
      }
    }
  }
  console.log(`${english * locales.length - missing} of ${english * locales.length} translations present (${english} English lessons × ${locales.join(", ")})`);
  // shortcut: missing mini-lab translations are counted, not failed, until their translation wave lands; then fail them like lessons.
  const labs = labFiles(/\.en\.json$/);
  const labsPresent = labs.flatMap((f) => locales.filter((l) => fs.existsSync(path.join(LABS, f.replace(/\.en\.json$/, `.${l}.json`))))).length;
  console.log(`${labsPresent} of ${labs.length * locales.length} mini-lab translations present (${labs.length} English mini-labs × ${locales.join(", ")})`);
}
process.exit(failed || missing ? 1 : 0);
