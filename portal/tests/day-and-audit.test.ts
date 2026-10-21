import { describe, expect, it } from "vitest";
import { parseDay } from "../src/lib/day";
import { withoutNul } from "../src/server/services/audit";

describe("parseDay", () => {
  it("keeps real calendar days", () => {
    expect(parseDay("2026-01-01")).toBe("2026-01-01");
    expect(parseDay("2026-12-31")).toBe("2026-12-31");
    expect(parseDay("2028-02-29")).toBe("2028-02-29");
  });

  it("refuses days that do not exist", () => {
    expect(parseDay("2026-02-29")).toBeNull();
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("2026-00-10")).toBeNull();
    expect(parseDay("2026-04-31")).toBeNull();
  });

  it("refuses anything that is not YYYY-MM-DD", () => {
    for (const value of ["", "\u0000", "2026-1-01", "2026-01-01T00:00", " 2026-01-01", "01.01.2026", "2026-01-01\u0000", null, undefined, 20260101]) {
      expect(parseDay(value)).toBeNull();
    }
  });
});

describe("withoutNul", () => {
  it("removes U+0000 from strings, nested values and keys", () => {
    expect(withoutNul("a\u0000b")).toBe("ab");
    expect(withoutNul({ kind: "risk", from: "\u0000", list: ["x\u0000", 1, null], nested: { "k\u0000ey": "v\u0000" } })).toEqual({
      kind: "risk",
      from: "",
      list: ["x", 1, null],
      nested: { key: "v" },
    });
  });

  it("leaves values that are not plain objects untouched", () => {
    const at = new Date("2026-10-20T00:00:00Z");
    expect(withoutNul({ at }).at).toBe(at);
    expect(withoutNul(42)).toBe(42);
    expect(withoutNul(null)).toBeNull();
    expect(withoutNul(undefined)).toBeUndefined();
  });
});
