import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/i18n/config";
import { PASSWORD_MIN_LENGTH } from "../src/server/auth/password";

/*
 * /legal/[doc] serves content/legal/{doc}.{lang}.md and falls back to the binding az text. A translation
 * must be the same edition as the az text, clause for clause, or the page would show an outdated one.
 */
const read = (doc: string, lang: string) => readFileSync(path.join(__dirname, "..", "content", "legal", `${doc}.${lang}.md`), "utf8").replace(/\r/g, "");
const shape = (source: string) => ({
  edition: /^<!--\s*version:\s*\d+;\s*effective:\s*\d{4}-\d{2}-\d{2}\s*-->/.exec(source)?.[0],
  sections: source.match(/^## .+$/gm)?.length,
  clauses: source.match(/^\d+\.\d+\./gm),
});

describe.each(["privacy", "terms"])("legal %s", (doc) => {
  const az = shape(read(doc, "az"));
  it("has a versioned az text", () => {
    expect(az.edition).toBeTruthy();
    expect(az.clauses?.length).toBeGreaterThan(10);
  });
  it.each(LOCALES.filter((l) => l !== "az"))("%s matches the az edition and clause numbers", (lang) => {
    expect(shape(read(doc, lang))).toEqual(az);
  });
});

// Terms 4.2 states the password minimum; it must be the one the sign-in code enforces.
it.each(LOCALES)("terms 4.2 in %s names the enforced password minimum", (lang) => {
  expect(/^4\.2\..*$/m.exec(read("terms", lang))?.[0]?.match(/\d+/g)).toContain(String(PASSWORD_MIN_LENGTH));
});
