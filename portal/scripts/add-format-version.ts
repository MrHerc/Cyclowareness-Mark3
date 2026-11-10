/**
 * One-off, idempotent: puts `"formatVersion": 1` as the first key of every lesson file under
 * content/library/lessons (English and translations). Text insertion, not a JSON rewrite, so each
 * file keeps its indent, line endings, final newline and key order.
 *   npx tsx scripts/add-format-version.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "content", "library", "lessons");

let changed = 0;
let total = 0;
for (const mod of fs.readdirSync(ROOT)) {
  for (const f of fs.readdirSync(path.join(ROOT, mod)).filter((x) => x.endsWith(".json"))) {
    const file = path.join(ROOT, mod, f);
    const text = fs.readFileSync(file, "utf8");
    total++;
    if ((JSON.parse(text) as { formatVersion?: unknown }).formatVersion !== undefined) continue;
    const m = /^\{(\r?\n)( +)"/.exec(text);
    if (!m) throw new Error(`${file}: expected the first key on its own indented line`);
    const next = `{${m[1]}${m[2]}"formatVersion": 1,${text.slice(1)}`;
    if (Object.keys(JSON.parse(next) as object)[0] !== "formatVersion") throw new Error(`${file}: formatVersion is not the first key`);
    fs.writeFileSync(file, next);
    changed++;
  }
}
console.log(`formatVersion added to ${changed} of ${total} lesson files`);
