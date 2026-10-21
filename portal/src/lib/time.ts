import { parseDay } from "./day";
import { dayKey } from "./domain/gamification";

/**
 * The current time for an async server component. A server component renders once per request, so
 * reading the clock during render is fine, but the React compiler's purity rule cannot tell server
 * components apart from client ones and reports a bare `Date.now()` / `new Date()` in a page body.
 * Client components keep the clock out of render (event handlers, lazy initialisers or props).
 */
export function requestNow(): Date {
  return new Date();
}

/** Cyclowareness's fixed numeric date (03.10.2026), identical in every locale, Baku time. */
export function numericDate(d: Date, timeZone = "Asia/Baku"): string {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-");
  return `${day}.${m}.${y}`;
}

/**
 * The UTC offset of Asia/Baku, the time zone the UI shows dates in (i18n/request.ts, numericDate) and
 * due dates end in (jobs.ts dueEnd). Azerbaijan has kept a fixed +04:00 with no daylight saving since
 * 2016, so a fixed offset is exact.
 */
const BAKU_OFFSET = "+04:00";

/**
 * Today's calendar day (YYYY-MM-DD) in Baku, whatever the server's own time zone. Due dates are stored
 * as YYYY-MM-DD and end at 23:59:59 Baku (jobs.ts dueEnd), so "overdue" is `due < todayInBaku()`: it
 * flips at midnight Baku together with the reminder jobs and the dates the UI shows, not at midnight UTC.
 */
export function todayInBaku(now = new Date()): string {
  return dayKey(now);
}

/**
 * The Baku calendar day (YYYY-MM-DD) `days` days after (or, when negative, before) `from`, for due
 * dates ("14 days from now", "N days after joining") and day windows. Counted from the Baku day of
 * `from`, not the UTC one, so between 00:00 and 04:00 Baku it does not land a day early. Baku has no
 * daylight saving (see BAKU_OFFSET), so adding whole days of milliseconds keeps the wall-clock time.
 */
export function bakuDayPlus(days: number, from = new Date()): string {
  return dayKey(new Date(from.getTime() + days * 86_400_000));
}

/**
 * A YYYY-MM-DD filter value as the start (or, with `endOfDay`, the last millisecond) of that day in
 * Baku time, whatever the server's own time zone, so report and audit filters cover the same day the
 * UI shows. Null for anything else, including well-formed but impossible dates (2026-13-01,
 * 2026-02-31), which `new Date` would turn into an invalid or rolled-over date (see lib/day.ts).
 */
export function dayBoundary(value: string | null | undefined, endOfDay = false): Date | null {
  const day = parseDay(value);
  if (!day) return null;
  return new Date(`${day}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}${BAKU_OFFSET}`);
}

/**
 * A from/to pair of day filters. Invalid days are dropped; a range that ends before it starts is
 * ignored as a whole. `fromDay`/`toDay` are the accepted values ("" when ignored) for the form, and
 * `rejected` says that a value was given but not applied, so callers can tell the user (or refuse)
 * instead of presenting the unfiltered result as the requested period.
 */
export function dayRange(
  from: string | null | undefined,
  to: string | null | undefined,
): { from: Date | null; to: Date | null; fromDay: string; toDay: string; rejected: boolean } {
  const start = dayBoundary(from);
  const end = dayBoundary(to, true);
  if (start && end && start > end) return { from: null, to: null, fromDay: "", toDay: "", rejected: true };
  return { from: start, to: end, fromDay: start ? from! : "", toDay: end ? to! : "", rejected: (!!from && !start) || (!!to && !end) };
}
