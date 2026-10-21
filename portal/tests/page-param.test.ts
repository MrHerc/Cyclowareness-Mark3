import { describe, expect, it } from "vitest";
import { MAX_PAGE, pageParam } from "@/lib/page-param";

describe("pageParam", () => {
  it("reads plain page numbers", () => {
    expect(pageParam("1")).toBe(1);
    expect(pageParam("42")).toBe(42);
  });
  it("falls back to page 1 for anything that is not a plain number", () => {
    for (const v of ["1e400", "Infinity", "0x10", "-3", "2.5", " 4", "abc", "", null, undefined, "0", "1234567"]) expect(pageParam(v), String(v)).toBe(1);
  });
  it("clamps very deep pages", () => {
    expect(pageParam("999999")).toBe(MAX_PAGE);
  });
});
