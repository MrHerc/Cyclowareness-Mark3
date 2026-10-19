import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { NAMESPACES } from "@/i18n/messages";
import { LOCALES } from "@/i18n/config";

const dir = path.join(process.cwd(), "messages");

function flatten(obj: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (Array.isArray(obj)) {
    out.set(prefix, `array:${obj.length}`);
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`).forEach((val, k) => out.set(k, val)));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k).forEach((val, key) => out.set(key, val));
  } else out.set(prefix, obj);
  return out;
}

function load(locale: string, ns: string) {
  return JSON.parse(fs.readFileSync(path.join(dir, locale, `${ns}.json`), "utf8"));
}

/** ICU placeholders such as {count} or {name}, ignoring plural/select branches. */
function placeholders(msg: string): string[] {
  return [...msg.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort();
}

describe("translations", () => {
  for (const ns of NAMESPACES) {
    const en = flatten(load("en", ns));
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      it(`${locale}/${ns} has the same keys as en`, () => {
        const other = flatten(load(locale, ns));
        expect([...other.keys()].filter((k) => !en.has(k)), "extra keys").toEqual([]);
        expect([...en.keys()].filter((k) => !other.has(k)), "missing keys").toEqual([]);
      });
      it(`${locale}/${ns} uses the same placeholders and valid ICU`, () => {
        const other = flatten(load(locale, ns));
        for (const [key, value] of en) {
          const o = other.get(key);
          if (typeof value !== "string" || typeof o !== "string") continue;
          expect(placeholders(o), `${locale}/${ns}:${key}`).toEqual(placeholders(value));
          expect(() => new IntlMessageFormat(o, locale), `${locale}/${ns}:${key}`).not.toThrow();
        }
      });
    }
    it(`en/${ns} keys contain no dots (next-intl uses them for nesting)`, () => {
      const bad: string[] = [];
      const walk = (o: unknown, at: string) => {
        if (!o || typeof o !== "object" || Array.isArray(o)) return;
        for (const [k, v] of Object.entries(o)) {
          if (k.includes(".")) bad.push(`${at}${k}`);
          walk(v, `${at}${k}/`);
        }
      };
      walk(load("en", ns), "");
      expect(bad).toEqual([]);
    });
    it(`en/${ns} is valid ICU`, () => {
      for (const [key, value] of en) if (typeof value === "string") expect(() => new IntlMessageFormat(value, "en"), key).not.toThrow();
    });
  }
});
