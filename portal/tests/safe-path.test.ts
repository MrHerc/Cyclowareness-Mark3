import { describe, expect, it } from "vitest";
import { safePath } from "../src/lib/safe-path";

describe("safePath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safePath("/learn/phishing-email?step=2#top")).toBe("/learn/phishing-email?step=2#top");
    expect(safePath("/admin/users/1d015b5b-1d22-4ce5-aaca-67504e3bd787")).toBe("/admin/users/1d015b5b-1d22-4ce5-aaca-67504e3bd787");
    expect(safePath("/")).toBe("/");
  });

  it("falls back for other origins however they are spelled", () => {
    for (const v of ["//evil.example", "/\\evil.example", "/\\\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r\n/evil.example", "https://evil.example/x", "javascript:alert(1)"]) {
      expect(safePath(v), JSON.stringify(v)).toBe("/");
    }
    // Percent-encoded control characters stay encoded in a path, so this is a same-site path, not a host.
    expect(safePath("/%09/evil.example/")).toBe("/%09/evil.example/");
  });

  it("rejects non-strings, relative values and the sign-in pages", () => {
    expect(safePath(null)).toBe("/");
    expect(safePath(undefined)).toBe("/");
    expect(safePath("learn")).toBe("/");
    expect(safePath("/sign-in")).toBe("/");
    expect(safePath("/sign-in/verify?next=/x")).toBe("/");
    expect(safePath("", "/learn")).toBe("/learn");
  });
});
