/**
 * Lists the server's whole request surface with the access guard each entry reaches: every exported
 * function of src/server/actions/*.ts and every exported HTTP method of src/app/api/** /route.ts.
 *   npx tsx scripts/inventory-surface.ts        rewrites tests/fixtures/surface.json
 * tests/cross-tenant.test.ts fails when that file and the live inventory differ, so a new action or
 * route cannot land without a cross-organisation row in its table.
 *
 * Guards: "actionViewer(<permission>)", "actionViewer()", "apiViewer(<permission>)", "getViewer()",
 * "getSession()" or "public". A function that reaches its guard through another function of the same
 * file (a wrapper that catches failures, a shared handler for GET and POST) is credited with that guard.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const ACTIONS = path.join(ROOT, "src", "server", "actions");
const API = path.join(ROOT, "src", "app", "api");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "surface.json");

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const FUNCTION = /^(export )?(?:async )?function (\w+)\b/gm;
const GUARD = /\b(actionViewer|apiViewer)\(\s*(?:"([^"]+)")?/;

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

function guardOf(fns: Map<string, Fn>, name: string, seen = new Set<string>()): string {
  const fn = fns.get(name);
  if (!fn || seen.has(name)) return "public";
  seen.add(name);
  const viewer = GUARD.exec(fn.body);
  if (viewer) return `${viewer[1]}(${viewer[2] ?? ""})`;
  if (/\bgetViewer\(\)/.test(fn.body)) return "getViewer()";
  if (/\bgetSession\(\)/.test(fn.body)) return "getSession()";
  for (const call of fn.body.matchAll(/\b(\w+)\(/g)) {
    if (call[1] !== name && fns.has(call[1])) {
      const inner = guardOf(fns, call[1], seen);
      if (inner !== "public") return inner;
    }
  }
  return "public";
}

/** `{ "actions/people.addPersonAction": "actionViewer(people.write)", "api/tutor:POST": "getViewer()", … }`, keys sorted. */
export function inventory(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of fs.readdirSync(ACTIONS).filter((f) => f.endsWith(".ts")).sort()) {
    const fns = functionsIn(fs.readFileSync(path.join(ACTIONS, file), "utf8"));
    for (const [name, fn] of fns) if (fn.exported) out[`actions/${file.slice(0, -3)}.${name}`] = guardOf(fns, name);
  }
  const routes = fs
    .readdirSync(API, { recursive: true })
    .map(String)
    .filter((f) => path.basename(f) === "route.ts")
    .sort();
  for (const file of routes) {
    const fns = functionsIn(fs.readFileSync(path.join(API, file), "utf8"));
    const key = `api/${path.dirname(file).split(path.sep).join("/")}`;
    for (const [name, fn] of fns) if (fn.exported && METHODS.has(name)) out[`${key}:${name}`] = guardOf(fns, name);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const surface = inventory();
  fs.writeFileSync(FIXTURE, `${JSON.stringify(surface, null, 2)}\n`);
  console.log(`${Object.keys(surface).length} entries written to ${path.relative(ROOT, FIXTURE)}`);
}
