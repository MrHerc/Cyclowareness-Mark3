import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Checkbox, Select } from "@/components/ui/field";

// The select arrow and the checkbox tick are data URIs. Written into a class name inside a JS string, Tailwind's
// scanner never generated them (no arrow, no tick anywhere); they live in globals.css as utilities instead.
describe("native control icons", () => {
  it("come from CSS utilities, not from data URIs in class names", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@utility select-chevron \{[^}]*svg\+xml/);
    expect(css).toMatch(/@utility check-tick \{[^}]*svg\+xml/);
    const html = renderToStaticMarkup(createElement("div", null, createElement(Select, null), createElement(Checkbox, { label: "x" })));
    expect(html).toContain("select-chevron");
    expect(html).toContain("checked:check-tick");
    expect(html).not.toContain("svg+xml");
  });
});
