import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/** The proxy reads NODE_ENV and the HSTS flags; each case loads it fresh with its environment. */
async function run(path: string, env: Record<string, string>, headers: Record<string, string> = {}) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "production");
  // Production refuses a non-https APP_URL (server/env.ts); HTTPS-only headers follow it.
  vi.stubEnv("APP_URL", "https://portal.example.com");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { proxy } = await import("../src/proxy");
  return proxy(new NextRequest(`https://portal.example.com${path}`, { headers }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const PATHS = ["/az", "/", "/admin", "/api/health", "/_next/static/chunks/main.js", "/robots.txt", "/sw.js", "/favicon.ico", "/brand/logo.svg"];

describe("Strict-Transport-Security", () => {
  it("is the same on pages, redirects, API routes and static files", async () => {
    for (const [env, value] of [
      [{}, "max-age=63072000"],
      [{ HSTS_INCLUDE_SUBDOMAINS: "1" }, "max-age=63072000; includeSubDomains"],
      [{ HSTS_INCLUDE_SUBDOMAINS: "1", HSTS_PRELOAD: "1" }, "max-age=63072000; includeSubDomains; preload"],
      [{ HSTS_PRELOAD: "1" }, "max-age=63072000"],
    ] as const) {
      for (const path of PATHS) {
        const res = await run(path, env);
        expect(res.headers.get("strict-transport-security"), `${path} ${JSON.stringify(env)}`).toBe(value);
      }
    }
  });

  it("is set on prefetch requests too", async () => {
    const res = await run("/learn", { HSTS_INCLUDE_SUBDOMAINS: "1" }, { "next-router-prefetch": "1" });
    expect(res.headers.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("leaves API routes and assets without CSP, session redirect or cookies", async () => {
    for (const path of ["/api/health", "/_next/static/chunks/main.js", "/sw.js"]) {
      const res = await run(path, {});
      expect(res.headers.get("content-security-policy")).toBeNull();
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    const page = await run("/az", {});
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("is not sent outside production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    const { proxy } = await import("../src/proxy");
    for (const path of ["/az", "/api/health"]) expect(proxy(new NextRequest(`http://localhost:3000${path}`)).headers.get("strict-transport-security")).toBeNull();
  });
});
