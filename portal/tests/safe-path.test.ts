import { describe, expect, it } from "vitest";
import { safePath } from "../src/lib/safe-path";

describe("safePath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safePath("/learn/phishing-email?step=2#top")).toBe("/learn/phishing-email?step=2#top");
    expect(safePath("/admin/users/1d015b5b-1d22-4ce5-aaca-67504e3bd787")).toBe("/admin/users/1d015b5b-1d22-4ce5-aaca-67504e3bd787");
    expect(safePath("/app")).toBe("/app");
  });

  it("sends the bare root (the public site) to the app Home", () => {
    expect(safePath("/")).toBe("/app");
    expect(safePath("/?x=1")).toBe("/app");
  });

  it("falls back for other origins however they are spelled", () => {
    for (const v of ["//evil.example", "/\\evil.example", "/\\\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r\n/evil.example", "https://evil.example/x", "javascript:alert(1)"]) {
      expect(safePath(v), JSON.stringify(v)).toBe("/app");
    }
    // Dot segments that collapse into "//host" once the path is normalised.
    for (const v of ["/.//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/..//evil.com", "/%2e%2e//evil.com", "/x/./..//evil.com/p?q=1"]) {
      expect(safePath(v), JSON.stringify(v)).toBe("/app");
    }
    // Backslash, tab and newline forms, raw (a decoded ?from= or ?next=) and after a dot segment.
    for (const v of ["/\\evil.com", "/.\\evil.com", "/./\\/evil.com", "/\t/evil.com", "/./\t/evil.com", "/\n/evil.com"]) {
      expect(safePath(v), JSON.stringify(v)).toBe("/app");
    }
    // Percent-encoded control characters stay encoded in a path, so this is a same-site path, not a host.
    expect(safePath("/%09/evil.example/")).toBe("/%09/evil.example/");
  });

  it("rejects non-strings, relative values and the sign-in pages", () => {
    expect(safePath(null)).toBe("/app");
    expect(safePath(undefined)).toBe("/app");
    expect(safePath("learn")).toBe("/app");
    expect(safePath("/sign-in")).toBe("/app");
    expect(safePath("/sign-in/verify?next=/x")).toBe("/app");
    expect(safePath("/login")).toBe("/app");
    expect(safePath("/login?next=/x")).toBe("/app");
    expect(safePath("", "/learn")).toBe("/learn");
  });
});
