import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { AreaChart } from "@/components/ui/charts";

const chart = (points: { label: string; value: number }[]) =>
  renderToStaticMarkup(
    // The provider types its children as a prop; createElement passes them as the third argument.
    createElement(NextIntlClientProvider, { locale: "en", messages: {} } as ComponentProps<typeof NextIntlClientProvider>, createElement(AreaChart, { points, caption: "Risk", headers: ["Date", "Value"] })),
  );

describe("AreaChart light", () => {
  it("draws the line in once, lights the last point and keeps the data table", () => {
    const html = chart([
      { label: "Oct 3", value: 40 },
      { label: "Nov 3", value: 64 },
    ]);
    // The line and area sit in a clip whose rect unrolls from nothing; the server markup is the final chart.
    expect(html).toMatch(/<clipPath id="(g-Risk-brand-draw)"><rect[^>]*class="[^"]*starting:scale-x-0[^"]*"/);
    expect(html).toContain('clip-path="url(#g-Risk-brand-draw)"');
    // The latest point: a dot on the axis end (mirrored in RTL) that flashes once.
    expect(html).toContain("translate-x-1/2");
    expect(html).toContain("rtl:-translate-x-1/2");
    expect(html).toContain('class="glow-ring animate-glow"');
    expect(html).toContain("<caption>Risk</caption>");
    expect(html).toContain("<td>64</td>");
  });

  it("draws no point for an empty series", () => {
    expect(chart([])).not.toContain("glow-ring");
  });
});
