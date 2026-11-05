import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFormatter } from "next-intl";

// useClientFormat reads three next-intl hooks; outside React they are replaced by plain values.
let locale = "en";
const timeZone = "Asia/Baku";
vi.mock("next-intl", async (original) => {
  const real = await original<typeof import("next-intl")>();
  return {
    ...real,
    useLocale: () => locale,
    useTimeZone: () => timeZone,
    useFormatter: () => real.createFormatter({ locale, timeZone }),
  };
});

const { useClientFormat } = await import("@/lib/client-format");

const at = new Date("2026-10-14T08:05:00Z"); // 12:05 in Baku
const now = new Date("2026-10-14T14:05:00Z");

describe("useClientFormat", () => {
  beforeEach(() => {
    locale = "en";
  });

  it("formats Azerbaijani without ICU data, in Baku time", () => {
    locale = "az";
    const f = useClientFormat();
    expect(f.dateTime(at)).toBe("14 okt 2026");
    expect(f.dateTime(at, { dateStyle: "long" })).toBe("14 oktyabr 2026");
    expect(f.dateTime(at, { day: "numeric", month: "numeric", year: "numeric", timeStyle: "short" })).toBe("14.10.2026, 12:05");
    expect(f.relativeTime(at, now)).toBe("6 saat əvvəl");
    expect(f.number(1234.5)).toBe("1.234,5");
  });

  it("formats Georgian dates with its own month names", () => {
    locale = "ka";
    const f = useClientFormat();
    expect(f.dateTime(at, { dateStyle: "long" })).toMatch(/14 ოქტომბერი, 2026/);
    expect(f.relativeTime(at, now)).toMatch(/6 საათის წინ/);
  });

  it("keeps Western digits for Arabic, as the server does", () => {
    locale = "ar";
    const f = useClientFormat();
    expect(f.number(1234)).toMatch(/1[,٬]?234/);
    expect(f.number(1234)).not.toMatch(/[٠-٩]/);
    expect(f.dateTime(at)).not.toMatch(/[٠-٩]/);
    expect(f.relativeTime(at, now)).not.toMatch(/[٠-٩]/);
  });

  it("goes through next-intl for other languages, with the numeric-and-time shape spelled out", () => {
    locale = "en";
    const f = useClientFormat();
    const ref = createFormatter({ locale: "en", timeZone });
    expect(f.dateTime(at)).toBe(ref.dateTime(at, { dateStyle: "medium" }));
    expect(f.dateTime(at, { day: "numeric", month: "numeric", year: "numeric", timeStyle: "short" })).toBe("10/14/2026, 12:05 PM");
    expect(f.dateTime(at, { day: "numeric", month: "long" })).toBe("October 14");
    expect(f.relativeTime(at, now)).toBe("6 hours ago");
    expect(f.number(1234.5)).toBe("1,234.5");
  });

  it("accepts strings and timestamps as dates", () => {
    locale = "ru";
    const f = useClientFormat();
    expect(f.dateTime(at.toISOString())).toBe(f.dateTime(at.getTime()));
    expect(f.relativeTime(at.getTime(), now.getTime())).toBe("6 часов назад");
  });
});
