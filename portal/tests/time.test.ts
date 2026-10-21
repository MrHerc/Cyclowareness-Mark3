import { describe, expect, it } from "vitest";
import { bakuDayPlus, dayBoundary, dayRange, todayInBaku } from "@/lib/time";

describe("todayInBaku", () => {
  it("is the Baku calendar day, which turns over four hours before the UTC one", () => {
    // 22:00 UTC on the 19th is already 02:00 on the 20th in Baku: a module due on the 19th is overdue.
    expect(todayInBaku(new Date("2026-10-19T22:00:00Z"))).toBe("2026-10-20");
    expect(todayInBaku(new Date("2026-10-19T19:59:59Z"))).toBe("2026-10-19");
    expect("2026-10-19" < todayInBaku(new Date("2026-10-19T22:00:00Z"))).toBe(true);
  });

  it("does not depend on the server's time zone", () => {
    const original = process.env.TZ;
    try {
      const results = ["UTC", "America/New_York", "Asia/Tokyo"].map((tz) => {
        process.env.TZ = tz;
        return todayInBaku(new Date("2026-10-19T22:00:00Z"));
      });
      expect(results).toEqual(["2026-10-20", "2026-10-20", "2026-10-20"]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("lines up with dayBoundary: the day's start is never after the instant it was taken from", () => {
    const at = new Date("2026-10-19T22:00:00Z");
    expect(dayBoundary(todayInBaku(at))!.getTime()).toBeLessThanOrEqual(at.getTime());
    expect(dayBoundary(todayInBaku(at), true)!.getTime()).toBeGreaterThanOrEqual(at.getTime());
  });
});

describe("bakuDayPlus", () => {
  it("counts from the Baku day, not the UTC one", () => {
    // 22:00 UTC on the 19th is 02:00 on the 20th in Baku: 14 days later is the 3rd, not the 2nd.
    const at = new Date("2026-10-19T22:00:00Z");
    expect(bakuDayPlus(14, at)).toBe("2026-11-03");
    expect(bakuDayPlus(0, at)).toBe(todayInBaku(at));
    expect(bakuDayPlus(7, new Date("2026-10-19T19:59:59Z"))).toBe("2026-10-26");
  });

  it("goes back for negative days and crosses months and leap days", () => {
    const at = new Date("2026-10-19T22:00:00Z");
    expect(bakuDayPlus(-31, at)).toBe("2026-09-19");
    expect(bakuDayPlus(-7, at)).toBe("2026-10-13");
    expect(bakuDayPlus(1, new Date("2028-02-28T21:00:00Z"))).toBe("2028-03-01");
  });

  it("does not depend on the server's time zone", () => {
    const original = process.env.TZ;
    try {
      const results = ["UTC", "America/New_York", "Asia/Tokyo"].map((tz) => {
        process.env.TZ = tz;
        return bakuDayPlus(14, new Date("2026-10-19T22:00:00Z"));
      });
      expect(results).toEqual(["2026-11-03", "2026-11-03", "2026-11-03"]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("dayBoundary", () => {
  it("accepts real calendar days as Baku (+04:00) day boundaries", () => {
    expect(dayBoundary("2026-10-20")?.toISOString()).toBe("2026-10-19T20:00:00.000Z");
    expect(dayBoundary("2026-10-20", true)?.toISOString()).toBe("2026-10-20T19:59:59.999Z");
    expect(dayBoundary("2028-02-29")?.toISOString()).toBe("2028-02-28T20:00:00.000Z");
  });

  it("does not depend on the server's time zone (UTC container)", () => {
    const original = process.env.TZ;
    try {
      const results = ["UTC", "America/New_York", "Asia/Tokyo"].map((tz) => {
        process.env.TZ = tz;
        return [dayBoundary("2026-10-20")?.getTime(), dayBoundary("2026-10-20", true)?.getTime()];
      });
      process.env.TZ = "UTC";
      expect(new Date(0).getTimezoneOffset()).toBe(0);
      for (const r of results) expect(r).toEqual([Date.parse("2026-10-20T00:00:00+04:00"), Date.parse("2026-10-20T23:59:59.999+04:00")]);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("refuses impossible or malformed dates instead of rolling them over", () => {
    for (const v of ["2026-13-01", "2026-02-31", "2027-02-29", "2026-00-10", "2026-10-00", "2026-10-32", "notadate", "2026-1-1", "", null, undefined, "2026-10-20T00:00"]) {
      expect(dayBoundary(v), String(v)).toBeNull();
    }
  });
});

describe("dayRange", () => {
  it("drops invalid ends and keeps the valid one", () => {
    const r = dayRange("2026-13-99", "2026-10-20");
    expect(r.from).toBeNull();
    expect(r.toDay).toBe("2026-10-20");
    expect(r.fromDay).toBe("");
    expect(r.rejected).toBe(true);
  });

  it("is not rejected when nothing or only valid days are given", () => {
    for (const [from, to] of [[undefined, undefined], ["", ""], [null, "2026-10-20"], ["2026-10-01", ""], ["2026-10-01", "2026-10-20"]] as const) {
      expect(dayRange(from, to).rejected, `${from}..${to}`).toBe(false);
    }
  });

  it("ignores a range that ends before it starts", () => {
    expect(dayRange("2026-10-20", "2026-10-01")).toEqual({ from: null, to: null, fromDay: "", toDay: "", rejected: true });
  });

  it("covers the whole last day", () => {
    const r = dayRange("2026-10-20", "2026-10-20");
    expect(r.to!.getTime() - r.from!.getTime()).toBe(86_400_000 - 1);
  });
});
