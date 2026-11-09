/**
 * Lists the server's whole request surface with the access guard each entry reaches: every exported
 * function of every "use server" file under src/ (wherever it lives: Next.js lets an actions.ts sit next
 * to a page) and every exported HTTP method of src/app/api/** /route.ts.
 *   npx tsx scripts/inventory-surface.ts        rewrites tests/fixtures/surface.json
 * tests/cross-tenant.test.ts fails when that file and the live inventory differ, so a new action or
 * route cannot land without a cross-organisation row in its table.
 *
 * Guards: "actionViewer(<permission>)", "actionViewer()", "apiViewer(<permission>)", "getViewer()",
 * "getSession()" or "public", followed by "+allowed(<permission>)" when the body narrows the role after the
 * gate. A function that reaches its guard through another function of the same file (a wrapper that catches
 * failures, a shared handler for GET and POST) is credited with that guard. An export the inventory cannot
 * read (`export const GET = …`, a re-export) throws instead of shipping unlisted.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "surface.json");

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
// shortcut: a directive after a leading comment is missed, strip comments first if a file ever gains one.
const USE_SERVER = /^\s*["']use server["']/;
const FUNCTION = /^(export )?(?:async )?function (\w+)\b/gm;
const GUARD = /\b(actionViewer|apiViewer)\(\s*(?:"([^"]+)")?/;
const ALLOWED = /\ballowed\(\w+,\s*"([^"]+)"/;
const READABLE_EXPORT = /^export (?:type\b|interface\b|(?:async )?function \w+)/;
const SEGMENT_CONFIG = /^export const (?:dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration)\b/;

type Fn = { exported: boolean; body: string };

/** The file's top-level functions, each with the text up to the next one. */
function functionsIn(source: string): Map<string, Fn> {
  const found = [...source.matchAll(FUNCTION)];
  const fns = new Map<string, Fn>();
  found.forEach((m, i) => {
    fns.set(m[2], { exported: !!m[1], body: source.slice(m.index, found[i + 1]?.index ?? source.length) });
  });
  return fns;
}

function ownGuard(body: string): string | null {
  const viewer = GUARD.exec(body);
  if (viewer) return `${viewer[1]}(${viewer[2] ?? ""})`;
  if (/\bgetViewer\(\)/.test(body)) return "getViewer()";
  if (/\bgetSession\(\)/.test(body)) return "getSession()";
  return null;
}

function guardOf(fns: Map<string, Fn>, name: string, seen = new Set<string>()): string {
  const fn = fns.get(name);
  if (!fn || seen.has(name)) return "public";
  seen.add(name);
  const own = ownGuard(fn.body);
  if (own) {
    const narrowed = ALLOWED.exec(fn.body);
    return narrowed ? `${own}+allowed(${narrowed[1]})` : own;
  }
  for (const call of fn.body.matchAll(/\b(\w+)\(/g)) {
    if (call[1] !== name && fns.has(call[1])) {
      const inner = guardOf(fns, call[1], seen);
      if (inner !== "public") return inner;
    }
  }
  return "public";
}

function checkExports(source: string, file: string, route: boolean) {
  for (const line of source.split("\n")) {
    if (!line.startsWith("export ") || READABLE_EXPORT.test(line) || (route && SEGMENT_CONFIG.test(line))) continue;
    throw new Error(`${file}: "${line.trim()}" is an export the inventory cannot read; write it as an exported function`);
  }
}

/** `{ "server/actions/people.addPersonAction": "actionViewer(people.write)", "api/tutor:POST": "getViewer()+allowed(studio.write)", … }`, keys sorted. */
export function inventory(): Record<string, string> {
  const out: Record<string, string> = {};
  const files = fs
    .readdirSync(SRC, { recursive: true })
    .map((f) => String(f).split(path.sep).join("/"))
    .filter((f) => /\.tsx?$/.test(f))
    .sort();
  for (const file of files) {
    const source = fs.readFileSync(path.join(SRC, file), "utf8");
    const route = /^app\/api\/.*\/route\.ts$/.test(file);
    if (!route && !USE_SERVER.test(source)) continue;
    checkExports(source, file, route);
    const fns = functionsIn(source);
    if (route) {
      const key = `api/${file.slice("app/api/".length, -"/route.ts".length)}`;
      const methods = [...fns].filter(([name, fn]) => fn.exported && METHODS.has(name));
      if (!methods.length) throw new Error(`${file}: no exported route handler recognised`);
      for (const [name] of methods) out[`${key}:${name}`] = guardOf(fns, name);
    } else {
      for (const [name, fn] of fns) if (fn.exported) out[`${file.replace(/\.tsx?$/, "")}.${name}`] = guardOf(fns, name);
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const surface = inventory();
  fs.writeFileSync(FIXTURE, `${JSON.stringify(surface, null, 2)}\n`);
  console.log(`${Object.keys(surface).length} entries written to ${path.relative(ROOT, FIXTURE)}`);
}
