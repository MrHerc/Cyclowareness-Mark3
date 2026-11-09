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

const CLIP = `/generated/tts/az/${"a".repeat(64)}.mp3`;
const PATHS = ["/az", "/", "/admin", "/api/health", "/_next/static/chunks/main.js", "/robots.txt", "/sw.js", "/favicon.ico", "/brand/logo.svg", CLIP];

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
    for (const path of ["/api/health", "/_next/static/chunks/main.js", "/sw.js", CLIP]) {
      const res = await run(path, {});
      expect(res.headers.get("content-security-policy")).toBeNull();
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    const page = await run("/az", {});
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("sends the full production CSP and never forwards a client-sent nonce or policy", async () => {
    const page = await run("/az", {}, { "x-nonce": "evil", "content-security-policy": "default-src *", "x-pathname": "/admin" });
    const policy = page.headers.get("content-security-policy")!;
    expect(policy).toMatch(/(^|; )script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic' 'wasm-unsafe-eval'(;|$)/);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("ws:");
    for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "form-action 'self'", "base-uri 'self'", "upgrade-insecure-requests"]) {
      expect(policy.split("; ")).toContain(directive);
    }
    // The page reads x-nonce and content-security-policy from the request: both must be the proxy's values.
    const nonce = page.headers.get("x-middleware-request-x-nonce");
    expect(nonce).not.toBe("evil");
    expect(policy).toContain(`'nonce-${nonce}'`);
    expect(page.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(page.headers.get("x-middleware-request-x-pathname")).toBe("/az");
  });

  it("declares the build-time security headers for every path (next.config.ts)", async () => {
    const { default: config } = await import("../next.config");
    const rules = await config.headers!();
    const all = rules.find((r) => r.source === "/:path*")!.headers;
    expect(Object.fromEntries(all.map((h) => [h.key, h.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Permissions-Policy": "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
    });
    expect(config.poweredByHeader).toBe(false);
  });

  it("never renews the session cookie on narration clips, which are cached as immutable", async () => {
    const signedIn = { cookie: "__Host-cy_session=token" };
    expect((await run(CLIP, {}, signedIn)).headers.get("set-cookie")).toBeNull();
    expect((await run("/learn", {}, signedIn)).headers.get("set-cookie")).toContain("__Host-cy_session=token");
  });

  it("never forwards a language header the client sent (i18n/request.ts trusts x-site-locale)", async () => {
    // An API route, a prefetch of a page and a static file all take the passthrough branch.
    for (const [path, extra] of [["/api/subtitles", {}], ["/learn", { "next-router-prefetch": "1" }], ["/_next/static/chunks/main.js", {}]] as const) {
      const res = await run(path, {}, { "x-site-locale": "ar", ...extra });
      // The proxy overrides the request headers (an empty list is an override too), and x-site-locale is not among them.
      expect(res.headers.get("x-middleware-override-headers"), path).not.toBeNull();
      expect(res.headers.get("x-middleware-override-headers")?.split(","), path).not.toContain("x-site-locale");
      expect(res.headers.get("x-middleware-request-x-site-locale"), path).toBeNull();
    }
    const page = await run("/az", {}, { "x-site-locale": "ar" });
    expect(page.headers.get("x-middleware-request-x-site-locale")).toBe("az");
  });

  it("is not sent outside production", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    const { proxy } = await import("../src/proxy");
    for (const path of ["/az", "/api/health"]) expect(proxy(new NextRequest(`http://localhost:3000${path}`)).headers.get("strict-transport-security")).toBeNull();
  });
});

describe("public site language", () => {
  const root = async (headers: Record<string, string>) => new URL((await run("/", {}, headers)).headers.get("location")!).pathname;

  it("sends / to the browser's language, then the country's, and ignores a cookie for a removed language", async () => {
    expect(await root({ "accept-language": "ar-EG,ar;q=0.9" })).toBe("/ar");
    expect(await root({ "cf-ipcountry": "SA" })).toBe("/ar");
    expect(await root({ "cf-ipcountry": "IT", "accept-language": "it-IT,it;q=0.9" })).toBe("/az");
    expect(await root({ cookie: "locale=it", "accept-language": "de-DE" })).toBe("/de");
    expect(await root({ cookie: "locale=fr", "accept-language": "de-DE" })).toBe("/fr");
  });

  it("passes /ar on as the site language and remembers it, but not a removed language", async () => {
    const ar = await run("/ar", {});
    expect(ar.headers.get("x-middleware-request-x-site-locale")).toBe("ar");
    expect(ar.headers.get("set-cookie")).toContain("locale=ar");
    const italian = await run("/it", {});
    expect(italian.headers.get("x-middleware-request-x-site-locale")).toBeNull();
    expect(italian.headers.get("set-cookie") ?? "").not.toContain("locale=");
  });
});
