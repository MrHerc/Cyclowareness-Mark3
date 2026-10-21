import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonClass, coarseHitArea, textButtonClass, textLinkClass } from "@/components/ui/button";
import { Checkbox, Segmented, Switch } from "@/components/ui/field";

// Phones and tablets (pointer: coarse) get 44 px touch targets; fine pointers keep the desktop sizes.
const PAD = "pointer-coarse:py-[max(0px,calc((2.75rem_-_1lh)/2))]";
const MARGIN = "pointer-coarse:-my-[max(0px,calc((2.75rem_-_1lh)/2))]";

describe("coarse-pointer touch targets", () => {
  it("grows the small button sizes only on coarse pointers", () => {
    expect(buttonClass("primary", "sm")).toContain("pointer-coarse:h-11");
    expect(buttonClass("ghost", "icon-sm")).toContain("pointer-coarse:size-11");
    expect(buttonClass("primary", "sm")).toContain("h-9");
  });

  it("text buttons reach 44 px on coarse pointers", () => {
    expect(textButtonClass()).toContain("pointer-coarse:min-h-11");
  });

  it("text links get a padded hit area that a negative margin gives back", () => {
    expect(coarseHitArea.split(" ")).toEqual([PAD, MARGIN]);
    const cls = textLinkClass("inline-flex text-caption hover:underline").split(" ");
    expect(cls).toContain(PAD);
    expect(cls).toContain(MARGIN);
    expect(cls).toContain("inline-flex");
  });

  it("keeps a call site's coarse margin-top next to the hit area's block margin", () => {
    const top = "pointer-coarse:mt-[calc(0.75rem_-_max(0px,calc((2.75rem_-_1lh)/2)))]";
    const cls = textLinkClass(`mt-3 inline-flex ${top}`).split(" ");
    expect(cls).toEqual(expect.arrayContaining(["mt-3", MARGIN, top]));
  });

  it("a checkbox is tapped through a label with the 44 px coarse hit area", () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { name: "anonymous", label: "Send anonymously" }));
    const label = /<label class="([^"]+)"/.exec(html)?.[1].split(" ") ?? [];
    expect(label).toEqual(expect.arrayContaining(["flex", "cursor-pointer", PAD, MARGIN]));
    expect(html).toMatch(/<label[^>]*>\s*<input type="checkbox"/);
  });

  it("switch rows and the small segmented options reach 44 px on coarse pointers", () => {
    const sw = renderToStaticMarkup(createElement(Switch, { label: "Sound" }));
    expect(/<label class="([^"]+)"/.exec(sw)?.[1].split(" ")).toContain("pointer-coarse:min-h-11");
    for (const size of ["sm", "md"] as const) {
      const seg = renderToStaticMarkup(createElement(Segmented, { name: "m", size, defaultValue: "a", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }));
      expect(seg.match(/pointer-coarse:h-11/g)).toHaveLength(2);
    }
  });
});
