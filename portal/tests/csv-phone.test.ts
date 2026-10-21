import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("toCsv phone numbers", () => {
  it("writes an international phone number as it is", () => {
    const csv = toCsv(["phone"], [["+994501234567"]]);
    expect(parseCsv(csv)[1]).toEqual(["+994501234567"]);
  });

  it("still neutralises formulas that start with a plus", () => {
    expect(parseCsv(toCsv(["x"], [["+cmd|' /C calc'!A0"]]))[1][0]).toBe("'+cmd|' /C calc'!A0");
    expect(parseCsv(toCsv(["x"], [["+1+1"]]))[1][0]).toBe("'+1+1");
    expect(parseCsv(toCsv(["x"], [["=1+1"]]))[1][0]).toBe("'=1+1");
  });
});
