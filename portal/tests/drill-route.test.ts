import { describe, expect, it, vi } from "vitest";

// The drill poll changes data, so it is a POST behind the same-origin check; the GET only reads.
const advanceDrill = vi.fn(async () => ({ id: "run" }));
const drillById = vi.fn(async () => ({ id: "run" }));
const drillView = vi.fn(async () => ({ id: "run", status: "running" }));
vi.mock("../src/server/services/drill", () => ({ advanceDrill, drillById, drillView }));
vi.mock("../src/server/db", () => ({ db: () => ({}) }));
vi.mock("../src/server/env", () => ({ env: { TRUST_PROXY: 0 }, appUrl: () => "http://localhost:3000" }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
let features = new Set(["campaigns", "live_drill"]);
vi.mock("../src/server/auth/api", () => ({ apiViewer: async () => ({ user: { id: "u" }, tenant: { id: "t", features } }) }));

const route = await import("../src/app/api/admin/drill/[id]/route");
const id = "00000000-0000-4000-8000-000000000001";
const ctx = { params: Promise.resolve({ id }) };
const url = `http://localhost:3000/api/admin/drill/${id}`;

describe("drill poll route", () => {
  it("refuses a cross-site POST before touching the drill", async () => {
    const res = await route.POST(new Request(url, { method: "POST", headers: { origin: "https://evil.example" } }), ctx);
    expect(res.status).toBe(403);
    expect(advanceDrill).not.toHaveBeenCalled();
  });

  it("applies the due events on a same-origin POST", async () => {
    const res = await route.POST(new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" } }), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ id: "run", status: "running" });
    expect(advanceDrill).toHaveBeenCalledWith({}, "t", id);
  });

  it("only reads on GET", async () => {
    advanceDrill.mockClear();
    const res = await route.GET(new Request(url), ctx);
    expect(res.status).toBe(200);
    expect(drillById).toHaveBeenCalledWith({}, "t", id);
    expect(advanceDrill).not.toHaveBeenCalled();
  });

  it("answers 404 without the live_drill feature", async () => {
    features = new Set(["campaigns"]);
    expect((await route.GET(new Request(url), ctx)).status).toBe(404);
  });
});
