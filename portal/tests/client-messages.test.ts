import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";
import { CLIENT_NAMESPACES, loadMessages, pickMessages, type Surface } from "@/i18n/messages";

// Each route group's provider replaces the root's messages for its subtree, so a client component that reads a
// namespace its group does not provide fails at runtime (MISSING_MESSAGE). These tests walk the imports from
// every file of a group, follow them into client code ("use client" and everything it imports) and collect the
// namespaces of its useTranslations calls.
const SRC = path.join(__dirname, "..", "src");
const APP = path.join(SRC, "app");

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", ".js", "/index.ts", "/index.tsx"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  return null;
}

const parsed = new Map<string, { client: boolean; imports: string[]; namespaces: string[] }>();
function parse(file: string) {
  let p = parsed.get(file);
  if (!p) {
    const src = readFileSync(file, "utf8");
    const specs = [...src.matchAll(/(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2]);
    p = {
      client: /^["']use client["']/.test(src),
      imports: specs.map((s) => resolve(file, s)).filter((f): f is string => !!f),
      namespaces: [...src.matchAll(/useTranslations\(\s*["']([^"'.]+)/g)].map((m) => m[1]),
    };
    parsed.set(file, p);
  }
  return p;
}

/** The namespaces client code reachable from `entries` reads, with the files that read each. */
function clientNamespaces(entries: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const seen = new Set<string>();
  const stack: [string, boolean][] = entries.map((f) => [f, false]);
  while (stack.length) {
    const [file, parentClient] = stack.pop()!;
    const p = parse(file);
    const client = parentClient || p.client;
    if (seen.has(`${client}:${file}`)) continue;
    seen.add(`${client}:${file}`);
    if (client) for (const ns of p.namespaces) out.set(ns, [...(out.get(ns) ?? []), path.relative(SRC, file)]);
    for (const dep of p.imports) stack.push([dep, client]);
  }
  return out;
}

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? filesUnder(path.join(dir, d.name)) : /\.(tsx?|js)$/.test(d.name) ? [path.join(dir, d.name)] : []));

const top = readdirSync(APP, { withFileTypes: true });
const groups = top.filter((d) => d.isDirectory() && /^\(.+\)$/.test(d.name)).map((d) => d.name.slice(1, -1));
// Everything outside the route groups renders under the root provider only.
const rootFiles = top.filter((d) => !(d.isDirectory() && /^\(.+\)$/.test(d.name))).flatMap((d) => (d.isDirectory() ? filesUnder(path.join(APP, d.name)) : [path.join(APP, d.name)]));
const surfaceOf = (group: string) => (group in CLIENT_NAMESPACES ? (group as Surface) : "root");

describe("per-route message bundles", () => {
  it.each(["root", ...groups])("%s provides exactly the namespaces its client components read", (group) => {
    const used = clientNamespaces(group === "root" ? rootFiles : filesUnder(path.join(APP, `(${group})`)));
    const provided: readonly string[] = CLIENT_NAMESPACES[surfaceOf(group)];
    const missing = [...used].filter(([ns]) => !provided.includes(ns));
    expect(missing, `client components read namespaces the ${group} provider does not ship`).toEqual([]);
    // A group without its own provider renders under the root one, which every page carries anyway.
    if (surfaceOf(group) === group || group === "root") expect([...provided].sort()).toEqual([...used.keys()].sort());
  });

  it.each(groups.filter((g) => g in CLIENT_NAMESPACES))("(%s)/layout.tsx puts its own provider around the group", (group) => {
    expect(readFileSync(path.join(APP, `(${group})`, "layout.tsx"), "utf8")).toContain(`<IntlScope surface="${group}">`);
  });

  it.each(Object.keys(CLIENT_NAMESPACES) as Surface[])("the %s pick renders every namespace it lists and nothing else", async (surface) => {
    const all = await loadMessages("en");
    const messages = pickMessages(all, CLIENT_NAMESPACES[surface]);
    expect(Object.keys(messages).sort()).toEqual([...CLIENT_NAMESPACES[surface]].sort());
    const errors: string[] = [];
    // A key of the namespace with a plain string (no arguments) under it.
    const plainKey = (node: object): string => {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string" && !v.includes("{")) return k;
        if (v && typeof v === "object") return `${k}.${plainKey(v)}`;
      }
      throw new Error("no plain string");
    };
    function Probe({ ns }: { ns: string }) {
      const t = useTranslations(ns as never) as unknown as (key: string) => string;
      return t(plainKey(all[ns as keyof typeof all]));
    }
    const render = (ns: string) =>
      renderToStaticMarkup(
        createElement(
          NextIntlClientProvider,
          { locale: "en", timeZone: "UTC", messages, onError: (e: { code: string }) => void errors.push(e.code) } as unknown as ComponentProps<typeof NextIntlClientProvider>,
          createElement(Probe, { ns }),
        ),
      );
    for (const ns of CLIENT_NAMESPACES[surface]) render(ns);
    expect(errors).toEqual([]);
    // The probe does notice a namespace the pick leaves out.
    render(surface === "site" || surface === "public" ? "admin" : "site");
    expect(errors).toEqual(["MISSING_MESSAGE"]);
  });
});
