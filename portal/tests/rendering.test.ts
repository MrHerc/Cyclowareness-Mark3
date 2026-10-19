import { hostname } from "node:os";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown, headingsOf, slugify } from "@/lib/markdown";
import { Marked, unmark } from "@/components/site/marked";
import { formatSyslog } from "@/server/jobs";

const md = (source: string, skipTitle = false) => renderToStaticMarkup(createElement(Markdown, { source, skipTitle }));
const marked = (text: string, reveal: boolean, className?: string) => renderToStaticMarkup(createElement(Marked, { text, reveal, className }));
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Data   Retention")).toBe("data-retention");
  });

  it("drops punctuation and leading or trailing hyphens", () => {
    expect(slugify("  Scope & Purpose!  ")).toBe("scope-purpose");
    expect(slugify("3.1. Data retention")).toBe("3-1-data-retention");
  });

  it("keeps non-Latin letters and digits", () => {
    expect(slugify("Məlumat 2026")).toBe("məlumat-2026");
    expect(slugify("Политика конфиденциальности")).toBe("политика-конфиденциальности");
  });

  it("caps the slug at 60 characters", () => {
    expect(slugify("a".repeat(80))).toHaveLength(60);
  });

  // BUG src/lib/markdown.tsx:12-13: NFKD splits "ş"/"ü"/"й" into a base letter plus a combining
  // mark (\p{M}), and the replace turns that mark into "-" instead of dropping it, so
  // "Şəxsi məlumatlar" becomes "s-əxsi-məlumatlar" and "Настройки" becomes "настрои-ки".
  it("strips diacritics instead of turning them into hyphens", () => {
    expect(slugify("Şəxsi məlumatlar")).toBe("səxsi-məlumatlar");
    expect(slugify("Täglich")).toBe("taglich");
  });
});

describe("headingsOf", () => {
  it("returns h2 and h3 headings with ids and levels, ignoring h1, h4 and non-headings", () => {
    const source = "# Title\n\n## Scope\nText\n### Sub Item\n#### Deep\n#NoSpace\n  ## Indented  ";
    expect(headingsOf(source)).toEqual([
      { id: "scope", text: "Scope", level: 2 },
      { id: "sub-item", text: "Sub Item", level: 3 },
      { id: "indented", text: "Indented", level: 2 },
    ]);
  });

  it("produces the same ids the Markdown component renders", () => {
    const source = "## Data Retention\n### Who We Share With";
    const html = md(source);
    for (const h of headingsOf(source)) expect(html).toContain(`<h${h.level} id="${h.id}"`);
  });
});

describe("Markdown", () => {
  it("renders the h1 unless skipTitle is set", () => {
    expect(md("# Title\n\nBody")).toContain("<h1>Title</h1>");
    const skipped = md("# Title\n\nBody", true);
    expect(skipped).not.toContain("<h1");
    expect(skipped).toContain("<p>Body</p>");
  });

  it("gives h2 and h3 slug ids", () => {
    const html = md("## Data Retention\n### Sub Item");
    expect(html).toContain('<h2 id="data-retention" class="scroll-mt-24">Data Retention</h2>');
    expect(html).toContain('<h3 id="sub-item" class="scroll-mt-24">Sub Item</h3>');
  });

  it("joins consecutive lines into one paragraph and splits on blank lines", () => {
    expect(md("one\ntwo\n\nthree")).toContain("<p>one two</p><p>three</p>");
  });

  it("renders - and * bullets as one unordered list", () => {
    expect(md("- a\n* b")).toContain('<ul class="list-disc pl-6"><li>a</li><li>b</li></ul>');
  });

  it("renders 1) items as an ordered list", () => {
    expect(md("1) a\n2) b")).toContain('<ol class="list-decimal pl-6"><li>a</li><li>b</li></ol>');
  });

  it("starts a new list when the list kind changes", () => {
    const html = md("- a\n1) b");
    expect(count(html, "<ul")).toBe(1);
    expect(count(html, "<ol")).toBe(1);
    expect(html.indexOf("<ul")).toBeLessThan(html.indexOf("<ol"));
  });

  it("renders bold and italic", () => {
    expect(md("**bold** and *italic*")).toContain("<p><strong>bold</strong> and <em>italic</em></p>");
    expect(md("- **strong** item")).toContain("<li><strong>strong</strong> item</li>");
  });

  it("opens external links in a new tab with rel noopener", () => {
    const html = md("See [Site](https://example.com/a?b=1).");
    expect(html).toContain('href="https://example.com/a?b=1"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(">Site</a>.");
  });

  it("renders internal links without target or rel", () => {
    const html = md("Read the [Privacy Policy](/legal/privacy).");
    expect(html).toContain('href="/legal/privacy"');
    expect(html).toContain(">Privacy Policy</a>");
    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it("does not link javascript: or mailto: destinations", () => {
    expect(md("[x](javascript:alert(1))")).not.toContain("<a ");
    expect(md("[x](mailto:a@b.c)")).not.toContain("<a ");
  });

  it("renders pipe tables with a thead and a tbody", () => {
    const html = md("| Name | Role |\n|---|---|\n| Ada | Admin |\n| Bob | User |");
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(count(html, '<th scope="col"')).toBe(2);
    expect(count(html, "<td")).toBe(4);
    expect(count(html, "<tr>")).toBe(3);
    expect(html).toContain(">Name</th>");
    expect(html).toContain(">Ada</td>");
  });

  it("turns an escaped \\| inside a cell into a literal pipe", () => {
    const html = md("| a \\| b | c |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain(">a | b</th>");
    expect(count(html, '<th scope="col"')).toBe(2);
  });

  it("skips the separator row, including alignment colons", () => {
    const html = md("| a | b |\n|:---|---:|\n| 1 | 2 |");
    expect(count(html, "<tr>")).toBe(2);
    expect(html).not.toContain("---");
  });

  it("closes the table when a paragraph follows it", () => {
    const html = md("| a |\n|---|\n| 1 |\nAfter");
    expect(count(html, "<table")).toBe(1);
    expect(html).toContain("</table></div><p>After</p>");
  });

  it("renders numbered legal clauses on consecutive lines as separate paragraphs", () => {
    expect(md("3.1. First clause\n3.2. Second clause")).toContain("<p>3.1. First clause</p><p>3.2. Second clause</p>");
    expect(md("4.1.2 Deep clause\n4.1.3 Next one")).toContain("<p>4.1.2 Deep clause</p><p>4.1.3 Next one</p>");
  });

  it("escapes <script> and other tags in the source text", () => {
    const para = md("Hi <script>alert(1)</script> there");
    expect(para).toContain("&lt;script&gt;");
    expect(para).not.toContain("<script");
    const cell = md("| h |\n|---|\n| <img src=x onerror=alert(1)> |");
    expect(cell).toContain("&lt;img");
    expect(cell).not.toContain("<img");
  });

  it("drops HTML comment lines", () => {
    const html = md("<!-- version: 2; effective: 2026-10-08 -->\n# Title\nBody");
    expect(html).not.toContain("<!--");
    expect(html).not.toContain("version");
    expect(html).toContain("<h1>Title</h1>");
  });

  it("renders an empty source as an empty container", () => {
    expect(md("")).toMatch(/^<div class="[^"]*"><\/div>$/);
  });
});

describe("Marked", () => {
  it("renders [[ ]] as mark and nested {{ }} as a span", () => {
    expect(marked("Look at [[the {{sender}} address]] now", false)).toMatch(
      /^<span>Look at <mark class="[^"]*">the <span class="[^"]*">sender<\/span> address<\/mark> now<\/span>$/,
    );
  });

  it("only adds the highlight classes when reveal is on", () => {
    const hidden = marked("[[a {{b}} c]]", false);
    expect(hidden).toContain("bg-transparent");
    expect(hidden).not.toContain("bg-reward-200/70");
    expect(hidden).not.toContain("font-semibold");
    expect(hidden).not.toContain("text-risk-600");
    const shown = marked("[[a {{b}} c]]", true);
    expect(shown).toContain("bg-reward-200/70");
    expect(shown).toContain("font-semibold");
    expect(shown).toContain("text-risk-600");
    expect(shown).toContain("decoration-wavy");
  });

  it("renders sibling markers independently", () => {
    const html = marked("[[a]] and {{b}}", true);
    expect(html).toMatch(/^<span><mark class="[^"]*">a<\/mark> and <span class="[^"]*">b<\/span><\/span>$/);
  });

  it("applies className to the wrapper and leaves unmarked text as is", () => {
    expect(marked("plain", false, "text-lead")).toBe('<span class="text-lead">plain</span>');
  });

  it("escapes HTML in the copy", () => {
    expect(marked("a < b & [[c]]", false)).toMatch(/^<span>a &lt; b &amp; <mark class="[^"]*">c<\/mark><\/span>$/);
  });

  it("unmark strips every marker", () => {
    expect(unmark("Look at [[the {{sender}} address]]")).toBe("Look at the sender address");
    expect(unmark("[[a]] {{b}} [[c {{d}}]]")).toBe("a b c d");
    expect(unmark("no markers")).toBe("no markers");
  });
});

describe("formatSyslog", () => {
  const now = new Date("2026-10-18T12:34:56.789Z");
  const header = (pri: number, msgid: string) => `<${pri}>1 2026-10-18T12:34:56.789Z ${hostname()} cyclowareness - ${msgid} -`;

  it("writes an RFC 5424 header with facility local0 and a sanitised msgid", () => {
    expect(formatSyslog("report.created", {}, "json", now).startsWith(`${header(134, "report.created")} `)).toBe(true);
    expect(formatSyslog("threat opened/closed!", {}, "json", now).startsWith(`${header(134, "threat_opened_closed_")} `)).toBe(true);
  });

  it("json format appends the payload as JSON", () => {
    const payload = { tenantId: "t1", data: { severity: "low", note: "a|b=c" } };
    expect(formatSyslog("report.created", payload, "json", now)).toBe(`${header(134, "report.created")} ${JSON.stringify(payload)}`);
  });

  it("cef format writes the CEF header and a flattened extension", () => {
    const payload = {
      tenantId: "tenant-9",
      data: { severity: "high", url: "https://x.y/?a=1", note: "line1\nline2", "weird key!": "v", obj: { k: 1 } },
    };
    expect(formatSyslog("campaign.result", payload, "cef", now)).toBe(
      `${header(130, "campaign.result")} CEF:0|Cyclowareness|Portal|1.0|campaign.result|campaign.result|8|` +
        `rt=${now.getTime()} cs1Label=tenant cs1=tenant-9 cs_severity=high cs_url=https://x.y/?a\\=1 cs_note=line1 line2 cs_weirdkey=v cs_obj={"k":1}`,
    );
  });

  it("escapes | and \\ in CEF header fields and = and \\ in extension values", () => {
    const msg = formatSyslog("a|b\\c", { tenantId: "t=1", data: { path: "C:\\tmp=x" } }, "cef", now);
    expect(msg.startsWith(`${header(134, "a_b_c")} CEF:0|Cyclowareness|Portal|1.0|a\\|b\\\\c|a\\|b\\\\c|4|`)).toBe(true);
    expect(msg).toContain(" cs1=t\\=1 ");
    expect(msg.endsWith(" cs_path=C:\\\\tmp\\=x")).toBe(true);
  });

  it.each([
    ["report.created", "low", 3, 134],
    ["report.created", "medium", 5, 134],
    ["report.created", "high", 8, 130],
    ["report.created", "critical", 10, 130],
    ["report.created", undefined, 4, 134],
    ["report.created", "unknown", 4, 134],
    ["threat.malicious", undefined, 7, 132],
    ["user.risky", undefined, 7, 132],
  ])("%s with severity %s maps to CEF severity %i and PRI %i", (event, severity, sev, pri) => {
    const msg = formatSyslog(event, { tenantId: "t", data: severity ? { severity } : {} }, "cef", now);
    expect(msg.startsWith(`<${pri}>1 `)).toBe(true);
    expect(msg).toContain(`|${event}|${event}|${sev}|rt=`);
  });

  it("always carries the tenant id as cs1, empty when missing", () => {
    expect(formatSyslog("x", {}, "cef", now)).toMatch(/\|4\|rt=\d+ cs1Label=tenant cs1=$/);
  });

  it("strips extension keys to alphanumerics and caps them at 30 characters", () => {
    const msg = formatSyslog("x", { data: { ["k".repeat(40)]: 1, "!!!": 2 } }, "cef", now);
    expect(msg).toContain(` cs_${"k".repeat(27)}=1`);
    expect(msg).not.toContain("=2");
  });
});
