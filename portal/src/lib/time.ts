import { DEFAULT_TIME_ZONE, parseDay } from "./day";
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

/** Cyclowareness's fixed numeric date (03.10.2026), identical in every locale, in the organisation's time zone. */
export function numericDate(d: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d).split("-");
  return `${day}.${m}.${y}`;
}

/**
 * The UTC offset ("+03:00", "-03:30") of an IANA time zone at an instant. Read from Intl, so daylight
 * saving follows the zone's own rules (Berlin is +01:00 in January and +02:00 in July).
 */
export function offsetAt(timeZone: string, date: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // "GMT" alone is UTC itself (some engines write "GMT+00:00").
  return name === "GMT" ? "+00:00" : name.slice(3);
}

/**
 * The instant of a wall-clock time (HH:MM:SS[.mmm]) on a YYYY-MM-DD day in `timeZone`. The offset is
 * read once near the result and again at it, so on the day the clocks change the time gets the offset
 * in force at that moment (a time skipped by the change lands just after it).
 */
export function zonedTime(day: string, time: string, timeZone: string): Date {
  const first = new Date(`${day}T${time}${offsetAt(timeZone, new Date(`${day}T${time}Z`))}`);
  return new Date(`${day}T${time}${offsetAt(timeZone, first)}`);
}

/** Noon of a YYYY-MM-DD day in `timeZone`: the instant to format a date-only value (a due day) with, so it shows that same day. */
export function dayAt(day: string, timeZone: string): Date {
  return zonedTime(day, "12:00:00", timeZone);
}

/** The wall-clock time of an instant in `timeZone`, as milliseconds since 1970 read as UTC (spreadsheet serial dates). */
export function wallClockMs(date: Date, timeZone: string): number {
  return date.getTime() - Date.parse(`1970-01-01T00:00:00${offsetAt(timeZone, date)}`);
}

/**
 * Today's calendar day (YYYY-MM-DD) in the organisation's time zone, whatever the server's own zone.
 * Due dates are stored as YYYY-MM-DD and end at 23:59:59 in that zone (jobs.ts dueEnd), so "overdue"
 * is `due < todayIn(tz)`: it flips at the organisation's midnight together with the reminder jobs and
 * the dates the UI shows, not at midnight UTC.
 */
export function todayIn(timeZone: string, now = new Date()): string {
  return dayKey(now, timeZone);
}

/**
 * The calendar day (YYYY-MM-DD) `days` days after (or, when negative, before) `from`, for due dates
 * ("14 days from now", "N days after joining") and day windows. Counted from the day of `from` in the
 * organisation's zone, not the UTC one, and in calendar days, so a daylight-saving change in between
 * cannot move it by one.
 */
export function dayPlus(days: number, timeZone: string, from = new Date()): string {
  const d = new Date(`${dayKey(from, timeZone)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** @deprecated Baku's day: use todayIn with the organisation's time zone. */
export function todayInBaku(now = new Date()): string {
  return todayIn(DEFAULT_TIME_ZONE, now);
}

/** @deprecated Counted in Baku: use dayPlus with the organisation's time zone. */
export function bakuDayPlus(days: number, from = new Date()): string {
  return dayPlus(days, DEFAULT_TIME_ZONE, from);
}

/**
 * A YYYY-MM-DD filter value as the start (or, with `endOfDay`, the last millisecond) of that day in
 * the organisation's time zone, whatever the server's own zone, so report and audit filters cover the
 * same day the UI shows. Null for anything else, including well-formed but impossible dates
 * (2026-13-01, 2026-02-31), which `new Date` would turn into an invalid or rolled-over date (see lib/day.ts).
 */
export function dayBoundary(value: string | null | undefined, endOfDay = false, timeZone = DEFAULT_TIME_ZONE): Date | null {
  const day = parseDay(value);
  if (!day) return null;
  return zonedTime(day, endOfDay ? "23:59:59.999" : "00:00:00.000", timeZone);
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
  timeZone = DEFAULT_TIME_ZONE,
): { from: Date | null; to: Date | null; fromDay: string; toDay: string; rejected: boolean } {
  const start = dayBoundary(from, false, timeZone);
  const end = dayBoundary(to, true, timeZone);
  if (start && end && start > end) return { from: null, to: null, fromDay: "", toDay: "", rejected: true };
  return { from: start, to: end, fromDay: start ? from! : "", toDay: end ? to! : "", rejected: (!!from && !start) || (!!to && !end) };
}
