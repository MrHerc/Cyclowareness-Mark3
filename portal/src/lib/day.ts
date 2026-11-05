/**
 * A calendar day as YYYY-MM-DD (the value of date inputs and report filters), or null when the value
 * is not one: wrong shape, or a day that does not exist (2026-02-30, 2026-13-01).
 */
export function parseDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : null;
}

/**
 * The time zone of an organisation that has not chosen one (TenantSettings.timeZone): Baku, where
 * every organisation ran before the setting existed, so their days and deadlines stay where they were.
 */
export const DEFAULT_TIME_ZONE = "Asia/Baku";
