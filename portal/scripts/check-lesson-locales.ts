/**
 * Checks translated lesson files against their English originals.
 *   npx tsx scripts/check-lesson-locales.ts                      every .az.json and .ru.json
 *   npx tsx scripts/check-lesson-locales.ts <file.az.json> ...    only these files
 *   npx tsx scripts/check-lesson-locales.ts --coverage           also: every English lesson has both translations
 * Each file must pass the lesson schema, the integrity rules and the locale parity rules
 * (src/lib/content/locale-parity.ts). Exit code 1 when anything fails (or, with --coverage, is missing).
 */
import fs from "node:fs";
import path from "node:path";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";
import { localeParityErrors } from "../src/lib/content/locale-parity";

const ROOT = path.join(process.cwd(), "content", "library", "lessons");

function allTranslations(): string[] {
  const out: string[] = [];
  for (const mod of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (/\.(az|ru)\.json$/.test(f)) out.push(path.join(dir, f));
  }
  return out;
}

const coverage = process.argv.includes("--coverage");
const named = process.argv.slice(2).filter((a) => a !== "--coverage");
const files = named.length ? named.map((f) => path.resolve(f)) : allTranslations();
let failed = 0;
for (const file of files) {
  const enFile = file.replace(/\.(az|ru)\.json$/, ".en.json");
  const rel = path.relative(process.cwd(), file);
  const errors: string[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`not valid JSON: ${(e as Error).message}`);
  }
  if (doc !== undefined) {
    const parsed = lessonFileSchema.safeParse(doc);
    if (!parsed.success) errors.push(...parsed.error.issues.slice(0, 10).map((i) => `schema ${i.path.join(".")}: ${i.message}`));
    else errors.push(...lessonIntegrityErrors(parsed.data).map((e) => `integrity: ${e}`));
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
  for (const mod of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".en.json"))) {
      english++;
      for (const locale of ["az", "ru"]) {
        const translated = path.join(dir, f.replace(/\.en\.json$/, `.${locale}.json`));
        if (fs.existsSync(translated)) continue;
        missing++;
        console.log(`MISSING ${path.relative(process.cwd(), translated)}`);
      }
    }
  }
  console.log(`${english * 2 - missing} of ${english * 2} translations present (${english} English lessons × az, ru)`);
}
process.exit(failed || missing ? 1 : 0);
