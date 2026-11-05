import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { motionLevel, readMotion, useMotion, type Motion } from "@/lib/motion";
import { Burst } from "@/components/ui/light";
import { COUNT_MS } from "@/components/ui/count-up";
import { quietPath } from "@/components/admin/admin-tour";

// The server renderer always takes useMotion's server snapshot, so Burst's calm/still branch is reached by
// overriding the hook; `forced = undefined` keeps the real one.
const hook = vi.hoisted(() => ({ forced: undefined as Motion | undefined }));
vi.mock("@/lib/motion", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/motion")>();
  return { ...real, useMotion: () => hook.forced ?? real.useMotion() };
});

/** A browser with <html data-motion> and the OS reduced-motion setting. */
function browser(dataMotion: string | undefined, reduced: boolean) {
  vi.stubGlobal("document", { documentElement: { dataset: { motion: dataMotion } }, querySelector: vi.fn() });
  vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: reduced && q.includes("reduce") }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  hook.forced = undefined;
});

describe("motion level", () => {
  it("maps data-motion and the OS setting to full, calm or still", () => {
    expect(motionLevel("full", false)).toBe("full");
    expect(motionLevel("calm", false)).toBe("calm");
    expect(motionLevel("still", false)).toBe("still");
    expect(motionLevel(undefined, false)).toBe("full");
    expect(motionLevel("bogus", false)).toBe("full");
    // Reduced motion wins over any preference, Calm included.
    expect(motionLevel("full", true)).toBe("still");
    expect(motionLevel("calm", true)).toBe("still");
  });

  it("reads the browser snapshot from <html data-motion> and matchMedia", () => {
    browser("calm", false);
    expect(readMotion()).toBe("calm");
    browser("full", true);
    expect(readMotion()).toBe("still");
  });

  it("renders Full on the server", () => {
    const Probe = () => useMotion();
    expect(renderToStaticMarkup(createElement(Probe))).toBe("full");
  });
});

describe("Burst", () => {
  it("renders decorative particles under Full", () => {
    const html = renderToStaticMarkup(createElement(Burst));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="burst"');
    expect(html.split("--bx:").length - 1).toBe(12);
  });

  it.each(["calm", "still"] as const)("renders nothing under %s", (level) => {
    hook.forced = level;
    expect(renderToStaticMarkup(createElement(Burst))).toBe("");
  });
});

describe("CountUp", () => {
  it("counts shorter under Calm and in one frame under Still", () => {
    expect(COUNT_MS.full).toBe(900);
    expect(COUNT_MS.calm).toBeGreaterThan(0);
    expect(COUNT_MS.calm).toBeLessThan(COUNT_MS.full);
    expect(COUNT_MS.still).toBe(0);
  });
});

describe("admin guide", () => {
  it("does not open by itself over the drill pages", () => {
    expect(quietPath("/admin/drill")).toBe(true);
    expect(quietPath("/admin/drill/0f8c")).toBe(true);
    expect(quietPath("/admin")).toBe(false);
    expect(quietPath("/admin/campaigns")).toBe(false);
  });
});
