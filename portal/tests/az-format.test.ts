import { describe, expect, it } from "vitest";
import { formatAzDate, formatAzRelative, relativeUnit } from "../src/lib/az-format";

// Node has full ICU, so it is the reference the hand-written Azerbaijani patterns must match.
const TZ = "Asia/Baku";
const dates = [
  new Date(Date.UTC(2026, 9, 14, 5, 5)), // 14 okt 2026 09:05 Baku
  new Date(Date.UTC(2026, 0, 3, 10, 30)), // 3 yan 2026 14:30
  new Date(Date.UTC(2026, 9, 13, 20, 30)), // crosses midnight: 14 okt 00:30 in Baku
  new Date(Date.UTC(2024, 1, 29, 19, 59)), // leap day, 23:59
  new Date(Date.UTC(2031, 11, 31, 20, 0)), // new year's day in Baku
];

const icu = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("az", { timeZone: TZ, ...o }).format(d);

describe("formatAzDate matches ICU az", () => {
  it.each(dates.map((d) => [d.toISOString(), d] as const))("%s", (_, d) => {
    expect(formatAzDate(d, { dateStyle: "short" }, TZ)).toBe(icu(d, { dateStyle: "short" }));
    expect(formatAzDate(d, { dateStyle: "medium" }, TZ)).toBe(icu(d, { dateStyle: "medium" }));
    expect(formatAzDate(d, { dateStyle: "long" }, TZ)).toBe(icu(d, { dateStyle: "long" }));
    expect(formatAzDate(d, { dateStyle: "full" }, TZ)).toBe(icu(d, { dateStyle: "full" }));
    expect(formatAzDate(d, { dateStyle: "medium", timeStyle: "short" }, TZ)).toBe(icu(d, { dateStyle: "medium", timeStyle: "short" }));
    expect(formatAzDate(d, { timeStyle: "short" }, TZ)).toBe(icu(d, { timeStyle: "short" }));
    expect(formatAzDate(d, { day: "numeric", month: "short" }, TZ)).toBe(icu(d, { day: "numeric", month: "short" }));
    expect(formatAzDate(d, { day: "numeric", month: "long" }, TZ)).toBe(icu(d, { day: "numeric", month: "long" }));
    expect(formatAzDate(d, { day: "numeric", month: "short", year: "numeric" }, TZ)).toBe(icu(d, { day: "numeric", month: "short", year: "numeric" }));
    expect(formatAzDate(d, { day: "numeric", month: "numeric", year: "numeric" }, TZ)).toBe(icu(d, { day: "numeric", month: "numeric", year: "numeric" }));
    expect(formatAzDate(d, { day: "numeric", month: "numeric", year: "numeric", timeStyle: "short" }, TZ)).toBe(icu(d, { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  });

  it("defaults to the medium style", () => {
    expect(formatAzDate(dates[0], undefined, TZ)).toBe("14 okt 2026");
  });
});

describe("formatAzRelative matches ICU az (numeric: auto)", () => {
  const rtf = new Intl.RelativeTimeFormat("az", { numeric: "auto" });
  const cases: [number, Parameters<typeof formatAzRelative>[1]][] = [
    [0, "second"], [-5, "second"], [-1, "minute"], [-3, "minute"], [-1, "hour"], [-6, "hour"], [-1, "day"], [-2, "day"],
    [-1, "week"], [-3, "week"], [-1, "month"], [-4, "month"], [-1, "year"], [-2, "year"], [1, "day"], [2, "day"], [1, "week"], [3, "hour"], [1, "month"], [1, "year"],
    [0, "minute"], [0, "hour"], [0, "day"], [0, "week"], [0, "month"], [0, "year"],
  ];
  it.each(cases)("%s %s", (n, unit) => {
    expect(formatAzRelative(n, unit)).toBe(rtf.format(n, unit));
  });
});

describe("relativeUnit", () => {
  it("picks the largest non-zero unit like next-intl", () => {
    expect(relativeUnit(-30)).toEqual([-30, "second"]);
    expect(relativeUnit(-90)).toEqual([-2, "minute"]);
    expect(relativeUnit(-6 * 3600)).toEqual([-6, "hour"]);
    expect(relativeUnit(-86_400)).toEqual([-1, "day"]);
    expect(relativeUnit(-8 * 86_400)).toEqual([-1, "week"]);
    expect(relativeUnit(-45 * 86_400)).toEqual([-2, "month"]);
    expect(relativeUnit(-800 * 86_400)).toEqual([-2, "year"]);
    expect(relativeUnit(3 * 3600)).toEqual([3, "hour"]);
  });
});
