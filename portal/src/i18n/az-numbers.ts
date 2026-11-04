/**
 * Azerbaijani numbers in the browser. Chromium resolves the `az` locale (so FormatJS's
 * `shouldPolyfill("az")` finds nothing missing) but has no az number symbols: every ICU number in an
 * az message ({count, number}, the # of a plural) prints 1234.5 as "1,234.5" instead of "1.234,5",
 * unlike the server's HTML, which also breaks hydration. Such a browser loads FormatJS's polyfill
 * (az-numbers-polyfill.ts) before anything formats an az message, see `<AzNumbersGate>`. Georgian
 * pages wait for it too: Chromium has no ka data and prints 1234.5 as "1,234.5", not "1234,5". Browsers
 * with the data, pages in the other languages and the server (Node has full ICU) never load it; Next compiles
 * `typeof window` to a constant, so the chunk is not even part of the server bundle.
 */

type NumberFormatConstructor = new (locale: string) => Pick<Intl.NumberFormat, "format" | "resolvedOptions">;

/** 1234.5 as Node's full ICU prints it. Georgian groups from five digits; Chromium has no ka data at all. */
const EXPECTED = { az: "1.234,5", ka: "1234,5" };

/** True when `NumberFormat` prints Azerbaijani or Georgian numbers with the root's or another language's symbols. */
export function lacksAzNumbers(NumberFormat: NumberFormatConstructor = Intl.NumberFormat): boolean {
  return Object.entries(EXPECTED).some(([locale, expected]) => {
    const nf = new NumberFormat(locale);
    return nf.resolvedOptions().locale.split("-")[0] !== locale || nf.format(1234.5) !== expected;
  });
}

let ready: Promise<void> | null | undefined;

/**
 * Null when Azerbaijani numbers already format correctly (always on the server); otherwise the one
 * shared promise of the polyfill chunk. A chunk that fails to load resolves as well: the page then
 * runs with English digit grouping rather than not at all.
 */
export function azNumbersReady(): Promise<void> | null {
  if (ready === undefined) {
    ready = null;
    if (typeof window !== "undefined" && lacksAzNumbers()) {
      ready = import("./az-numbers-polyfill").then(
        () => undefined,
        () => undefined,
      );
    }
  }
  return ready;
}
