import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { Markdown, plainText } from "@/lib/markdown";
import { safetyIssues, schemaCheck, type TrainingDraft } from "@/server/ai-verify";
import { toXlsx } from "@/server/reports/xlsx";
import { svgLogoProblem } from "@/server/svg-safety";

/**
 * Hostile inputs that made a quadratic pattern block the shared Node process (one request froze
 * every tenant), and the behaviour the linear rewrites must keep. Each case took seconds to minutes
 * before the fix.
 */
/** Generous, since the full suite runs files in parallel: the linear versions take tens of ms, the quadratic ones took seconds to minutes. */
const LINEAR_MS = 1500;
const ms = (fn: () => unknown) => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

describe("svgLogoProblem on hostile input", () => {
  it("checks a 512 KB logo of unclosed url( in linear time", () => {
    // Before: about 140 s per call, and the payload was accepted.
    const flood = `<svg>${"url(".repeat(131_072)}</svg>`;
    expect(ms(() => svgLogoProblem(flood))).toBeLessThan(LINEAR_MS);
    expect(svgLogoProblem(flood)).toBe("external_ref");
    const fragments = `<svg>${"url(#a)".repeat(75_000)}</svg>`;
    expect(ms(() => svgLogoProblem(fragments))).toBeLessThan(LINEAR_MS);
    expect(svgLogoProblem(fragments)).toBeNull();
  }, 30_000);

  it("reads the first character of each url() value, quoted or bare", () => {
    expect(svgLogoProblem("<svg><g clip-path=\"url(  ' #c' )\" fill=\"url( #g )\" style='stroke:url(\"#s\")'/></svg>")).toBeNull();
    expect(svgLogoProblem('<svg><rect fill="url(" https://evil.example/f")"/></svg>')).toBe("external_ref");
    // An unclosed url( is refused too (before, it slipped through because nothing matched).
    expect(svgLogoProblem('<svg><rect style="fill:url(https://evil.example/f"/></svg>')).toBe("external_ref");
    expect(svgLogoProblem("<svg><rect fill=\"url()\"/></svg>")).toBe("external_ref");
  });
});

describe("Markdown on hostile input", () => {
  const md = (source: string) => renderToStaticMarkup(createElement(Markdown, { source }));

  it("renders runs of unclosed links in linear time", () => {
    // Before: 3 s at 40k "[" and about 75 s at the 200,000-character policy cap.
    expect(ms(() => md("[".repeat(200_000)))).toBeLessThan(LINEAR_MS);
    expect(ms(() => md("[a](/".repeat(40_000)))).toBeLessThan(LINEAR_MS);
    expect(ms(() => md("[a](https://x".repeat(18_000)))).toBeLessThan(LINEAR_MS);
    expect(ms(() => md(Array.from({ length: 2_500 }, () => "[".repeat(80)).join("\n")))).toBeLessThan(LINEAR_MS);
    expect(ms(() => md(`## ${"[".repeat(100_000)}`))).toBeLessThan(LINEAR_MS);
    expect(ms(() => plainText("[a](b".repeat(40_000)))).toBeLessThan(LINEAR_MS);
  }, 30_000);

  it("still renders links, bold and italics", () => {
    const html = md("Read **this** and *that*, the [policy](https://example.com/p) and [home](/app).");
    expect(html).toContain("<strong>this</strong>");
    expect(html).toContain("<em>that</em>");
    expect(html).toContain('href="https://example.com/p"');
    expect(html).toContain('href="/app"');
    // A stray "[" before a link leaves the text as it is and still renders the link.
    expect(md("see [note [home](/app)")).toContain('see [note <a href="/app"');
    expect(plainText("[Data](https://example.com) **kept**")).toBe("Data kept");
  });
});

describe("AI training safety check on hostile input", () => {
  const draft = (text: string): TrainingDraft => {
    const r = schemaCheck({ title: "Title", subtitle: "", lessons: [{ id: "l", title: "T", minutes: 3, scenes: [{ type: "recap", id: "r", points: [text] }] }] });
    if (!r.draft) throw new Error("draft rejected");
    return r.draft;
  };

  it("scans megabyte strings in linear time", () => {
    // Before: 2.7 s at 40k "a", about 28 minutes at 1 MB.
    for (const text of ["a".repeat(1_000_000), `${"a".repeat(64)}@${"1.".repeat(500_000)}`, "a@".repeat(500_000), "a.".repeat(500_000)]) {
      const d = draft(text);
      expect(ms(() => safetyIssues(d))).toBeLessThan(LINEAR_MS);
    }
  }, 30_000);

  it("still reports every real address, whatever its local part", () => {
    const long = `${"x".repeat(70)}@evil.com`;
    const issues = safetyIssues(draft(`Mail boss@realcorp.az, ${long}, a@b.cc@second.az or ok@example.com.`));
    const values = issues.filter((i) => i.code === "emailOutside").map((i) => i.params?.value);
    expect(values).toEqual(["boss@realcorp.az", long, "a@b.cc", "b.cc@second.az"]);
  });
});

describe("toXlsx text cleaning", () => {
  function sheet(book: Buffer): string {
    for (let p = 0; book.readUInt32LE(p) === 0x04034b50; ) {
      const size = book.readUInt32LE(p + 18);
      const nameLen = book.readUInt16LE(p + 26);
      const start = p + 30 + nameLen + book.readUInt16LE(p + 28);
      if (book.toString("utf8", p + 30, p + 30 + nameLen) === "xl/worksheets/sheet1.xml") return inflateRawSync(book.subarray(start, start + size)).toString("utf8");
      p = start + size;
    }
    throw new Error("no worksheet");
  }

  it("drops U+FFFE, U+FFFF and unpaired surrogates, which make the file unreadable, and keeps emoji", () => {
    const xml = sheet(toXlsx("S", ["h"], [["a\uFFFEb\uFFFFc\uD800d\uDC00e\u{1F600}f\tg"]]));
    expect(xml).toContain(">abcde\u{1F600}f\tg</t>");
    expect(xml).not.toMatch(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u);
  });
});
