import { describe, expect, it } from "vitest";
import { cleanPhone, PHONE_PATTERN } from "@/lib/phone";

describe("cleanPhone", () => {
  it("accepts a number written with spaces, brackets and dashes, as the CSV import does", () => {
    expect(cleanPhone(" +994 (50) 123-45-67 ")).toBe("+994501234567");
    expect(PHONE_PATTERN.test(cleanPhone("+994 50 123 45 67"))).toBe(true);
  });

  it("drops one leading spreadsheet text marker", () => {
    expect(cleanPhone("'+994501234567")).toBe("+994501234567");
  });

  it("accepts dots between groups, as sign-in by phone always did", () => {
    expect(cleanPhone("+994.50.123.45.67")).toBe("+994501234567");
    expect(cleanPhone("+33 6.12.34.56.78")).toBe("+33612345678");
  });

  it("still rejects numbers without the country code or with letters", () => {
    expect(PHONE_PATTERN.test(cleanPhone("050 123 45 67"))).toBe(false);
    expect(PHONE_PATTERN.test(cleanPhone("+994 50 CALL ME"))).toBe(false);
    expect(PHONE_PATTERN.test(cleanPhone("+1234"))).toBe(false);
  });
});
