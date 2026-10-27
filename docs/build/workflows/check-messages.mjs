// node check-messages.mjs <lang> [namespace ...]
// Same rules as portal/tests/i18n.test.ts for a locale that is not registered yet: messages/<lang>/<ns>.json
// must have exactly the keys of messages/en/<ns>.json, the same ICU placeholders, and parse as ICU.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const PORTAL = "C:/Users/Safar/Desktop/Cyclowareness- Vol2/portal";
const require = createRequire(path.join(PORTAL, "package.json"));
const { IntlMessageFormat } = require("intl-messageformat");
const { parse } = require("@formatjs/icu-messageformat-parser");

const NAMESPACES = ["common", "auth", "learner", "player", "security", "admin", "secops", "settings", "site"];
const [lang, ...only] = process.argv.slice(2);
if (!lang) throw new Error("usage: node check-messages.mjs <lang> [namespace ...]");

function flatten(obj, prefix = "", out = new Map()) {
  if (Array.isArray(obj)) {
    out.set(prefix, `array:${obj.length}`);
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else out.set(prefix, obj);
  return out;
}
function placeholders(msg) {
  const names = new Set();
  const walk = (els) => {
    for (const e of els) {
      if (e.type >= 1 && e.type <= 6 && typeof e.value === "string") names.add(e.value);
      for (const o of Object.values(e.options ?? {})) walk(o.value);
      if (e.children) walk(e.children);
    }
  };
  try { walk(parse(msg)); } catch { for (const m of msg.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)) names.add(m[1]); }
  return [...names].sort().join(",");
}

let problems = 0;
for (const ns of only.length ? only : NAMESPACES) {
  const file = path.join(PORTAL, "messages", lang, `${ns}.json`);
  if (!fs.existsSync(file)) { console.log(`MISSING ${lang}/${ns}.json`); problems++; continue; }
  let other;
  try { other = flatten(JSON.parse(fs.readFileSync(file, "utf8"))); } catch (e) { console.log(`BAD JSON ${lang}/${ns}.json: ${e.message}`); problems++; continue; }
  const en = flatten(JSON.parse(fs.readFileSync(path.join(PORTAL, "messages", "en", `${ns}.json`), "utf8")));
  const out = [];
  for (const k of en.keys()) if (!other.has(k)) out.push(`missing key ${k}`);
  for (const k of other.keys()) if (!en.has(k)) out.push(`extra key ${k}`);
  for (const [k, v] of en) {
    const o = other.get(k);
    if (typeof v !== "string" || typeof o !== "string") continue;
    if (!o.trim() && v.trim()) out.push(`empty ${k}`);
    if (placeholders(o) !== placeholders(v)) out.push(`placeholders ${k}: ${placeholders(o)} vs en ${placeholders(v)}`);
    try { new IntlMessageFormat(o, lang); } catch (e) { out.push(`ICU ${k}: ${e.message}`); }
  }
  problems += out.length;
  console.log(out.length ? `FAIL ${lang}/${ns}.json\n  ${out.slice(0, 60).join("\n  ")}` : `ok   ${lang}/${ns}.json (${other.size} keys)`);
}
process.exit(problems ? 1 : 0);
