import { parseDay } from "./day";

/**
 * Date and time inputs in Baku wall-clock time. Scheduled times (campaign send times, live sessions)
 * are shown everywhere in Asia/Baku (i18n/request.ts), so they are also entered and prefilled as Baku
 * time, whatever the admin's browser zone: 10:00 typed is 10:00 Baku (06:00 UTC), listed and sent at
 * 10:00 Baku. Azerbaijan keeps a fixed +04:00 with no daylight saving (see lib/time.ts), so the
 * conversion is plain arithmetic: no Intl, which client components avoid (Chromium has no az ICU data).
 */
const BAKU_OFFSET_MS = 4 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** The Baku date (YYYY-MM-DD) and time (HH:MM) of an instant, as `date` and `time` input values. */
export function bakuParts(at: Date | string | number): { date: string; time: string } {
  const d = new Date(new Date(at).getTime() + BAKU_OFFSET_MS);
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

/** The instant of a Baku date (YYYY-MM-DD) and time (HH:MM), or null when either is not a real one. */
export function fromBakuParts(date: string, time: string): Date | null {
  if (!parseDay(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return new Date(`${date}T${time}:00+04:00`);
}

/** An instant as a `datetime-local` value (YYYY-MM-DDTHH:MM) in Baku time. */
export function toBakuLocalInput(at: Date | string | number): string {
  const { date, time } = bakuParts(at);
  return `${date}T${time}`;
}

/** A `datetime-local` value read as Baku time (seconds, if the browser adds them, are dropped), or null. */
export function fromBakuLocalInput(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  return m ? fromBakuParts(m[1], m[2]) : null;
}
