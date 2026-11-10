import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitOnPglite } from "./helpers/db";

// The refusal paths must not touch the database or mail; these stubs record any use.
const insert = vi.fn();
const limit = vi.fn(async (key: string, max: number, windowMs: number): Promise<{ ok: boolean }> => (void [key, max, windowMs], { ok: true }));
const ip = vi.fn(async (): Promise<string | null> => "203.0.113.9");
vi.mock("../src/server/db", () => ({ db: () => ({ insert }), t: { demoRequests: {} } }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: (key: string, max: number, windowMs: number) => limit(key, max, windowMs) }));
vi.mock("../src/server/request", async (original) => ({ ...(await original<typeof import("../src/server/request")>()), clientIp: () => ip() }));
const queueEmail = vi.fn();
vi.mock("../src/server/mail", () => ({ queueEmail: (...args: unknown[]) => queueEmail(...args) }));
vi.mock("../src/server/env", () => ({ env: { SALES_EMAIL: "sales@example.com" } }));

const { requestDemoAction } = await import("../src/server/actions/site");
const { rateLimit: realRateLimit } = await rateLimitOnPglite(await vi.importActual<typeof import("../src/server/rate-limit")>("../src/server/rate-limit"));

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const valid = {
  locale: "en",
  consentVersion: "2026-01-01",
  website: "",
  name: "Aysel Mammadova",
  email: "aysel@example.com",
  organisation: "Example LLC",
  country: "AZ",
  employees: "100to500",
  message: "Line one\nLine two",
  consent: "on",
};

describe("requestDemoAction", () => {
  beforeEach(() => {
    insert.mockReset();
    queueEmail.mockReset();
    limit.mockReset().mockResolvedValue({ ok: true });
    ip.mockReset().mockResolvedValue("203.0.113.9");
  });

  it("marks every refused field and echoes what was submitted so a no-JS form keeps it", async () => {
    const res = await requestDemoAction(undefined, form({ ...valid, name: "", email: "not-an-email", consent: "" }));
    expect(res?.error).toBe("invalid");
    expect(res?.fields).toEqual({ name: "required", email: "email", consent: "consent" });
    expect(res?.values).toEqual({
      name: "",
      email: "not-an-email",
      organisation: "Example LLC",
      country: "AZ",
      employees: "100to500",
      message: "Line one\nLine two",
      consent: false,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("caps echoed text to the field limits and drops unknown select options", async () => {
    const res = await requestDemoAction(undefined, form({ ...valid, email: "x", name: "n".repeat(5000), country: "ZZ", employees: "<script>" }));
    expect(res?.values?.name).toHaveLength(120);
    expect(res?.values?.country).toBe("");
    expect(res?.values?.employees).toBe("");
    expect(res?.fields).toMatchObject({ name: "required", country: "required", employees: "required" });
  });

  it("keeps the values when the per-IP limit refuses the request", async () => {
    limit.mockResolvedValue({ ok: false });
    const res = await requestDemoAction(undefined, form(valid));
    expect(res?.error).toBe("rateLimited");
    expect(res?.values?.email).toBe("aysel@example.com");
    expect(res?.values?.consent).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });

  it("limits by email, not one shared bucket, when the client address is unknown", async () => {
    ip.mockResolvedValue(null);
    limit.mockImplementation(realRateLimit);
    insert.mockReturnValue({ values: async () => undefined });
    // Six visitors with different addresses are all accepted: nobody can block the form for everyone.
    for (let i = 0; i < 6; i++) expect(await requestDemoAction(undefined, form({ ...valid, email: `visitor${i}@example.com` }))).toEqual({ ok: true });
    expect(limit).not.toHaveBeenCalledWith("demo:unknown", expect.anything(), expect.anything());
    // The same email repeated is limited after three requests an hour.
    const same = { ...valid, email: "repeat@example.com" };
    for (let i = 0; i < 3; i++) expect(await requestDemoAction(undefined, form(same))).toEqual({ ok: true });
    expect((await requestDemoAction(undefined, form(same)))?.error).toBe("rateLimited");
    expect(insert).toHaveBeenCalledTimes(9);
    expect(queueEmail).toHaveBeenCalledTimes(9);
  });

  it("never refuses anonymous visitors over the site-wide ceiling: stores the request but skips the sales mail", async () => {
    ip.mockResolvedValue(null);
    limit.mockImplementation(realRateLimit);
    insert.mockReturnValue({ values: async () => undefined });
    // A bot rotating emails (honeypot empty) uses up the 100-an-hour ceiling (the in-memory counter
    // is shared with the test above, so where exactly it lands is not fixed): every request is
    // accepted and stored, and the sales mail stops at the ceiling.
    for (let i = 0; i < 101; i++) expect(await requestDemoAction(undefined, form({ ...valid, email: `bot${i}@example.net` }))).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(101);
    const emailed = queueEmail.mock.calls.length;
    expect(emailed).toBeGreaterThan(0);
    expect(emailed).toBeLessThan(101);
    // A real visitor afterwards is still accepted and stored for the operator console, only not emailed to sales.
    expect(await requestDemoAction(undefined, form({ ...valid, email: "real@example.org" }))).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(102);
    expect(queueEmail).toHaveBeenCalledTimes(emailed);
  });

  it("stops storing anonymous requests past the storage ceiling but still answers with success", async () => {
    ip.mockResolvedValue(null);
    insert.mockReturnValue({ values: async () => undefined });
    // Per-email limit passes (a rotating bot), both site-wide ceilings are used up.
    limit.mockImplementation(async (key: string) => ({ ok: key.startsWith("demo:email:") }));
    const res = await requestDemoAction(undefined, form({ ...valid, email: "bot-flood@example.net" }));
    expect(res).toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith("demo:all", 100, 3_600_000);
    expect(limit).toHaveBeenCalledWith("demo:all:quiet", 400, 3_600_000);
  });

  it("stores at most 500 anonymous requests an hour while answering every one with success", async () => {
    ip.mockResolvedValue(null);
    insert.mockReturnValue({ values: async () => undefined });
    const counts = new Map<string, number>();
    limit.mockImplementation(async (key: string, max: number) => {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { ok: n <= max };
    });
    for (let i = 0; i < 700; i++) expect(await requestDemoAction(undefined, form({ ...valid, email: `rot${i}@example.net` }))).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(500);
    expect(queueEmail).toHaveBeenCalledTimes(100);
  });

  it("keeps the per-address limit when the client address is known", async () => {
    await requestDemoAction(undefined, form(valid));
    expect(limit).toHaveBeenCalledWith("demo:203.0.113.9", 5, 3_600_000);
  });

  it("puts requests from a known address through the site-wide ceilings too", async () => {
    insert.mockReturnValue({ values: async () => undefined });
    // The address and email limits pass (a distributed flood), both site-wide ceilings are used up.
    limit.mockImplementation(async (key: string) => ({ ok: !key.startsWith("demo:all") }));
    expect(await requestDemoAction(undefined, form(valid))).toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
    // Past the mail ceiling only: stored for the operator console, not mailed.
    limit.mockImplementation(async (key: string) => ({ ok: key !== "demo:all" }));
    expect(await requestDemoAction(undefined, form(valid))).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("refuses on the per-client limits before touching the site-wide ceilings", async () => {
    limit.mockImplementation(async (key: string) => ({ ok: key !== "demo:email:aysel@example.com" }));
    expect((await requestDemoAction(undefined, form(valid)))?.error).toBe("rateLimited");
    expect(limit).not.toHaveBeenCalledWith("demo:all", expect.anything(), expect.anything());
  });

  it("limits an IPv6 client by its /64, so rotating addresses within it does not reset the limit", async () => {
    limit.mockImplementation(realRateLimit);
    insert.mockReturnValue({ values: async () => undefined });
    for (let i = 1; i <= 5; i++) {
      ip.mockResolvedValue(`2001:db8:5:6::${i}`);
      expect(await requestDemoAction(undefined, form({ ...valid, email: `v6-${i}@example.net` }))).toEqual({ ok: true });
    }
    ip.mockResolvedValue("2001:db8:5:6:ffff:1234:5678:9abc");
    expect((await requestDemoAction(undefined, form({ ...valid, email: "v6-6@example.net" })))?.error).toBe("rateLimited");
    expect(limit).toHaveBeenCalledWith("demo:2001:db8:5:6::/64", 5, 3_600_000);
  });

  it("stays on the form with the values when the rate-limit store fails", async () => {
    limit.mockRejectedValue(new Error("database unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await requestDemoAction(undefined, form(valid));
    error.mockRestore();
    expect(res?.error).toBe("failed");
    expect(res?.values?.email).toBe("aysel@example.com");
    expect(res?.values?.message).toBe("Line one\nLine two");
    expect(insert).not.toHaveBeenCalled();
  });

  it("pretends success for a filled honeypot without storing or echoing anything", async () => {
    const res = await requestDemoAction(undefined, form({ ...valid, website: "spam.example" }));
    expect(res).toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();
  });
});
