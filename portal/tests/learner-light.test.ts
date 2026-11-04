import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressBar, Ring } from "@/components/ui/progress";

describe("ProgressBar shimmer", () => {
  it("adds the looping sheen only when asked, and only for Full motion", () => {
    const lit = renderToStaticMarkup(createElement(ProgressBar, { value: 40, label: "x", shimmer: true }));
    expect(lit).toContain("motion-full:after:animate-sheen");
    // The band rests invisible, so Calm and Still (no loop) never show a frozen stripe.
    expect(lit).toContain("after:opacity-0");
    expect(renderToStaticMarkup(createElement(ProgressBar, { value: 40, label: "x" }))).not.toContain("animate-sheen");
  });

  it("never loops on an empty or full bar, nor on the white bar", () => {
    for (const props of [{ value: 0 }, { value: 100 }, { value: 40, tone: "white" as const }]) {
      expect(renderToStaticMarkup(createElement(ProgressBar, { ...props, label: "x", shimmer: true }))).not.toContain("animate-sheen");
    }
  });
});

describe("Ring", () => {
  it("fills from empty on mount and glows only when full", () => {
    const half = renderToStaticMarkup(createElement(Ring, { value: 0.5, label: "x" }));
    expect(half).toContain("starting:[stroke-dashoffset:var(--ring-empty)]");
    expect(half).not.toContain("glow-ring");
    const full = renderToStaticMarkup(createElement(Ring, { value: 1, label: "x", tone: "white" }));
    expect(full).toContain('class="glow-ring rounded-full"');
    // On a brand surface the halo takes the readable colour, never a hard-coded white.
    expect(full).toContain("--light:var(--brand-on)");
  });
});
