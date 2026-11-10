import { describe, expect, it, vi } from "vitest";

// Domain checks and test emails are limited per organisation: the limiter answers before DNS, mail or the database is touched.
const down = () => {
  throw new Error("database unavailable");
};
vi.mock("../src/server/db", () => ({ db: () => ({ select: down, insert: down, update: down, delete: down, transaction: down }), t: new Proxy({}, { get: () => ({}) }) }));
vi.mock("../src/server/rate-limit", async (original) => (await import("./helpers/db")).rateLimitOnPglite(await original()));
vi.mock("../src/server/env", () => ({ env: { TRUST_PROXY: 0, isProd: false, secret: "test-only-secret-0123456789-abcdefghij-0123456789" }, appUrl: () => "http://localhost:3000" }));
const TENANT = "00000000-0000-4000-8000-0000000000aa";
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({ user: { id: "00000000-0000-4000-8000-000000000001", locale: "en" }, tenant: { id: TENANT, name: "Acme", settings: { defaultLocale: "en" } } }),
  hasFeature: () => true,
}));
vi.mock("../src/server/auth/domain-proof", () => ({
  normaliseHost: (d: string) => d.trim().toLowerCase(),
  domainProofRecord: () => "record",
  domainProofRecords: () => ["record"],
  domainProofFound: async () => {
    throw new Error("dns reached");
  },
}));
vi.mock("../src/server/mail", () => ({ sendTestEmail: vi.fn(), resendableMail: vi.fn() }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key, getFormatter: vi.fn() }));

const { testEmailAction, verifyDomainAction } = await import("../src/server/actions/settings");
const { rateLimit } = await import("../src/server/rate-limit");

const fill = async (key: string, n: number) => {
  for (let i = 0; i < n; i++) await rateLimit(key, 1000, 60 * 60_000);
};

describe("settings rate limits", () => {
  it("lets the 20th domain check of the hour reach DNS and refuses the 21st", async () => {
    await fill(`domain-check:${TENANT}`, 19);
    await expect(verifyDomainAction("acme.test")).rejects.toThrow("dns reached");
    expect(await verifyDomainAction("acme.test")).toEqual({ ok: false, verified: false, found: false, kept: false, error: "rateLimited" });
  });

  it("lets the 20th test email of the hour go on and refuses the 21st", async () => {
    await fill(`test-email:${TENANT}`, 19);
    await expect(testEmailAction("admin@acme.test")).rejects.toThrow("database unavailable");
    expect(await testEmailAction("admin@acme.test")).toEqual({ ok: false, error: "rateLimited" });
  });
});
