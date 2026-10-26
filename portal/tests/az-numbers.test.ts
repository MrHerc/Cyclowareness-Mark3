import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import { azNumbersReady, lacksAzNumbers } from "@/i18n/az-numbers";

const Native = Intl.NumberFormat;

/** Chromium: it resolves "az" but prints with the root's symbols ("1,234.5"). */
class RootSymbols extends Native {
  constructor() {
    super("en-US");
  }
  resolvedOptions() {
    return { ...super.resolvedOptions(), locale: "az" };
  }
}

/** A browser without the locale at all, falling back to Turkish, which happens to group like az. */
class TurkishFallback extends Native {
  constructor() {
    super("tr");
  }
}

describe("lacksAzNumbers (should the polyfill load?)", () => {
  it("is false with full ICU: Node on the server, Firefox, Safari", () => {
    expect(lacksAzNumbers()).toBe(false);
  });

  it("is true for Chromium, which knows the locale but not its number symbols", () => {
    expect(lacksAzNumbers(RootSymbols)).toBe(true);
  });

  it("is true when az falls back to another language, even one that groups like az", () => {
    expect(new TurkishFallback().format(1234.5)).toBe("1.234,5");
    expect(lacksAzNumbers(TurkishFallback)).toBe(true);
  });

  it("never loads anything on the server", () => {
    expect(azNumbersReady()).toBeNull();
  });
});

// What the server renders (Node's full ICU), which the browser must reproduce for hydration.
const MESSAGES: Record<string, string[]> = {
  az: ["{count, plural, other {# şablon}}", "{kb, number} KB", "5 ulduzdan {value, number}"],
  en: ["{count, plural, one {# template} other {# templates}}", "{kb, number} KB"],
  ru: ["{count, plural, one {# шаблон} few {# шаблона} many {# шаблонов} other {# шаблона}}", "{kb, number} КБ"],
};
const VALUES = [7, 1234, 1234.5, 1_000_000, 21];
const OPTIONS: Intl.NumberFormatOptions[] = [{}, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, { maximumFractionDigits: 1 }, { style: "percent" }];

function render() {
  const out: string[] = [];
  for (const [locale, messages] of Object.entries(MESSAGES)) {
    for (const v of VALUES) {
      for (const m of messages) out.push(String(new IntlMessageFormat(m, locale).format({ count: v, kb: v, value: v })));
      for (const o of OPTIONS) out.push(new Intl.NumberFormat(locale, o).format(o.style === "percent" ? v / 100 : v));
    }
  }
  return out;
}

describe("the polyfill in a browser without az data", () => {
  // The polyfill replaces these globals; put the native ones back for the rest of the run.
  const saved = (
    [
      [Intl, "NumberFormat"],
      [Number.prototype, "toLocaleString"],
      [BigInt.prototype, "toLocaleString"],
    ] as const
  ).map(([target, key]) => ({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key)! }));

  afterEach(() => {
    for (const { target, key, descriptor } of saved) Object.defineProperty(target, key, descriptor);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads once, then formats az, en and ru messages exactly like the server", async () => {
    const server = render();
    expect(server).toContain("1.234,5 şablon");

    class Chromium extends Native {
      constructor(locales?: string | string[], options?: Intl.NumberFormatOptions) {
        super(String(locales).startsWith("az") ? "en-US" : locales, options);
      }
    }
    Object.defineProperty(Intl, "NumberFormat", { value: Chromium, configurable: true, writable: true });
    expect(render()).toContain("1,234.5 şablon");
    vi.stubGlobal("window", globalThis);
    vi.resetModules();
    const fresh = await import("@/i18n/az-numbers");
    expect(fresh.lacksAzNumbers()).toBe(true);

    const ready = fresh.azNumbersReady();
    expect(ready).toBeInstanceOf(Promise);
    expect(fresh.azNumbersReady()).toBe(ready);
    await ready;

    expect((Intl.NumberFormat as { polyfilled?: boolean }).polyfilled).toBe(true);
    expect(fresh.lacksAzNumbers()).toBe(false);
    expect(render()).toEqual(server);
  });
});
