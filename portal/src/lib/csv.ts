/** RFC 4180 CSV parsing and writing (quotes, embedded commas and newlines, ; or , delimiter). */
import { zonedParts } from "./baku-clock";
import { DEFAULT_TIME_ZONE } from "./day";

/**
 * A people import travels as a Server Action argument, under Next's 1 MB request body limit, and the body carries the
 * file JSON-escaped (quotes and line breaks doubled): the cap is measured on that form, with room for the rest of the
 * request. The 5,000-row cap still applies.
 */
export const IMPORT_MAX_BYTES = 900_000;
export const importTooBig = (csv: string) => new Blob([JSON.stringify(csv)]).size > IMPORT_MAX_BYTES;

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // Sniff the delimiter outside quoted fields only ("a;b;c",d is comma-separated).
  const unquoted = firstLine.replace(/"(?:[^"]|"")*"/g, "");
  const delimiter = (unquoted.match(/;/g)?.length ?? 0) > (unquoted.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/** A moment as the organisation's wall-clock time, "2026-10-25 12:13": what the app shows, and what spreadsheets read as a date in any language. */
function zonedDateTime(d: Date, timeZone: string): string {
  const p = zonedParts(d, timeZone);
  return `${p.date} ${p.time}`;
}

function cell(v: unknown, timeZone: string): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? zonedDateTime(v, timeZone) : String(v);
  // Neutralise spreadsheet formulas (CSV injection). An international phone number (+ and digits
  // only) cannot call anything, and the apostrophe would end up in the number when the file comes back.
  if (/^[=+\-@\t\r]/.test(s) && !/^\+\d{8,15}$/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM so Excel opens Azerbaijani and Russian text correctly; dates and times in `timeZone`, the organisation's. */
export function toCsv(headers: string[], rows: unknown[][], timeZone = DEFAULT_TIME_ZONE): string {
  return "﻿" + [headers, ...rows].map((r) => r.map((v) => cell(v, timeZone)).join(",")).join("\r\n") + "\r\n";
}
