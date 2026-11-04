import { describe, expect, it } from "vitest";
import { type AzDateOptions, type RelativeUnit } from "../src/lib/az-format";
import { formatKaDate, formatKaRelative } from "../src/lib/ka-format";

// Node has full ICU, so it is the reference the hand-written Georgian patterns must match.
const TZ = "Asia/Baku";
const dates = [
  new Date(Date.UTC(2026, 9, 14, 5, 5)), // 14 Oct 2026 09:05 Baku
  new Date(Date.UTC(2026, 0, 3, 10, 30)), // 3 Jan 2026 14:30
  new Date(Date.UTC(2026, 9, 13, 20, 30)), // crosses midnight: 14 Oct 00:30 in Baku
  new Date(Date.UTC(2024, 1, 29, 19, 59)), // leap day, 23:59
  new Date(Date.UTC(2031, 11, 31, 20, 0)), // new year's day in Baku
  ...Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(2027, m, 5, 8))), // every month name
];

// What useClientFormat hands Intl for the numeric-with-time shape (client-format.ts `intlOptions`).
const intl = (o: AzDateOptions): Intl.DateTimeFormatOptions =>
  "day" in o && o.month === "numeric" && o.timeStyle ? { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" } : o;

const shapes: AzDateOptions[] = [
  { dateStyle: "short" }, { dateStyle: "medium" }, { dateStyle: "long" }, { dateStyle: "full" },
  { dateStyle: "short", timeStyle: "short" }, { dateStyle: "medium", timeStyle: "short" }, { dateStyle: "long", timeStyle: "short" }, { dateStyle: "full", timeStyle: "short" },
  { timeStyle: "short" },
  { day: "numeric", month: "short" }, { day: "numeric", month: "long" }, { day: "numeric", month: "short", year: "numeric" }, { day: "numeric", month: "long", year: "numeric" },
  { day: "numeric", month: "numeric", year: "numeric" }, { day: "numeric", month: "numeric", year: "numeric", timeStyle: "short" },
];

describe("formatKaDate matches ICU ka", () => {
  it.each(dates.map((d) => [d.toISOString(), d] as const))("%s", (_, d) => {
    for (const o of shapes) expect(formatKaDate(d, o, TZ), JSON.stringify(o)).toBe(new Intl.DateTimeFormat("ka", { timeZone: TZ, ...intl(o) }).format(d));
  });

  it("defaults to the medium style", () => {
    expect(formatKaDate(dates[0], undefined, TZ)).toBe("14 ოქტ. 2026");
  });
});

describe("formatKaRelative matches next-intl's ka wording", () => {
  // next-intl formats with numeric "always", except "auto" for seconds.
  const units: RelativeUnit[] = ["second", "minute", "hour", "day", "week", "month", "year"];
  const cases = units.flatMap((unit) => [-21, -5, -2, -1, 1, 2, 5, 21].map((n) => [n, unit] as const));
  it.each(cases)("%s %s", (n, unit) => {
    expect(formatKaRelative(n, unit)).toBe(new Intl.RelativeTimeFormat("ka", { numeric: unit === "second" ? "auto" : "always" }).format(n, unit));
  });

  it("says now for zero seconds", () => {
    expect(formatKaRelative(0, "second")).toBe(new Intl.RelativeTimeFormat("ka", { numeric: "auto" }).format(0, "second"));
  });
});
