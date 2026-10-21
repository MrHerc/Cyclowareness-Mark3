import { beforeEach, describe, expect, it, vi } from "vitest";

// A database that is down: every query throws. The policy sign-off and the sandbox forms must then answer with the
// generic error instead of throwing (which would replace the page with the error boundary).
const down = () => {
  throw new Error("database unavailable");
};
vi.mock("../src/server/db", () => ({ db: () => ({ select: down, insert: down, update: down, delete: down }), t: new Proxy({}, { get: () => ({}) }) }));
const viewer = vi.fn(async (): Promise<unknown> => ({
  user: { id: "00000000-0000-4000-8000-000000000001" },
  tenant: { id: "00000000-0000-4000-8000-000000000002", features: new Set(["sandbox"]), settings: { defaultLocale: "en" } },
}));
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: () => viewer(), allowed: () => true }));
vi.mock("../src/server/auth/password", () => ({ verifyPassword: async () => true }));
vi.mock("../src/server/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));
vi.mock("../src/server/request", () => ({ clientIp: async () => null }));
vi.mock("../src/server/services/audit", () => ({ audit: async () => undefined }));
vi.mock("../src/server/services/threats", () => ({ insertNumbered: down, submitThreatReport: down }));
vi.mock("../src/server/services/events", () => ({ emitEvent: async () => undefined }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: async () => undefined }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));

const { signPolicyAction } = await import("../src/server/actions/policies");
const { analyzeAction } = await import("../src/server/actions/security");
const { redirect } = await import("next/navigation");

const form = (values: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const VERSION = "00000000-0000-4000-8000-0000000000aa";

describe("policy sign-off and sandbox actions on a database failure", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});
  beforeEach(() => viewer.mockClear());

  it("signing answers with the generic error", async () => {
    const log = quiet();
    expect(await signPolicyAction(undefined, form({ versionId: VERSION, agree: "on", password: "secret" }))).toEqual({ error: "generic" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("a file or link analysis answers with the generic error", async () => {
    const log = quiet();
    expect(await analyzeAction(undefined, form({ kind: "url", url: "https://example.com/login" }))).toEqual({ error: "generic" });
    expect(await analyzeAction(undefined, form({ kind: "file", file: new File(["hello"], "note.txt", { type: "text/plain" }) }))).toEqual({ error: "generic" });
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("answers refusals as before, without touching the database", async () => {
    expect(await signPolicyAction(undefined, form({ versionId: VERSION, password: "secret" }))).toEqual({ error: "agree" });
    expect(await analyzeAction(undefined, form({ kind: "url", url: "  " }))).toEqual({ error: "noUrl" });
    expect(await analyzeAction(undefined, form({ kind: "file" }))).toEqual({ error: "noFile" });
  });

  it("still lets redirect() through", async () => {
    const toSignIn = () => redirect("/sign-in");
    viewer.mockImplementationOnce(toSignIn).mockImplementationOnce(toSignIn);
    await expect(signPolicyAction(undefined, form({ versionId: VERSION, agree: "on" }))).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/sign-in;/) });
    await expect(analyzeAction(undefined, form({ kind: "url", url: "https://example.com" }))).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/sign-in;/) });
  });
});
