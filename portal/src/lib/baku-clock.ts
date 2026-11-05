import { DEFAULT_TIME_ZONE, parseDay } from "./day";
import { zonedTime } from "./time";

/**
 * Date and time inputs in the organisation's wall-clock time. Scheduled times (campaign send times,
 * live sessions) are shown everywhere in the organisation's zone (i18n/request.ts), so they are also
 * entered and prefilled in it, whatever the admin's browser zone: 10:00 typed in a Berlin organisation
 * is 10:00 Berlin, listed and sent at 10:00 Berlin. Client components get the zone from next-intl's
 * useTimeZone() (set on the server), so server and browser render the same values. Only en-CA
 * formatting is used: some browsers have no az ICU data.
 */

/** The date (YYYY-MM-DD) and time (HH:MM) of an instant in `timeZone`, as `date` and `time` input values. */
export function zonedParts(at: Date | string | number, timeZone: string): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(at))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** The instant of a date (YYYY-MM-DD) and time (HH:MM) in `timeZone`, or null when either is not a real one. */
export function fromZonedParts(date: string, time: string, timeZone: string): Date | null {
  if (!parseDay(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return zonedTime(date, `${time}:00`, timeZone);
}

/** An instant as a `datetime-local` value (YYYY-MM-DDTHH:MM) in `timeZone`. */
export function toZonedLocalInput(at: Date | string | number, timeZone: string): string {
  const { date, time } = zonedParts(at, timeZone);
  return `${date}T${time}`;
}

/** A `datetime-local` value read in `timeZone` (seconds, if the browser adds them, are dropped), or null. */
export function fromZonedLocalInput(value: string, timeZone: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  return m ? fromZonedParts(m[1], m[2], timeZone) : null;
}

/** @deprecated Baku time: use zonedParts with the organisation's time zone. */
export const bakuParts = (at: Date | string | number) => zonedParts(at, DEFAULT_TIME_ZONE);
/** @deprecated Baku time: use fromZonedParts with the organisation's time zone. */
export const fromBakuParts = (date: string, time: string) => fromZonedParts(date, time, DEFAULT_TIME_ZONE);
/** @deprecated Baku time: use toZonedLocalInput with the organisation's time zone. */
export const toBakuLocalInput = (at: Date | string | number) => toZonedLocalInput(at, DEFAULT_TIME_ZONE);
/** @deprecated Baku time: use fromZonedLocalInput with the organisation's time zone. */
export const fromBakuLocalInput = (value: string) => fromZonedLocalInput(value, DEFAULT_TIME_ZONE);
