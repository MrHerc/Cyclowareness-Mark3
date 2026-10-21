/**
 * Azerbaijani date and relative-time formatting without ICU locale data.
 *
 * Chromium ships no `az` data: `Intl.DateTimeFormat("az")` prints "2026 M10 14" and
 * `Intl.RelativeTimeFormat("az")` prints "-6 h". These functions reproduce ICU's `az` patterns
 * exactly (tests/az-format.test.ts checks them against Node's full ICU), reading the calendar
 * fields through en-US data, which every browser has. Used by client components through
 * `useClientFormat`; server code keeps next-intl's formatter.
 */

export type AzDateOptions =
  | { dateStyle?: "short" | "medium" | "long" | "full"; timeStyle?: "short" }
  | { day: "numeric"; month: "short" | "long"; year?: "numeric" }
  /** "14.10.2026" (what `toLocaleDateString` gives), optionally with the time. */
  | { day: "numeric"; month: "numeric"; year: "numeric"; timeStyle?: "short" };

const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const MONTHS_LONG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const WEEKDAYS = ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"];
const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const two = (n: number) => String(n).padStart(2, "0");

const fieldFormatters = new Map<string, Intl.DateTimeFormat>();
/** Calendar fields of `d` in `timeZone` (the runtime's zone when undefined). */
function fieldsIn(d: Date, timeZone: string | undefined) {
  const key = timeZone ?? "";
  let f = fieldFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", weekday: "short" });
    fieldFormatters.set(key, f);
  }
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month) - 1, day: Number(parts.day), hour: Number(parts.hour) % 24, minute: Number(parts.minute), weekday: EN_WEEKDAYS.indexOf(parts.weekday) };
}

export function formatAzDate(date: Date, o: AzDateOptions = { dateStyle: "medium" }, timeZone?: string): string {
  const f = fieldsIn(date, timeZone);
  const time = `${two(f.hour)}:${two(f.minute)}`;
  if ("day" in o && o.month === "numeric") {
    const d = `${two(f.day)}.${two(f.month + 1)}.${f.year}`;
    return o.timeStyle ? `${d}, ${time}` : d;
  }
  if ("day" in o) {
    const month = o.month === "long" ? MONTHS_LONG[f.month] : MONTHS_SHORT[f.month];
    return o.year ? `${f.day} ${month} ${f.year}` : `${f.day} ${month}`;
  }
  const d =
    o.dateStyle === "short"
      ? `${two(f.day)}.${two(f.month + 1)}.${two(f.year % 100)}`
      : o.dateStyle === "long"
        ? `${f.day} ${MONTHS_LONG[f.month]} ${f.year}`
        : o.dateStyle === "full"
          ? `${f.day} ${MONTHS_LONG[f.month]} ${f.year}, ${WEEKDAYS[f.weekday]}`
          : o.dateStyle === "medium"
            ? `${f.day} ${MONTHS_SHORT[f.month]} ${f.year}`
            : "";
  return d && o.timeStyle ? `${d}, ${time}` : d || (o.timeStyle ? time : "");
}

export type RelativeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
const UNITS: Record<RelativeUnit, string> = { second: "saniyə", minute: "dəqiqə", hour: "saat", day: "gün", week: "həftə", month: "ay", year: "il" };
const NAMED: Partial<Record<RelativeUnit, [string, string]>> = { day: ["dünən", "sabah"], week: ["keçən həftə", "gələn həftə"], month: ["keçən ay", "gələn ay"], year: ["keçən il", "gələn il"] };

/** ICU `numeric: "auto"` wording ("dünən", "6 saat öncə", "2 gün ərzində"). */
export function formatAzRelative(value: number, unit: RelativeUnit): string {
  if (value === 0) return unit === "second" ? "indi" : `bu ${UNITS[unit]}`;
  const named = NAMED[unit];
  if (named && Math.abs(value) === 1) return value < 0 ? named[0] : named[1];
  return value < 0 ? `${-value} ${UNITS[unit]} öncə` : `${value} ${UNITS[unit]} ərzində`;
}

/** The unit next-intl picks for a difference in seconds: the largest one with a non-zero count. */
export function relativeUnit(diffSeconds: number): [number, RelativeUnit] {
  const abs = Math.abs(diffSeconds);
  const sign = diffSeconds < 0 ? -1 : 1;
  if (abs < 60) return [sign * Math.round(abs), "second"];
  if (abs < 3600) return [sign * Math.round(abs / 60), "minute"];
  if (abs < 86_400) return [sign * Math.round(abs / 3600), "hour"];
  if (abs < 7 * 86_400) return [sign * Math.round(abs / 86_400), "day"];
  if (abs < 30 * 86_400) return [sign * Math.round(abs / (7 * 86_400)), "week"];
  if (abs < 365 * 86_400) return [sign * Math.round(abs / (30 * 86_400)), "month"];
  return [sign * Math.round(abs / (365 * 86_400)), "year"];
}
