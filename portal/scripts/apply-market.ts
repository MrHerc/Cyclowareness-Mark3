/**
 * Rewrites a market language's lesson files with its market pack (content/market/<lang>.json, see
 * src/lib/content/market.ts) and writes the pack's brand names into content/library/brands.json.
 *   npx tsx scripts/apply-market.ts            every pack with status "ready"
 *   npx tsx scripts/apply-market.ts de fr      only these languages
 * Deterministic and idempotent: a second run changes nothing. Only <lesson>.<lang>.json files are written,
 * never the English source, which casts the lesson (people and addresses follow it). Run it on a fresh
 * translation, then scripts/check-lesson-locales.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { applyMarket } from "../src/lib/content/market";
import { readMarket } from "../src/lib/content/market-files";
import type { Brand } from "../src/lib/content/types";

const CONTENT = path.join(process.cwd(), "content");
const LESSONS = path.join(CONTENT, "library", "lessons");
const BRANDS = path.join(CONTENT, "library", "brands.json");

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"));
/** Writes `doc` in the file's own format (indent, line ends, final newline); returns whether the file changed. */
function writeJson(file: string, doc: unknown): boolean {
  const raw = fs.readFileSync(file, "utf8");
  const indent = /^\{\r?\n( +)/.exec(raw)?.[1] ?? " ";
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const out = JSON.stringify(doc, null, indent).replace(/\n/g, eol) + (/\r?\n$/.test(raw) ? eol : "");
  if (out === raw) return false;
  fs.writeFileSync(file, out);
  return true;
}

const { world, packs: all } = readMarket();
const named = process.argv.slice(2);
const packs = all.filter((p) => (named.length ? named.includes(p.lang) : p.status === "ready"));
for (const p of packs) if (p.status !== "ready") throw new Error(`content/market/${p.lang}.json is a skeleton: fill it first`);

const brands = readJson(BRANDS) as Record<string, Brand>;
for (const pack of packs) {
  let changed = 0;
  let files = 0;
  for (const mod of fs.readdirSync(LESSONS)) {
    const dir = path.join(LESSONS, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(`.${pack.lang}.json`))) {
      files++;
      const id = f.slice(0, -`.${pack.lang}.json`.length);
      const file = path.join(dir, f);
      if (writeJson(file, applyMarket(readJson(file), `${mod}/${id}`, pack, world, readJson(path.join(dir, `${id}.en.json`))))) changed++;
    }
  }
  // A brand's local name is its registry name through the same pass ("OfisTəchizat MMC" → "BüroBedarf GmbH").
  for (const b of Object.values(brands)) {
    const local = applyMarket({ name: b.name }, "brands", pack, world).name;
    if (local !== b.name) b.names = { ...b.names, [pack.lang]: local };
  }
  console.log(`${pack.lang}: ${changed} of ${files} lesson files changed`);
}
console.log(writeJson(BRANDS, brands) ? "brands.json: names updated" : "brands.json: unchanged");
