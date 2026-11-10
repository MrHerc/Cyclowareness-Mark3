import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../src/server/crypto";

// A database that answers each select with the next queued result; writes succeed. The audit log is the only thing that fails.
const h = vi.hoisted(() => ({
  selects: [] as unknown[][],
  audit: vi.fn(async (): Promise<void> => undefined),
  setSessionCookie: vi.fn(async (): Promise<void> => undefined),
}));
vi.mock("../src/server/db", async () => {
  const query = (result: () => unknown[]) => {
    const q: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "orderBy", "values", "set", "innerJoin", "returning"]) q[m] = () => q;
    q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(result).then(resolve, reject);
    return q;
  };
  // An update answers with one changed row (the conditional updates of a one-time code then succeed).
  const fake = { select: () => query(() => h.selects.shift() ?? []), insert: () => query(() => []), update: () => query(() => [{ id: "row" }]), delete: () => query(() => []) };
  return { db: () => fake, t: await import("../src/server/db/schema") };
});
vi.mock("../src/server/rate-limit", async (original) => (await import("./helpers/db")).rateLimitOnPglite(await original()));
vi.mock("../src/server/env", () => ({ env: { TRUST_PROXY: 0, showOtp: false } }));
vi.mock("../src/server/request", async (original) => ({ ...(await original<typeof import("../src/server/request")>()), clientIp: async () => null, userAgent: async () => null }));
vi.mock("../src/server/auth/session", () => ({ createSession: async () => ({ token: "tok", id: "sid", expiresAt: new Date(Date.now() + 86_400_000) }), setSessionCookie: h.setSessionCookie }));
vi.mock("../src/server/auth/password", () => ({ hashPassword: async () => "hash", verifyPassword: async () => true, passwordProblem: () => null }));
vi.mock("../src/server/auth/viewer", () => ({ getSession: async () => null }));
vi.mock("../src/server/sms", () => ({ smsAvailable: () => true, sendSms: async () => ({ ok: true }) }));
vi.mock("../src/server/mail", () => ({ queueEmail: async () => undefined }));
vi.mock("../src/server/services/audit", () => ({ audit: h.audit }));
vi.mock("../src/server/services/progress", () => ({ randomToken: () => "x".repeat(16) }));
vi.mock("../src/server/auth/links", () => ({ issueAccountLink: async () => "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => undefined }), headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: () => undefined }));

const { requestPhoneCodeAction, signInAction, verifyPhoneCodeAction } = await import("../src/server/actions/auth");

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const user = { id: "u1", tenantId: "t1", role: "learner", status: "active", locale: "en", totpEnabled: false, email: "aysel@example.com", phone: "+994501234567", passwordHash: "hash" };
const redirectTo = (path: string) => ({ digest: expect.stringMatching(new RegExp(`^NEXT_REDIRECT;[a-z]+;${path.replace(/[/?]/g, "\\$&")};`)) });

beforeEach(() => {
  h.selects.length = 0;
  h.audit.mockReset();
  h.setSessionCookie.mockClear();
});

describe("sign-in once the session exists", () => {
  it("still signs in with a password when the audit write fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    h.audit.mockRejectedValue(new Error("audit table unavailable"));
    // failed attempts for the account, the user, the single sign-on domain lookup, the tenant settings
    h.selects.push([{ n: 0 }], [user], [], []);
    await expect(signInAction(undefined, form({ email: user.email, password: "correct horse", next: "/learn" }))).rejects.toMatchObject(redirectTo("/learn"));
    expect(h.setSessionCookie).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[auth] audit write failed error=Error at=at "));
    log.mockRestore();
  });

  it("still signs in with an SMS code when the audit write fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    h.audit.mockRejectedValue(new Error("audit table unavailable"));
    const token = { id: sha256Hex(`otp:${user.id}:123456`), userId: user.id, kind: "phone_otp", attempts: 0, expiresAt: new Date(Date.now() + 60_000), usedAt: null };
    // failed attempts for the number, the user with that number, the single sign-on domain lookup, the latest code, the tenant settings
    h.selects.push([{ n: 0 }], [user], [], [token], []);
    await expect(verifyPhoneCodeAction(undefined, form({ phone: user.phone, code: "123456", next: "/learn" }))).rejects.toMatchObject(redirectTo("/learn"));
    expect(h.setSessionCookie).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[auth] audit write failed error=Error at=at "));
    log.mockRestore();
  });
});

describe("phone code request refusals", () => {
  it("echo the number as typed so the field keeps it", async () => {
    expect(await requestPhoneCodeAction(undefined, form({ phone: " 12345 " }))).toEqual({ error: "phoneInvalid", step: "phone", phone: "12345" });
    h.selects.push([{ n: 5 }]);
    expect(await requestPhoneCodeAction(undefined, form({ phone: "+994 50 123 45 67" }))).toEqual({ error: "locked", step: "phone", phone: "+994 50 123 45 67" });
    // five codes per number in the window (failed attempts for the number before each request)
    for (let i = 0; i < 6; i++) h.selects.push([{ n: 0 }]);
    for (let i = 0; i < 5; i++) expect(await requestPhoneCodeAction(undefined, form({ phone: "+994501234568" }))).toEqual({ step: "code", phone: "+994501234568" });
    expect(await requestPhoneCodeAction(undefined, form({ phone: "+994501234568" }))).toEqual({ error: "rateLimited", step: "phone", phone: "+994501234568" });
  });
});
