import { beforeEach, describe, expect, it, vi } from "vitest";

// Internationalised domains: the branded sender domain is stored in the ASCII form tenants.domain
// holds, and indicators under an xn-- top-level domain are recognised as addresses.
let saved: { branding?: { senderDomain?: string } } | undefined;
const fakeDb = {
  // The branding row is read under a row lock (select … for update) inside a transaction.
  select: () => ({ from: () => ({ where: () => ({ for: async () => [{ branding: { primary: "#112233", accent: "#445566" } }] }) }) }),
  update: () => ({ set: (v: typeof saved) => ((saved = v), { where: async () => undefined }) }),
  transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeDb),
};
vi.mock("../src/server/db", async () => ({ db: () => fakeDb, t: await import("../src/server/db/schema") }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(), getLocale: async () => "en" }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/request", () => ({ clientIp: async () => "127.0.0.1" }));
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({
    user: { id: "00000000-0000-4000-8000-000000000001", role: "tenant_admin" },
    tenant: { id: "00000000-0000-4000-8000-0000000000aa", features: new Set(["incidents"]) },
  }),
  allowed: () => true,
  hasFeature: () => true,
}));
const createIncident = vi.fn(async (_db: unknown, input: { iocs: unknown[] }) => (void input, { id: "i", number: 1 }));
vi.mock("../src/server/services/secops", () => ({ createIncident, assignIncidentTraining: vi.fn(), advanceLoop: vi.fn(), closeLoop: vi.fn(), createLoop: vi.fn(), targetTraining: vi.fn() }));

const { saveBrandingAction } = await import("../src/server/actions/settings");
const { createIncidentAction } = await import("../src/server/actions/secops");
const { analyzeFile } = await import("../src/server/sandbox/analyze");

const branding = (senderDomain: string) => saveBrandingAction({ name: "Acme", primary: "#112233", accent: "#445566", senderDomain });

beforeEach(() => {
  saved = undefined;
});

describe("branding sender domain", () => {
  it("accepts an internationalised domain and stores its ASCII form", async () => {
    expect(await branding("пример.рф")).toEqual({ ok: true });
    expect(saved?.branding?.senderDomain).toBe("xn--e1afmkfd.xn--p1ai");
    expect(await branding("Example.XN--P1AI")).toEqual({ ok: true });
    expect(saved?.branding?.senderDomain).toBe("example.xn--p1ai");
  });

  it("keeps ASCII and empty values and refuses what is not a domain", async () => {
    expect(await branding("mail.bank.az")).toEqual({ ok: true });
    expect(saved?.branding?.senderDomain).toBe("mail.bank.az");
    expect(await branding("")).toEqual({ ok: true });
    expect(saved?.branding?.senderDomain).toBeUndefined();
    saved = undefined;
    for (const bad of ["example.com/path", "no-tld", "a@b.az"]) {
      expect(await branding(bad)).toEqual({ ok: false, field: "senderDomain" });
    }
    expect(saved).toBeUndefined();
  });
});

describe("indicators under an xn-- top-level domain", () => {
  it("classifies an incident indicator as an email address", async () => {
    const res = await createIncidentAction({
      title: "Lure",
      description: "",
      severity: "high",
      source: "analyst",
      confidential: false,
      live: false,
      iocs: "user@xn--e1afmkfd.xn--p1ai\nuser@bank.az",
      mitre: "",
      moduleId: null,
      minScore: null,
      dueDate: null,
      departmentId: null,
      userIds: [],
      sandboxId: null,
      assignNow: false,
    });
    expect(res.ok).toBe(true);
    expect(createIncident.mock.calls[0][1].iocs).toEqual([
      { type: "email", value: "user@xn--e1afmkfd.xn--p1ai" },
      { type: "email", value: "user@bank.az" },
    ]);
  });

  it("extracts the whole address from a sandboxed file", () => {
    const a = analyzeFile("a.txt", Buffer.from("write to user@example.xn--p1ai or bob@evil.top"));
    expect(a.iocs.filter((i) => i.type === "email").map((i) => i.value)).toEqual(["user@example.xn--p1ai", "bob@evil.top"]);
  });
});
