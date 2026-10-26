import { crc32, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { toXlsx } from "@/server/reports/xlsx";

const BOM = "﻿";

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and ends every row, including the last, with CRLF", () => {
    const out = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out).toBe(`${BOM}a,b\r\n1,2\r\n3,4\r\n`);
    expect(out.split("\r\n").join("")).not.toMatch(/[\r\n]/);
  });

  it("quotes cells containing commas, quotes (doubled), newlines and semicolons", () => {
    const out = toCsv(["v"], [["x, y"], ['say "hi"'], ["line1\nline2"], ["cr\r\nlf"], ["a;b"], ["plain"]]);
    expect(out).toBe(`${BOM}v\r\n"x, y"\r\n"say ""hi"""\r\n"line1\nline2"\r\n"cr\r\nlf"\r\n"a;b"\r\nplain\r\n`);
  });

  it("neutralises formula-looking values (= + - @ tab CR) with a leading apostrophe", () => {
    const out = toCsv(["v"], [["=SUM(A1:A9)"], ["+1"], ["-1"], ["@cmd"], ["\tx"], ["\rx"], ["=1,2"]]);
    // A leading tab is not a quoting trigger, a leading CR is.
    expect(out).toBe(`${BOM}v\r\n'=SUM(A1:A9)\r\n'+1\r\n'-1\r\n'@cmd\r\n'\tx\r\n"'\rx"\r\n"'=1,2"\r\n`);
  });

  it("applies the formula guard to negative numbers too (it runs on the stringified value)", () => {
    expect(toCsv(["n"], [[-5], [-0.5]])).toBe(`${BOM}n\r\n'-5\r\n'-0.5\r\n`);
  });

  it("writes null and undefined as empty cells", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, ""], [null, null, null]])).toBe(`${BOM}a,b,c\r\n,,\r\n,,\r\n`);
  });

  it("writes Dates as Baku wall-clock time (what the app shows) and numbers/booleans via String()", () => {
    const d = new Date(Date.UTC(2024, 0, 2, 3, 4, 5, 6));
    expect(toCsv(["d", "n", "f", "z", "b"], [[d, 42, 3.5, 0, true]])).toBe(`${BOM}d,n,f,z,b\r\n2024-01-02 07:04,42,3.5,0,true\r\n`);
    // Late evening UTC is already the next day in Baku (+04:00).
    expect(toCsv(["d"], [[new Date(Date.UTC(2024, 11, 31, 21, 30))]])).toBe(`${BOM}d\r\n2025-01-01 01:30\r\n`);
  });

  it("escapes headers with the same rules as data cells", () => {
    expect(toCsv(["Ad, Soyad", "=x"], [])).toBe(`${BOM}"Ad, Soyad",'=x\r\n`);
  });
});

describe("parseCsv", () => {
  it("parses quoted fields with escaped quotes, embedded commas and newlines", () => {
    expect(parseCsv('a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\n')).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "line1\nline2"],
    ]);
  });

  it("accepts CRLF, LF and lone CR line endings", () => {
    const expected = [["a", "b"], ["1", "2"], ["3", "4"]];
    expect(parseCsv("a,b\r\n1,2\r\n3,4")).toEqual(expected);
    expect(parseCsv("a,b\n1,2\n3,4")).toEqual(expected);
    expect(parseCsv("a,b\r1,2\r3,4")).toEqual(expected);
  });

  it("strips a leading BOM", () => {
    const rows = parseCsv(`${BOM}a,b\n1,2`);
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
    expect(rows[0][0]).toHaveLength(1);
  });

  it("drops the empty trailing line and whitespace-only lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\r\n1,2\r\n\r\n\r\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\n  \n1,2\n,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv(BOM)).toEqual([]);
    expect(parseCsv("\r\n\n")).toEqual([]);
  });

  it("keeps empty cells inside a non-empty row", () => {
    expect(parseCsv("a,b,c\n1,,3\n,,x")).toEqual([["a", "b", "c"], ["1", "", "3"], ["", "", "x"]]);
  });

  it("switches to ; when the first line has more semicolons than commas", () => {
    expect(parseCsv("a;b;c\n1;2;3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
    // A tie keeps the comma.
    expect(parseCsv("a;b,c\n1;2,3")).toEqual([["a;b", "c"], ["1;2", "3"]]);
  });

  it("round-trips ordinary values through toCsv", () => {
    const headers = ["id", "name", "city", "score"];
    const rows = [[1, "Leyla", "Bakı", 9.5], [2, "Рустам", "Gəncə", 7]];
    expect(parseCsv(toCsv(headers, rows))).toEqual([headers, ...rows.map((r) => r.map(String))]);
  });

  it("round-trips values that need quoting", () => {
    const headers = ["a", "b", "c", "d", "e"];
    const rows = [["x, y", 'say "hi"', "l1\nl2", "a;b", "cr\r\nlf"]];
    expect(parseCsv(toCsv(headers, rows))).toEqual([headers, ...rows]);
  });

  it("round-trips a quoted header that contains semicolons", () => {
    // BUG src/lib/csv.ts:6 — the delimiter is sniffed by counting ; and , over the raw first line,
    // including inside quoted fields, so toCsv's own output `"a;b;c",d` selects ; and every row
    // collapses into one field ([["a;b;c,d"], ["1,2"]]). Flip to it() once the sniffing skips quotes.
    expect(parseCsv(toCsv(["a;b;c", "d"], [["1", "2"]]))).toEqual([["a;b;c", "d"], ["1", "2"]]);
  });
});

type LocalEntry = { name: string; flags: number; method: number; crc: number; compressedSize: number; size: number; offset: number; data: Buffer };
type CentralEntry = { name: string; method: number; crc: number; compressedSize: number; size: number; localOffset: number };

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

/** Reads what the writer produces: stored or deflated entries, no data descriptors, no ZIP64. */
function readZip(buf: Buffer) {
  const locals: LocalEntry[] = [];
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === LOCAL_SIG) {
    const flags = buf.readUInt16LE(p + 6);
    const method = buf.readUInt16LE(p + 8);
    const crc = buf.readUInt32LE(p + 14);
    const compressedSize = buf.readUInt32LE(p + 18);
    const size = buf.readUInt32LE(p + 22);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nameLen).toString("utf8");
    if (flags & 0x0008) throw new Error(`${name}: data descriptors are not supported by this reader`);
    if (method !== 0 && method !== 8) throw new Error(`${name}: unsupported compression method ${method}`);
    const start = p + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + compressedSize);
    locals.push({ name, flags, method, crc, compressedSize, size, offset: p, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
    p = start + compressedSize;
  }

  const eocdOffset = buf.lastIndexOf(EOCD_SIG);
  if (eocdOffset < 0) throw new Error("no end-of-central-directory record");
  const eocd = {
    offset: eocdOffset,
    entriesOnDisk: buf.readUInt16LE(eocdOffset + 8),
    entries: buf.readUInt16LE(eocdOffset + 10),
    cdSize: buf.readUInt32LE(eocdOffset + 12),
    cdOffset: buf.readUInt32LE(eocdOffset + 16),
    commentLength: buf.readUInt16LE(eocdOffset + 20),
  };

  const centrals: CentralEntry[] = [];
  let c = eocd.cdOffset;
  for (let i = 0; i < eocd.entries; i++) {
    if (buf.readUInt32LE(c) !== CENTRAL_SIG) throw new Error(`bad central directory signature at ${c}`);
    const nameLen = buf.readUInt16LE(c + 28);
    const extraLen = buf.readUInt16LE(c + 30);
    const commentLen = buf.readUInt16LE(c + 32);
    centrals.push({
      name: buf.subarray(c + 46, c + 46 + nameLen).toString("utf8"),
      method: buf.readUInt16LE(c + 10),
      crc: buf.readUInt32LE(c + 16),
      compressedSize: buf.readUInt32LE(c + 20),
      size: buf.readUInt32LE(c + 24),
      localOffset: buf.readUInt32LE(c + 42),
    });
    c += 46 + nameLen + extraLen + commentLen;
  }
  return { locals, centrals, eocd, localsEnd: p, centralEnd: c };
}

function parts(buf: Buffer): Record<string, string> {
  return Object.fromEntries(readZip(buf).locals.map((e) => [e.name, e.data.toString("utf8")]));
}

const PART_NAMES = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml", "xl/styles.xml"];
const WHEN = new Date(Date.UTC(2024, 0, 2, 12, 0, 0));
const HEADERS = ["Name", "Score", "When", "Active", "Note"];
const ROWS = [
  ["Ali & Co <x>", 42, WHEN, true, null],
  ["Plain", 3.5, undefined, false, ""],
];

describe("toXlsx", () => {
  const book = toXlsx("Report", HEADERS, ROWS);

  it("is a ZIP whose local headers, central directory and end record agree", () => {
    const { locals, centrals, eocd, localsEnd, centralEnd } = readZip(book);
    expect(locals.map((e) => e.name)).toEqual(PART_NAMES);
    expect(eocd.entries).toBe(locals.length);
    expect(eocd.entriesOnDisk).toBe(locals.length);
    expect(eocd.cdOffset).toBe(localsEnd);
    expect(eocd.cdSize).toBe(eocd.offset - eocd.cdOffset);
    expect(centralEnd).toBe(eocd.offset);
    expect(eocd.commentLength).toBe(0);
    expect(eocd.offset + 22).toBe(book.length);
    expect(centrals.map((e) => e.name)).toEqual(PART_NAMES);
    centrals.forEach((central, i) => {
      const local = locals[i];
      expect(central.localOffset, local.name).toBe(local.offset);
      expect(central.method, local.name).toBe(local.method);
      expect(central.crc, local.name).toBe(local.crc);
      expect(central.compressedSize, local.name).toBe(local.compressedSize);
      expect(central.size, local.name).toBe(local.size);
    });
  });

  it("deflates every entry without data descriptors and stores a matching CRC32 and size", () => {
    for (const e of readZip(book).locals) {
      expect(e.method, e.name).toBe(8);
      expect(e.flags, e.name).toBe(0x0800);
      expect(e.data.length, e.name).toBe(e.size);
      expect(crc32(e.data) >>> 0, e.name).toBe(e.crc);
    }
  });

  it("contains the required package parts wired together by relationships", () => {
    const p = parts(book);
    for (const name of PART_NAMES) expect(p[name], name).toMatch(/^<\?xml version="1.0" encoding="UTF-8" standalone="yes"\?>/);
    expect(p["[Content_Types].xml"]).toContain('<Default Extension="rels"');
    expect(p["[Content_Types].xml"]).toContain('PartName="/xl/workbook.xml"');
    expect(p["[Content_Types].xml"]).toContain('PartName="/xl/worksheets/sheet1.xml"');
    expect(p["[Content_Types].xml"]).toContain('PartName="/xl/styles.xml"');
    expect(p["_rels/.rels"]).toContain('Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"');
    expect(p["xl/workbook.xml"]).toContain('<sheet name="Report" sheetId="1" r:id="rId1"/>');
    expect(p["xl/_rels/workbook.xml.rels"]).toContain('Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"');
    expect(p["xl/_rels/workbook.xml.rels"]).toContain('Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"');
  });

  it("maps style 2 (dates) to the yyyy-mm-dd hh:mm number format", () => {
    const styles = parts(book)["xl/styles.xml"];
    expect(styles).toContain('<numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/>');
    expect(styles).toMatch(/<cellXfs count="3">(<xf [^>]*\/>){2}<xf numFmtId="164"[^>]*applyNumberFormat="1"\/><\/cellXfs>/);
  });

  describe("worksheet", () => {
    const sheet = parts(book)["xl/worksheets/sheet1.xml"];
    const row = (n: number) => sheet.match(new RegExp(`<row r="${n}">(.*?)</row>`))?.[1] ?? "";

    it("writes headers as bold inline strings in row 1", () => {
      HEADERS.forEach((h, i) => expect(row(1)).toContain(`<c r="${String.fromCharCode(65 + i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${h}</t></is></c>`));
    });

    it("writes strings as inline strings with & < > escaped", () => {
      expect(row(2)).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Ali &amp; Co &lt;x&gt;</t></is></c>');
      expect(row(3)).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">Plain</t></is></c>');
      expect(sheet).not.toContain("Ali & Co");
    });

    it("writes numbers as numeric cells", () => {
      expect(row(2)).toContain('<c r="B2"><v>42</v></c>');
      expect(row(3)).toContain('<c r="B3"><v>3.5</v></c>');
    });

    it("writes dates as Excel serial days in Baku time (+04:00) with the date style", () => {
      // 12:00 UTC is 16:00 in Baku: two thirds of 2 January 2024 (serial 45293).
      const serial = (WHEN.getTime() + 4 * 3_600_000) / 86_400_000 + 25569;
      expect(serial).toBeCloseTo(45293 + 16 / 24, 9);
      expect(row(2)).toContain(`<c r="C2" s="2"><v>${serial}</v></c>`);
    });

    it("writes booleans as t=\"b\" cells", () => {
      expect(row(2)).toContain('<c r="D2" t="b"><v>1</v></c>');
      expect(row(3)).toContain('<c r="D3" t="b"><v>0</v></c>');
    });

    it("omits null, undefined and empty-string cells", () => {
      expect(row(2).match(/<c /g)).toHaveLength(4);
      expect(row(2)).not.toContain('r="E2"');
      expect(row(3).match(/<c /g)).toHaveLength(3);
      expect(row(3)).not.toContain('r="C3"');
      expect(row(3)).not.toContain('r="E3"');
      expect(sheet).not.toContain('<row r="4">');
    });

    it("freezes the header row and filters the used range", () => {
      expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
      expect(sheet).toContain('<autoFilter ref="A1:E3"/>');
    });
  });

  it("escapes quotes and drops XML-illegal control characters in text, keeping tabs", () => {
    const sheet = parts(toXlsx("S", ["h"], [['say "hi"\u0000\u0007 ok\ttab']]))["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<t xml:space="preserve">say &quot;hi&quot; ok\ttab</t>');
  });

  it("writes non-finite numbers as text", () => {
    const sheet = parts(toXlsx("S", ["a", "b"], [[NaN, Infinity]]))["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">NaN</t></is></c>');
    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">Infinity</t></is></c>');
  });

  it("names columns past Z as AA, AB, …", () => {
    const headers = Array.from({ length: 28 }, (_, i) => `h${i}`);
    const sheet = parts(toXlsx("S", headers, []))["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<c r="Z1" t="inlineStr" s="1">');
    expect(sheet).toContain('<c r="AA1" t="inlineStr" s="1">');
    expect(sheet).toContain('<c r="AB1" t="inlineStr" s="1">');
    expect(sheet).toContain('<col min="28" max="28" width="5" customWidth="1"/>');
    expect(sheet).toContain('<autoFilter ref="A1:AB1"/>');
  });

  it("sizes columns from the longest text (+2) and caps them at 60", () => {
    const sheet = parts(toXlsx("S", ["ab", "x", "long"], [["abcdef", "y".repeat(100), null]]))["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain('<col min="1" max="1" width="8" customWidth="1"/>');
    expect(sheet).toContain('<col min="2" max="2" width="60" customWidth="1"/>');
    expect(sheet).toContain('<col min="3" max="3" width="6" customWidth="1"/>');
  });

  describe("sheet name", () => {
    const nameOf = (s: string) => parts(toXlsx(s, ["h"], []))["xl/workbook.xml"].match(/<sheet name="([^"]*)"/)?.[1];

    it("replaces the characters Excel forbids (\\ / ? * [ ] :) with spaces", () => {
      expect(nameOf("Q1/Q2: Sales*?[x]\\y")).toBe("Q1 Q2  Sales   x  y");
    });

    it("truncates to 31 characters before XML-escaping", () => {
      expect(nameOf("x".repeat(40))).toBe("x".repeat(31));
      expect(nameOf("x".repeat(30) + "&&&")).toBe("x".repeat(30) + "&amp;");
    });

    it("XML-escapes & < > and quotes", () => {
      expect(nameOf('A & B <C> "D"')).toBe("A &amp; B &lt;C&gt; &quot;D&quot;");
    });

    it("falls back to Report for an empty name", () => {
      expect(nameOf("")).toBe("Report");
    });
  });
});
