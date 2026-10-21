/**
 * Static analysis for suspicious links and files. Nothing is executed or opened in a browser,
 * nothing is fetched from the network and file bytes are never stored: only the SHA-256,
 * the findings and the extracted indicators are kept.
 */
import { createHash, randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import type { Ioc, SandboxFinding } from "../db/schema";

export type Verdict = "clean" | "suspicious" | "malicious";

export type Analysis = {
  kind: "url" | "file";
  objectName: string;
  sha256: string | null;
  sizeBytes: number | null;
  verdict: Verdict;
  score: number;
  findings: SandboxFinding[];
  iocs: Ioc[];
  mitre: string[];
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const RISKY_TLDS = new Set([
  "top", "xyz", "info", "click", "zip", "mov", "icu", "buzz", "shop", "live", "cfd", "sbs", "rest", "gq", "tk", "ml", "cf", "ga", "work", "support", "online", "site", "lol", "monster",
]);
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "goo.gl", "ow.ly", "s.id", "shorturl.at", "t.ly"]);
/** Brand keyword -> registrable domains that legitimately use it. */
const BRANDS: Record<string, string[]> = {
  microsoft: ["microsoft.com", "microsoftonline.com", "live.com", "office.com"],
  m365: ["microsoft.com", "office.com"],
  office365: ["office.com", "microsoft.com"],
  outlook: ["outlook.com", "live.com", "office.com"],
  sharepoint: ["sharepoint.com"],
  google: ["google.com", "google.az"],
  apple: ["apple.com", "icloud.com"],
  paypal: ["paypal.com"],
  docusign: ["docusign.com", "docusign.net"],
  azercell: ["azercell.com"],
  mygov: ["my.gov.az", "gov.az"],
  asan: ["asan.gov.az", "gov.az"],
  kapital: ["kapitalbank.az"],
  dhl: ["dhl.com"],
  fedex: ["fedex.com"],
  azerpost: ["azerpost.az"],
};
const LURE_WORDS = ["login", "signin", "sign-in", "verify", "verification", "account", "update", "secure", "password", "wallet", "invoice", "payment", "giris", "tesdiq", "yenile", "kabinet", "odenis"];
const EXECUTABLE_EXT = new Set(["exe", "scr", "com", "pif", "bat", "cmd", "msi", "dll", "cpl", "jar", "hta", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "lnk", "url", "iso", "img", "vhd", "vhdx", "one", "reg", "appx", "msix"]);
const DOCUMENT_EXT = new Set(["pdf", "doc", "docx", "docm", "xls", "xlsx", "xlsm", "ppt", "pptx", "pptm", "txt", "rtf", "jpg", "jpeg", "png", "gif", "csv", "odt"]);
const MACRO_EXT = new Set(["docm", "xlsm", "pptm", "dotm", "xltm", "xlam"]);
const POWERSHELL_MARKERS = [/powershell/i, /-enc(odedcommand)?\s/i, /\bIEX\b/, /Invoke-Expression/i, /FromBase64String/i, /DownloadString/i, /Net\.WebClient/i, /-ExecutionPolicy\s+Bypass/i, /-w(indowstyle)?\s+hidden/i];
const SCRIPT_HOST_MARKERS = [/WScript\.Shell/i, /ActiveXObject/i, /Shell\.Application/i, /mshta/i, /rundll32/i, /regsvr32/i, /certutil\s+-urlcache/i, /bitsadmin/i];

function finding(id: string, severity: SandboxFinding["severity"], weight: number, params?: SandboxFinding["params"]): SandboxFinding {
  return { id, severity, weight, ...(params ? { params } : {}) };
}

function verdictFor(score: number): Verdict {
  if (score >= 70) return "malicious";
  if (score >= 35) return "suspicious";
  return "clean";
}

function finish(base: Omit<Analysis, "verdict" | "score" | "mitre">, mitre: Set<string>): Analysis {
  const raw = base.findings.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.max(0, Math.min(100, raw));
  const seen = new Set<string>();
  const iocs = base.iocs.filter((i) => {
    const key = `${i.type}:${i.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...base, iocs, score, verdict: verdictFor(score), mitre: [...mitre].sort() };
}

/** Rough registrable domain: last two labels, or three for second-level ccTLDs (gov.az, co.uk…). */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  const sld = labels[labels.length - 2];
  const secondLevel = ["gov", "com", "co", "org", "net", "edu", "ac", "mil"].includes(sld) && labels[labels.length - 1].length === 2;
  return labels.slice(secondLevel ? -3 : -2).join(".");
}

export { defang } from "../../lib/defang";

function isIp(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
}

export function analyzeUrl(input: string): Analysis {
  const findings: SandboxFinding[] = [];
  const iocs: Ioc[] = [];
  const mitre = new Set<string>(["T1566.002"]);
  const raw = input.trim();

  if (/^(javascript|data|vbscript):/i.test(raw)) {
    findings.push(finding("url.script_scheme", "high", 60));
    mitre.add("T1059.007");
    return finish({ kind: "url", objectName: raw.slice(0, 300), sha256: null, sizeBytes: null, findings, iocs }, mitre);
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    findings.push(finding("url.unparseable", "medium", 20));
    return finish({ kind: "url", objectName: raw.slice(0, 300), sha256: null, sizeBytes: null, findings, iocs }, mitre);
  }

  const rawHost = withScheme.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/?#]/)[0].split("@").pop()!.split(":")[0];
  const host = url.hostname.toLowerCase();
  const domain = registrableDomain(host);
  const tld = host.split(".").pop() ?? "";

  iocs.push({ type: "url", value: url.href });
  if (isIp(host)) iocs.push({ type: "ip", value: host.replace(/^\[|\]$/g, "") });
  else iocs.push({ type: "domain", value: host });

  if (url.protocol === "http:") findings.push(finding("url.no_tls", "medium", 12));
  if (url.username || url.password || /@/.test(withScheme.split("/").slice(0, 3).join("/"))) {
    findings.push(finding("url.userinfo_redirect", "high", 30));
  }
  if (isIp(host)) findings.push(finding("url.ip_host", "high", 28));
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    findings.push(finding("url.punycode", "high", 30));
    mitre.add("T1583.001");
  }
  // A capital "I" inside an otherwise lower-case host usually poses as a lower-case "l".
  if (/I/.test(rawHost) && rawHost !== rawHost.toUpperCase()) {
    findings.push(finding("url.homoglyph_case", "high", 25, { host: rawHost }));
    mitre.add("T1583.001");
  }
  if (RISKY_TLDS.has(tld)) findings.push(finding("url.risky_tld", "medium", 18, { tld }));
  if (SHORTENERS.has(host)) findings.push(finding("url.shortener", "medium", 15, { host }));
  if (host.split(".").length > 4) findings.push(finding("url.deep_subdomains", "low", 8));
  if (url.port && !["80", "443"].includes(url.port)) findings.push(finding("url.odd_port", "low", 8, { port: url.port }));
  if (raw.length > 140) findings.push(finding("url.long", "low", 5));

  for (const [brand, legit] of Object.entries(BRANDS)) {
    const inHost = host.includes(brand);
    if (inHost && !legit.some((d) => domain === d || host.endsWith(`.${d}`) || host === d)) {
      findings.push(finding("url.brand_lookalike", "high", 32, { brand }));
      mitre.add("T1583.001");
      mitre.add("T1056.003");
      break;
    }
  }
  const pathLower = `${url.pathname}${url.search}`.toLowerCase();
  const lure = LURE_WORDS.find((w) => host.includes(w) || pathLower.includes(w));
  if (lure) findings.push(finding("url.lure_words", "low", 10, { word: lure }));
  if (/(\.(pdf|docx?|xlsx?|jpg|png))\.(exe|scr|js|hta|vbs|lnk|iso|zip)(\b|$)/i.test(url.pathname)) {
    findings.push(finding("url.double_extension", "high", 30));
    mitre.add("T1036.007");
  }
  if (/\.(exe|scr|msi|hta|vbs|js|lnk|iso|img|one)$/i.test(url.pathname)) {
    findings.push(finding("url.direct_download", "high", 25));
    mitre.add("T1204.002");
  }
  if (/(redirect|url|next|goto|target)=https?%3A|=(https?:\/\/)/i.test(url.search)) findings.push(finding("url.open_redirect", "medium", 12));
  if (/%[0-9a-f]{2}/i.test(url.hostname)) findings.push(finding("url.encoded_host", "medium", 15));

  if (findings.length > 0) mitre.add("T1204.001");
  return finish({ kind: "url", objectName: url.href, sha256: null, sizeBytes: null, findings, iocs }, mitre);
}

/* ───────────── files ───────────── */

type ZipEntry = { name: string; encrypted: boolean; method: number; compSize: number; size: number; localOffset: number };

function readZipEntries(buf: Buffer): ZipEntry[] | null {
  const min = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0 || eocd + 22 > buf.length) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count && n < 5000; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    if (p + 46 + nameLen > buf.length) break;
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    entries.push({ name, encrypted: (flags & 1) === 1, method, compSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipText(buf: Buffer, entry: ZipEntry): string | null {
  if (entry.encrypted || entry.size > 2_000_000) return null;
  const p = entry.localOffset;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) return null;
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + entry.compSize);
  try {
    if (entry.method === 0) return data.toString("utf8");
    if (entry.method === 8) return inflateRawSync(data, { maxOutputLength: 4_000_000 }).toString("utf8");
  } catch {
    return null;
  }
  return null;
}

function detectType(buf: Buffer): string {
  // Pad so the magic-number reads below never run past a tiny upload.
  const h = buf.length >= 8 ? buf.subarray(0, 8) : Buffer.concat([buf, Buffer.alloc(8 - buf.length)]);
  if (h[0] === 0x4d && h[1] === 0x5a) return "pe";
  if (h.readUInt32LE(0) === 0x0000004c && buf.length > 20 && buf[4] === 0x01 && buf[5] === 0x14) return "lnk";
  if (h.toString("latin1", 0, 4) === "%PDF") return "pdf";
  if (h[0] === 0x50 && h[1] === 0x4b && (h[2] === 0x03 || h[2] === 0x05)) return "zip";
  if (h[0] === 0xd0 && h[1] === 0xcf && h[2] === 0x11 && h[3] === 0xe0) return "ole";
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return "jpeg";
  if (h.toString("latin1", 1, 4) === "PNG") return "png";
  if (h.toString("latin1", 0, 3) === "GIF") return "gif";
  if (h.toString("latin1", 0, 5) === "{\\rtf") return "rtf";
  if (h[0] === 0x52 && h[1] === 0x61 && h[2] === 0x72 && h[3] === 0x21) return "rar";
  if (h[0] === 0x37 && h[1] === 0x7a && h[2] === 0xbc && h[3] === 0xaf) return "7z";
  if (buf.length > 0x8006 && buf.toString("latin1", 0x8001, 0x8006) === "CD001") return "iso";
  const head = buf.subarray(0, 2048).toString("utf8").toLowerCase();
  if (head.includes("<html") || head.includes("<!doctype html") || head.includes("<script")) return "html";
  return "unknown";
}

const TYPE_FOR_EXT: Record<string, string[]> = {
  pdf: ["pdf"],
  docx: ["zip"], xlsx: ["zip"], pptx: ["zip"], docm: ["zip"], xlsm: ["zip"], zip: ["zip"],
  doc: ["ole"], xls: ["ole"], ppt: ["ole"],
  jpg: ["jpeg"], jpeg: ["jpeg"], png: ["png"], gif: ["gif"], rtf: ["rtf"],
  html: ["html", "unknown"], htm: ["html", "unknown"], txt: ["unknown", "html"], csv: ["unknown"],
};

function entropy(buf: Buffer): number {
  const sample = buf.subarray(0, Math.min(buf.length, 262_144));
  if (sample.length === 0) return 0;
  const counts = new Array<number>(256).fill(0);
  for (const b of sample) counts[b]++;
  let e = 0;
  for (const c of counts) if (c) e -= (c / sample.length) * Math.log2(c / sample.length);
  return e;
}

function extractIndicators(text: string, iocs: Ioc[]) {
  const urls = text.match(/https?:\/\/[^\s"'<>()\\]{4,200}/gi) ?? [];
  for (const u of urls.slice(0, 25)) {
    iocs.push({ type: "url", value: u });
    try {
      iocs.push({ type: "domain", value: new URL(u).hostname });
    } catch {
      /* ignore malformed */
    }
  }
  const emails = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  for (const e of emails.slice(0, 10)) iocs.push({ type: "email", value: e.toLowerCase() });
}

export function analyzeFile(fileName: string, bytes: Buffer): Analysis {
  const findings: SandboxFinding[] = [];
  const iocs: Ioc[] = [];
  const mitre = new Set<string>();
  const name = fileName.normalize("NFC").slice(0, 255);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  iocs.push({ type: "sha256", value: sha256 });
  iocs.push({ type: "filename", value: name });

  const parts = name.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  const prev = parts.length > 2 ? parts[parts.length - 2] : "";

  if (/[‮‭‎‏]/.test(name)) {
    findings.push(finding("file.rtlo", "high", 35));
    mitre.add("T1036.002");
  }
  if (prev && DOCUMENT_EXT.has(prev) && EXECUTABLE_EXT.has(ext)) {
    findings.push(finding("file.double_extension", "high", 35, { shown: prev, real: ext }));
    mitre.add("T1036.007");
  } else if (prev && DOCUMENT_EXT.has(prev) && (ext === "zip" || ext === "rar" || ext === "7z")) {
    findings.push(finding("file.disguised_archive", "medium", 15, { shown: prev, real: ext }));
  }
  if (EXECUTABLE_EXT.has(ext)) {
    const highRisk = ["lnk", "iso", "img", "vhd", "vhdx", "one", "hta", "js", "jse", "vbs", "vbe", "wsf", "ps1", "scr"].includes(ext);
    findings.push(finding("file.risky_type", "high", highRisk ? 30 : 25, { ext }));
    mitre.add("T1204.002");
  }
  if (MACRO_EXT.has(ext)) {
    findings.push(finding("file.macro_container", "medium", 15, { ext }));
  }

  const type = detectType(bytes);
  const expected = TYPE_FOR_EXT[ext];
  if (expected && !expected.includes(type) && type !== "unknown") {
    findings.push(finding("file.type_mismatch", "high", 35, { ext, actual: type }));
    mitre.add("T1036.008");
  }
  if (type === "pe") {
    findings.push(finding("file.pe_executable", "high", 30));
    mitre.add("T1204.002");
  }

  const latin = bytes.subarray(0, Math.min(bytes.length, 4_000_000)).toString("latin1");
  const textual = bytes.subarray(0, Math.min(bytes.length, 4_000_000)).toString("utf8");

  if (type === "lnk") {
    findings.push(finding("file.lnk", "high", 30));
    mitre.add("T1204.002");
    // LNK arguments are stored as UTF-16LE.
    const wide = bytes.toString("utf16le");
    if (POWERSHELL_MARKERS.some((r) => r.test(wide) || r.test(latin))) {
      findings.push(finding("file.powershell", "high", 30));
      mitre.add("T1059.001");
    }
    if (SCRIPT_HOST_MARKERS.some((r) => r.test(wide) || r.test(latin))) {
      findings.push(finding("file.lolbin", "high", 20));
      mitre.add("T1218");
    }
    extractIndicators(wide, iocs);
  }

  if (type === "iso") {
    findings.push(finding("file.disk_image", "medium", 20));
    mitre.add("T1553.005");
  }

  if (type === "pdf") {
    if (/\/JavaScript|\/JS\s*[(<]/.test(latin)) {
      findings.push(finding("file.pdf_javascript", "high", 28));
      mitre.add("T1059.007");
    }
    if (/\/OpenAction|\/AA\s*<</.test(latin)) findings.push(finding("file.pdf_autoaction", "medium", 12));
    if (/\/Launch/.test(latin)) {
      findings.push(finding("file.pdf_launch", "high", 30));
      mitre.add("T1204.002");
    }
    if (/\/EmbeddedFile/.test(latin)) findings.push(finding("file.pdf_embedded", "medium", 12));
    if (/\/URI\s*\(/.test(latin)) {
      const links = latin.match(/\/URI\s*\(([^)]{4,300})\)/g) ?? [];
      for (const l of links.slice(0, 20)) extractIndicators(l, iocs);
    }
  }

  if (type === "zip") {
    const entries = readZipEntries(bytes) ?? [];
    const names = entries.map((e) => e.name.toLowerCase());
    if (names.some((n) => n.endsWith("vbaproject.bin"))) {
      findings.push(finding("file.office_macros", "high", 30));
      mitre.add("T1059.005");
      mitre.add("T1204.002");
    }
    const rels = entries.find((e) => /_rels\/settings\.xml\.rels$/i.test(e.name));
    const relsText = rels ? readZipText(bytes, rels) : null;
    if (relsText && /attachedTemplate[^>]+TargetMode="External"/i.test(relsText)) {
      findings.push(finding("file.remote_template", "high", 30));
      mitre.add("T1221");
      // Only the external template address is an indicator, not the OOXML schema namespaces.
      extractIndicators(relsText.replace(/schemas\.(openxmlformats|microsoft)\.org[^"']*/g, ""), iocs);
    }
    const inner = entries.filter((e) => {
      const n = e.name.toLowerCase();
      const x = n.split(".").pop() ?? "";
      return EXECUTABLE_EXT.has(x) && !n.startsWith("word/") && !n.startsWith("xl/") && !n.startsWith("ppt/");
    });
    if (inner.length > 0) {
      findings.push(finding("file.archive_executable", "high", 30, { name: inner[0].name.slice(0, 80) }));
      mitre.add("T1204.002");
      for (const e of inner.slice(0, 5)) iocs.push({ type: "filename", value: e.name.slice(0, 120) });
    }
    if (entries.some((e) => e.encrypted)) {
      findings.push(finding("file.encrypted_archive", "medium", 15));
      mitre.add("T1027.013");
    }
    for (const e of entries.filter((x) => /\.(xml|rels|html?|js|txt)$/i.test(x.name)).slice(0, 12)) {
      const txt = readZipText(bytes, e);
      if (txt) extractIndicators(txt.replace(/schemas\.(openxmlformats|microsoft)\.org[^"']*/g, ""), iocs);
    }
  }

  if (type === "ole") {
    if (/_VBA_PROJECT|VBA\x00|Macros|ThisDocument|AutoOpen|Document_Open|Workbook_Open/i.test(latin)) {
      findings.push(finding("file.office_macros", "high", 30));
      mitre.add("T1059.005");
    }
  }

  if (type === "html" || ext === "html" || ext === "htm" || ext === "svg") {
    const lower = textual.toLowerCase();
    const hasPassword = /<input[^>]+type=["']?password/i.test(textual);
    const formAction = textual.match(/<form[^>]+action=["']?(https?:\/\/[^"'\s>]+)/i);
    if (hasPassword) {
      findings.push(finding("file.html_credential_form", "high", 32));
      mitre.add("T1056.003");
      mitre.add("T1566.001");
    }
    if (formAction) {
      findings.push(finding("file.html_external_post", "high", 20, { host: (() => { try { return new URL(formAction[1]).hostname; } catch { return "?"; } })() }));
    }
    if (/\batob\(|\beval\(|unescape\(|String\.fromCharCode\(|document\.write\(/.test(textual)) {
      findings.push(finding("file.obfuscated_script", "medium", 15));
      mitre.add("T1027");
    }
    if (/new\s+Blob\(|msSaveOrOpenBlob|URL\.createObjectURL/.test(textual) && /download\s*=/.test(lower)) {
      findings.push(finding("file.html_smuggling", "high", 30));
      mitre.add("T1027.006");
    }
    if (/http-equiv=["']?refresh|window\.location(\.href)?\s*=/.test(lower)) findings.push(finding("file.redirect", "medium", 10));
    extractIndicators(textual, iocs);
  }

  if (["js", "jse", "vbs", "vbe", "wsf", "hta", "ps1", "bat", "cmd"].includes(ext) || type === "unknown") {
    if (POWERSHELL_MARKERS.some((r) => r.test(textual)) && !findings.some((f) => f.id === "file.powershell")) {
      findings.push(finding("file.powershell", "high", 30));
      mitre.add("T1059.001");
    }
    if (SCRIPT_HOST_MARKERS.some((r) => r.test(textual)) && !findings.some((f) => f.id === "file.lolbin")) {
      findings.push(finding("file.lolbin", "high", 20));
      mitre.add(ext === "hta" ? "T1218.005" : "T1059.005");
    }
    if (type === "unknown") extractIndicators(textual.slice(0, 200_000), iocs);
  }

  const e = entropy(bytes);
  if (e > 7.6 && !["zip", "jpeg", "png", "gif", "pdf", "7z", "rar"].includes(type) && bytes.length > 4096) {
    findings.push(finding("file.high_entropy", "low", 8, { entropy: Math.round(e * 100) / 100 }));
    mitre.add("T1027.002");
  }

  if (findings.length === 0) findings.push(finding("file.no_findings", "info", 0));
  return finish({ kind: "file", objectName: name, sha256, sizeBytes: bytes.length, findings, iocs }, mitre);
}

/** STIX 2.1 bundle with one indicator per IOC, for SIEM / TIP import. */
export function toStix(a: Pick<Analysis, "objectName" | "verdict" | "iocs" | "mitre">, created: Date, number: string) {
  const now = created.toISOString();
  const identityId = `identity--${randomUUID()}`;
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const pattern = (i: Ioc): string | null => {
    switch (i.type) {
      case "url":
        return `[url:value = '${esc(i.value)}']`;
      case "domain":
        return `[domain-name:value = '${esc(i.value)}']`;
      case "ip":
        return `[${i.value.includes(":") ? "ipv6-addr" : "ipv4-addr"}:value = '${esc(i.value)}']`;
      case "sha256":
        return `[file:hashes.'SHA-256' = '${i.value}']`;
      case "email":
        return `[email-addr:value = '${esc(i.value)}']`;
      case "filename":
        return `[file:name = '${esc(i.value)}']`;
    }
  };
  const indicators = a.iocs.flatMap((i) => {
    const p = pattern(i);
    if (!p) return [];
    return [
      {
        type: "indicator",
        spec_version: "2.1",
        id: `indicator--${randomUUID()}`,
        created_by_ref: identityId,
        created: now,
        modified: now,
        name: `${number} ${i.type}`,
        indicator_types: [a.verdict === "malicious" ? "malicious-activity" : "anomalous-activity"],
        pattern: p,
        pattern_type: "stix",
        valid_from: now,
        // STIX 2.1 forbids empty lists, so a clean analysis (no techniques) omits labels entirely.
        ...(a.mitre.length ? { labels: a.mitre } : {}),
      },
    ];
  });
  return {
    type: "bundle",
    id: `bundle--${randomUUID()}`,
    objects: [
      { type: "identity", spec_version: "2.1", id: identityId, created: now, modified: now, name: "Sandbox", identity_class: "system" },
      ...indicators,
    ],
  };
}
