import { describe, expect, it } from "vitest";
import { bakuParts, fromBakuLocalInput, fromBakuParts, toBakuLocalInput } from "@/lib/baku-clock";

describe("bakuParts", () => {
  it("gives the Baku wall-clock date and time of an instant", () => {
    expect(bakuParts("2026-10-21T06:00:00Z")).toEqual({ date: "2026-10-21", time: "10:00" });
    expect(bakuParts(new Date("2026-10-21T10:00:00+04:00"))).toEqual({ date: "2026-10-21", time: "10:00" });
  });

  it("moves to the next Baku day four hours before UTC midnight", () => {
    expect(bakuParts("2026-10-31T21:30:00Z")).toEqual({ date: "2026-11-01", time: "01:30" });
    expect(bakuParts("2026-12-31T20:00:00Z")).toEqual({ date: "2027-01-01", time: "00:00" });
  });

  it("does not depend on the offset the instant was written with", () => {
    expect(bakuParts("2026-03-08T10:15:00-05:00")).toEqual({ date: "2026-03-08", time: "19:15" });
  });
});

describe("fromBakuParts", () => {
  it("reads the date and time as Baku time (+04:00)", () => {
    expect(fromBakuParts("2026-10-21", "10:00")?.toISOString()).toBe("2026-10-21T06:00:00.000Z");
    expect(fromBakuParts("2026-11-01", "01:30")?.toISOString()).toBe("2026-10-31T21:30:00.000Z");
  });

  it("round-trips with bakuParts", () => {
    const at = fromBakuParts("2027-02-28", "23:59")!;
    expect(bakuParts(at)).toEqual({ date: "2027-02-28", time: "23:59" });
  });

  it("refuses values that are not a real date and time", () => {
    expect(fromBakuParts("", "10:00")).toBeNull();
    expect(fromBakuParts("2026-02-30", "10:00")).toBeNull();
    expect(fromBakuParts("2026-10-21", "")).toBeNull();
    expect(fromBakuParts("2026-10-21", "24:00")).toBeNull();
    expect(fromBakuParts("2026-10-21", "9:00")).toBeNull();
  });
});

describe("datetime-local in Baku time", () => {
  it("prefills the Baku wall-clock time", () => {
    expect(toBakuLocalInput("2026-10-28T07:00:00Z")).toBe("2026-10-28T11:00");
  });

  it("reads the value back as Baku time", () => {
    expect(fromBakuLocalInput("2026-10-28T11:00")?.toISOString()).toBe("2026-10-28T07:00:00.000Z");
    expect(fromBakuLocalInput("2026-10-28T11:00:30")?.toISOString()).toBe("2026-10-28T07:00:00.000Z");
    expect(fromBakuLocalInput(toBakuLocalInput("2026-10-28T07:45:00Z"))?.toISOString()).toBe("2026-10-28T07:45:00.000Z");
  });

  it("refuses an empty or partial value", () => {
    expect(fromBakuLocalInput("")).toBeNull();
    expect(fromBakuLocalInput("2026-10-28")).toBeNull();
    expect(fromBakuLocalInput("2026-10-28T25:00")).toBeNull();
  });
});
