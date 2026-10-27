/**
 * Azerbaijani numbers in the browser. Chromium resolves the `az` locale (so FormatJS's
 * `shouldPolyfill("az")` finds nothing missing) but has no az number symbols: every ICU number in an
 * az message ({count, number}, the # of a plural) prints 1234.5 as "1,234.5" instead of "1.234,5",
 * unlike the server's HTML, which also breaks hydration. Such a browser loads FormatJS's polyfill
 * (az-numbers-polyfill.ts) before anything formats an az message, see `<AzNumbersGate>`. Browsers
 * with the data, pages in the other languages and the server (Node has full ICU) never load it; Next compiles
 * `typeof window` to a constant, so the chunk is not even part of the server bundle.
 */

type NumberFormatConstructor = new (locale: string) => Pick<Intl.NumberFormat, "format" | "resolvedOptions">;

/** True when `NumberFormat` prints Azerbaijani numbers with the root's or another language's symbols. */
export function lacksAzNumbers(NumberFormat: NumberFormatConstructor = Intl.NumberFormat): boolean {
  const nf = new NumberFormat("az");
  return nf.resolvedOptions().locale.split("-")[0] !== "az" || nf.format(1234.5) !== "1.234,5";
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
