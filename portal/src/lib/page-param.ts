/** Highest page number a list accepts from the URL; deeper offsets are refused instead of sent to the database. */
export const MAX_PAGE = 10_000;

/**
 * `?page=` as a page number: plain digits only (no "1e400", "0x10", "-3" or "2.5"), clamped to
 * 1…MAX_PAGE. Anything else is page 1.
 */
export function pageParam(value: string | null | undefined): number {
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  const n = Number.parseInt(value, 10);
  return Number.isSafeInteger(n) ? Math.min(MAX_PAGE, Math.max(1, n)) : 1;
}
