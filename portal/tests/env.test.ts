import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "x".repeat(40);

/** env.ts validates at import time; each case loads it fresh with its own environment. */
async function load(vars: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import("../src/server/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appUrlProblem", async () => {
  const { appUrlProblem } = await load({});

  it("requires the variable", () => {
    expect(appUrlProblem(undefined, false)).toMatch(/must be set/);
    expect(appUrlProblem(undefined, true)).toMatch(/must be set/);
  });

  it("accepts a public https address", () => {
    expect(appUrlProblem("https://portal.example.com", false)).toBeNull();
    expect(appUrlProblem("https://portal.example.com:8443/", false)).toBeNull();
  });

  it("rejects loopback hosts and plain HTTP unless allowed", () => {
    for (const url of ["http://localhost:3000", "https://localhost", "https://app.localhost", "http://127.0.0.1:3000", "https://[::1]:3000", "http://0.0.0.0", "https://LOCALHOST."]) {
      expect(appUrlProblem(url, false), url).toMatch(/local machine/);
      expect(appUrlProblem(url, true), url).toBeNull();
    }
    expect(appUrlProblem("http://portal.intranet.example", false)).toMatch(/https/);
    expect(appUrlProblem("http://portal.intranet.example", true)).toBeNull();
  });

  it("rejects non-web schemes even when HTTP is allowed", () => {
    expect(appUrlProblem("ftp://portal.example.com", true)).toMatch(/http\(s\)/);
  });
});

describe("production start-up", () => {
  it("refuses an unset or local APP_URL", async () => {
    await expect(load({ NODE_ENV: "production", APP_SECRET: SECRET, APP_URL: "" })).rejects.toThrow(/APP_URL must be set/);
    await expect(load({ NODE_ENV: "production", APP_SECRET: SECRET, APP_URL: "http://localhost:3000" })).rejects.toThrow(/APP_URL points to the local machine/);
  });

  it("starts with a public https address, or with the explicit opt-out", async () => {
    const { appUrl } = await load({ NODE_ENV: "production", APP_SECRET: SECRET, APP_URL: "https://portal.example.com/", TRUST_PROXY: "1" });
    expect(appUrl()).toBe("https://portal.example.com");
    const doubled = await load({ NODE_ENV: "production", APP_SECRET: SECRET, APP_URL: "https://portal.example.com//", TRUST_PROXY: "1" });
    expect(doubled.appUrl()).toBe("https://portal.example.com");
    await expect(load({ NODE_ENV: "production", APP_SECRET: SECRET, APP_URL: "http://localhost:3000", ALLOW_HTTP_APP_URL: "1", TRUST_PROXY: "1" })).resolves.toBeDefined();
  });

  it("warns when the SMS gateway is plain http", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = { NODE_ENV: "production", APP_SECRET: SECRET, APP_URL: "https://portal.example.com", TRUST_PROXY: "1", SMS_PROVIDER: "webhook" };
    await load({ ...base, SMS_WEBHOOK_URL: "http://sms.intranet.example/send" });
    expect(warn.mock.calls.some(([m]) => String(m).includes("SMS_WEBHOOK_URL"))).toBe(true);
    warn.mockClear();
    await load({ ...base, SMS_WEBHOOK_URL: "https://sms.example.com/send" });
    expect(warn.mock.calls.some(([m]) => String(m).includes("SMS_WEBHOOK_URL"))).toBe(false);
    warn.mockRestore();
  });

  it("does not need APP_URL during next build", async () => {
    await expect(load({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build", APP_URL: "" })).resolves.toBeDefined();
  });

  it("keeps the localhost default in development", async () => {
    const { appUrl } = await load({ NODE_ENV: "development", APP_URL: "" });
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
