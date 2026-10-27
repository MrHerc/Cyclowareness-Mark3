import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dirOf, langAttrs } from "@/i18n/config";

// Arabic is right to left, so layout uses logical utilities (ms/pe/start/text-end/border-s/rounded-ss...).
// A physical one (ml/pr/left/text-right/border-l/rounded-tl...) is allowed only where it is physical on purpose.
const ALLOWED: { path: string; tokens?: string[]; why: string }[] = [
  { path: "src/components/lab/", why: "the lab VM is a left-to-right simulated OS with physical window positions" },
  { path: "src/components/mascot/", why: "mascot internals are physical; the mascot is never mirrored" },
  { path: "src/components/site/scroll-cat.tsx", why: "places the cat from physical rects with translate3d" },
  { path: "src/components/site/perch.ts", why: "perch boxes are physical rects for the scroll cat" },
  { path: "src/components/player/artifacts.tsx", tokens: ["left-1/2", "-translate-x-1/2"], why: "centred with left-1/2 -translate-x-1/2, direction-neutral" },
  { path: "src/components/player/rich.tsx", tokens: ["-right-3"], why: "magnifier handle, a drawing that never mirrors" },
  { path: "src/components/admin/admin-tour.tsx", tokens: ["style.left"], why: "the spotlight starts at the centre and then follows the target's physical rect" },
  { path: "src/components/learner/tour.tsx", tokens: ["style.left"], why: "the spotlight starts at the centre and then follows the target's physical rect" },
  { path: "src/components/player/scenes.tsx", tokens: ["style.translateX"], why: "the swipe card follows the pointer's physical movement" },
];

const VALUE = String.raw`(?:\d+(?:\.\d+)?|\d+\/\d+|px|auto|full|\[\S+\]|\(\S+\))`;
const PHYSICAL = new RegExp(
  String.raw`^!?(?:-?m[lr]-${VALUE}|p[lr]-${VALUE}|-?(?:left|right)-${VALUE}|text-(?:left|right)|border-[lr](?:-\S+)?|rounded-(?:[lr]|[tb][lr])(?:-\S+)?)!?$`,
);
/** Physical utilities that have no logical form: right only next to their rtl: twin (a hover nudge, a switch knob, a select arrow). */
const PAIRED = new RegExp(String.raw`^!?(?:-?translate-x-${VALUE}|object-(?:left|right)\S*|origin-(?:top-|bottom-)?(?:left|right)|bg-(?:left|right)\S*|bg-\[(?:left|right)\S*\])!?$`);
/** Physical keys in an inline style={{ … }}. */
const STYLE = /\b(left|right|paddingLeft|paddingRight|marginLeft|marginRight|translateX)\b\s*[:(]/g;
const TOKEN = /[^\s"'`{}$;<]+/g;

/** Splits a token into its variants and its utility ("sm:-ml-2" -> ["sm:", "-ml-2"]). */
function split(token: string): [string, string] {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) cut = i;
  }
  return [token.slice(0, cut + 1), token.slice(cut + 1)];
}

/** The utility after the variants; null for rtl:/ltr: tokens, which are direction-aware. */
function utility(token: string): string | null {
  const [variants, util] = split(token);
  return /(^|:)(rtl|ltr):/.test(variants) ? null : util;
}

/** "translate", "object", "origin" or "bg": what an rtl: twin must set too. */
const family = (util: string) => util.replace(/^!?-?/, "").split("-")[0];

function physicalTokens(source: string): { line: number; token: string }[] {
  return source.split("\n").flatMap((text, i) => {
    const tokens = text.match(TOKEN) ?? [];
    const twins = new Set(tokens.filter((t) => utility(t) === null).map((t) => family(split(t)[1])));
    const classes = tokens.filter((t) => {
      const u = utility(t) ?? "";
      return PHYSICAL.test(u) || (PAIRED.test(u) && !twins.has(family(u)));
    });
    const styles = text.includes("style={{") ? [...text.matchAll(STYLE)].map((m) => `style.${m[1]}`) : [];
    return [...classes, ...styles].map((token) => ({ line: i + 1, token }));
  });
}

const allowed = (file: string, token: string) =>
  ALLOWED.some((a) => (a.path.endsWith("/") ? file.startsWith(a.path) : file === a.path) && (!a.tokens || a.tokens.includes(token)));

describe("direction-agnostic layout", () => {
  it("detects physical utilities and leaves look-alikes alone", () => {
    const hits = physicalTokens(`"ml-auto sm:-mr-2 lg:pl-(--rail-width) -left-[9999px] text-right! border-l-primary/40 rounded-tl-sm rtl:pl-2"`);
    expect(hits.map((h) => h.token)).toEqual(["ml-auto", "sm:-mr-2", "lg:pl-(--rail-width)", "-left-[9999px]", "text-right!", "border-l-primary/40", "rounded-tl-sm"]);
    const clean = "ms-auto ps-4 start-0 text-end border-s rounded-ss-sm inset-x-0 text-rightish border-red-500 rounded-lg right-click left-aligned";
    expect(physicalTokens(clean)).toEqual([]);
  });

  it("allows a transform, origin or background position only with its rtl: twin, and flags physical inline styles", () => {
    const hits = physicalTokens(`"group-hover:translate-x-0.5 object-left origin-top-right bg-[right_0.85rem_center]" style={{ left: 0, paddingRight: 4, transform: "translateX(2px)" }}`);
    expect(hits.map((h) => h.token)).toEqual(["group-hover:translate-x-0.5", "object-left", "origin-top-right", "bg-[right_0.85rem_center]", "style.left", "style.paddingRight", "style.translateX"]);
    const paired = `"group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 object-left rtl:object-right bg-[right_1rem_center] rtl:bg-[left_1rem_center]" style={{ insetInlineStart: 0 }}`;
    expect(physicalTokens(paired)).toEqual([]);
  });

  it("uses no physical direction classes outside the allowlist", () => {
    const root = process.cwd();
    const files = fs
      .readdirSync(path.join(root, "src"), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => `src/${f.split(path.sep).join("/")}`);
    const offenders = files.flatMap((file) =>
      physicalTokens(fs.readFileSync(path.join(root, file), "utf8"))
        .filter((h) => !allowed(file, h.token))
        .map((h) => `${file}:${h.line} ${h.token}`),
    );
    expect(offenders).toEqual([]);
  }, 60_000);
});

describe("dirOf / langAttrs", () => {
  it("is rtl only for Arabic", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("ar-SA")).toBe("rtl");
    for (const l of ["az", "en", "ru", "tr", "ro", "ka", "uk", "de", "fr"]) expect(dirOf(l)).toBe("ltr");
    expect(langAttrs("ar")).toEqual({ lang: "ar", dir: "rtl" });
    expect(langAttrs("en")).toEqual({ lang: "en", dir: "ltr" });
  });
});
