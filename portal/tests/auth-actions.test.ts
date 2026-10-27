import { describe, expect, it, vi } from "vitest";

// A database that is down: every query throws. The sign-in forms must then stay on the form with what was typed.
const down = () => {
  throw new Error("database unavailable");
};
vi.mock("../src/server/db", () => ({ db: () => ({ select: down, insert: down, update: down, delete: down }), t: {} }));
vi.mock("../src/server/env", () => ({ env: { TRUST_PROXY: 0, showOtp: false } }));
vi.mock("../src/server/request", async (original) => ({ ...(await original<typeof import("../src/server/request")>()), clientIp: async () => null, userAgent: async () => null }));
vi.mock("../src/server/auth/session", () => ({}));
const getSession = vi.fn(async (): Promise<unknown> => null);
vi.mock("../src/server/auth/viewer", () => ({ getSession: () => getSession() }));
vi.mock("../src/server/sms", () => ({ smsAvailable: () => true, sendSms: async () => ({ ok: true }) }));
vi.mock("../src/server/mail", () => ({ queueEmail: async () => undefined }));
vi.mock("../src/server/services/audit", () => ({ audit: async () => undefined }));
vi.mock("../src/server/services/progress", () => ({ randomToken: () => "x".repeat(16) }));
vi.mock("../src/server/auth/links", () => ({ issueAccountLink: async () => "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => undefined }), headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: () => undefined }));

const { checkEmailAction, setPasswordAction, signInAction, verifyPhoneCodeAction, verifySecondFactorAction } = await import("../src/server/actions/auth");

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};

describe("auth form actions on a database failure", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

  it("keeps the email and the step with the translated try-again error", async () => {
    const log = quiet();
    expect(await checkEmailAction(undefined, form({ email: " Aysel@Example.com " }))).toEqual({ error: "generic", email: "Aysel@Example.com" });
    expect(await signInAction(undefined, form({ email: "Aysel@Example.com", password: "secret", next: "/" }))).toEqual({ error: "generic", step: "password", email: "aysel@example.com" });
    expect(await verifyPhoneCodeAction(undefined, form({ phone: "+994501234567", code: "123456" }))).toEqual({ error: "generic", step: "code", phone: "+994501234567" });
    expect(await setPasswordAction(undefined, form({ token: "t", kind: "reset", password: "x", confirm: "x" }))).toEqual({ error: "generic" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("still lets redirect() through", async () => {
    getSession.mockResolvedValue(null);
    await expect(verifySecondFactorAction(undefined, form({ code: "123456" }))).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/sign-in;/) });
  });

  it("answers validation errors as before, without touching the database", async () => {
    expect(await signInAction(undefined, form({ email: "not-an-email", password: "x" }))).toEqual({ error: "emailInvalid", step: "email" });
  });
});
