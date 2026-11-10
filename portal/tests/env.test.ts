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

describe("key ring variables", () => {
  const PREVIOUS = "y".repeat(40);

  it("APP_SECRET_PREVIOUS: blank means no rotation, too short or equal to APP_SECRET refuses to start", async () => {
    const { env } = await load({ APP_SECRET: SECRET, APP_SECRET_PREVIOUS: "" });
    expect(env.previousSecret).toBeUndefined();
    const on = await load({ APP_SECRET: SECRET, APP_SECRET_PREVIOUS: PREVIOUS });
    expect(on.env.previousSecret).toBe(PREVIOUS);
    await expect(load({ APP_SECRET: SECRET, APP_SECRET_PREVIOUS: "short" })).rejects.toThrow(/APP_SECRET_PREVIOUS/);
    await expect(load({ APP_SECRET: SECRET, APP_SECRET_PREVIOUS: SECRET })).rejects.toThrow(/not the current APP_SECRET[\s\S]*APP_SECRET_PREVIOUS/);
    // The old key alone is not a configuration: production still needs the current one.
    await expect(load({ NODE_ENV: "production", APP_URL: "https://portal.example.com", TRUST_PROXY: "1", APP_SECRET_PREVIOUS: PREVIOUS })).rejects.toThrow(/APP_SECRET must be set in production/);
  });

  it("APP_DOMAIN_PROOF_SECRET: blank follows APP_SECRET, too short refuses, equal to APP_SECRET is the runbook's step 1", async () => {
    const { env } = await load({ APP_SECRET: SECRET, APP_DOMAIN_PROOF_SECRET: "" });
    expect(env.domainProofSecret).toBe(SECRET);
    const own = await load({ APP_SECRET: SECRET, APP_DOMAIN_PROOF_SECRET: PREVIOUS });
    expect(own.env.domainProofSecret).toBe(PREVIOUS);
    await expect(load({ APP_SECRET: SECRET, APP_DOMAIN_PROOF_SECRET: "short" })).rejects.toThrow(/APP_DOMAIN_PROOF_SECRET/);
    const pinned = await load({ APP_SECRET: SECRET, APP_DOMAIN_PROOF_SECRET: SECRET });
    expect(pinned.env.domainProofSecret).toBe(SECRET);
    await expect(load({ NODE_ENV: "production", APP_URL: "https://portal.example.com", TRUST_PROXY: "1", APP_DOMAIN_PROOF_SECRET: PREVIOUS })).rejects.toThrow(/APP_SECRET must be set in production/);
  });
});
