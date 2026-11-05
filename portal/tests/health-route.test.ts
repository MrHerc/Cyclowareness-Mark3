import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { addTenant, DB_SETUP_TIMEOUT, testDb } from "./helpers/db";

const { db, ready } = testDb();
let current: DB = db;
vi.mock("@/server/db", () => ({ db: () => current }));
vi.mock("@/server/env", () => ({ env: { TRUST_PROXY: 1, CLIENT_IP_HEADER: "x-forwarded-for" } }));
const viewer = vi.fn(async (): Promise<unknown> => null);
vi.mock("@/server/auth/viewer", () => ({
  getViewer: () => viewer(),
  allowed: (v: { user: { role: string } }) => v.user.role === "super_admin",
  twoFactorGap: () => false,
}));

const { GET } = await import("../src/app/api/health/route");
const probe = (headers: Record<string, string> = {}) => GET(new Request("http://localhost/api/health", { headers }));

let tenantId = "";
beforeAll(async () => {
  await ready();
  tenantId = (await addTenant(db)).id;
}, DB_SETUP_TIMEOUT);

beforeEach(async () => {
  current = db;
  viewer.mockReset().mockResolvedValue(null);
  await db.delete(t.jobTicks);
  await db.delete(t.outbox);
  await db.delete(t.webhookDeliveries);
});

const mail = (status: "queued" | "sent") => ({ to: "a@test.example", subject: "s", html: "h", text: "t", kind: "invite", status });
const hook = (status: "queued" | "delivered") => ({ tenantId, event: "test", target: "webhook" as const, payload: {}, status });

describe("GET /api/health", () => {
  it("answers 200 with a stale job runner before the first tick", async () => {
    const res = await probe();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ db: "ok", jobs: { lastTickAt: null, stale: true }, backlog: { mail: 0, webhooks: 0 } });
  });

  it("reports the last tick and counts only what still waits for delivery", async () => {
    const ranAt = new Date(Date.now() - 60_000);
    await db.insert(t.jobTicks).values({ job: "tick", ranAt, durationMs: 120 });
    await db.insert(t.outbox).values([mail("queued"), mail("queued"), mail("sent")]);
    await db.insert(t.webhookDeliveries).values([hook("queued"), hook("delivered")]);
    expect(await (await probe()).json()).toEqual({ db: "ok", jobs: { lastTickAt: ranAt.toISOString(), stale: false }, backlog: { mail: 2, webhooks: 1 } });
  });

  it("marks the job runner stale after five minutes without a tick, still with 200", async () => {
    await db.insert(t.jobTicks).values({ job: "tick", ranAt: new Date(Date.now() - 6 * 60_000), durationMs: 120 });
    const res = await probe();
    expect(res.status).toBe(200);
    expect((await res.json()).jobs.stale).toBe(true);
  });

  it("answers 503 when the database cannot run a query", async () => {
    current = { execute: () => Promise.reject(new Error("connection refused")) } as unknown as DB;
    const res = await probe();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ db: "unavailable" });
  });

  it("shows the derived client address to the platform operator only", async () => {
    const headers = { "x-forwarded-for": "198.51.100.7, 203.0.113.9" };
    expect(await (await probe(headers)).json()).not.toHaveProperty("client");
    viewer.mockResolvedValue({ user: { role: "tenant_admin" } });
    expect(await (await probe(headers)).json()).not.toHaveProperty("client");
    viewer.mockResolvedValue({ user: { role: "super_admin" } });
    expect((await (await probe(headers)).json()).client).toEqual({ address: "203.0.113.9", forwardedFor: "198.51.100.7, 203.0.113.9", realIp: null, trustProxy: 1 });
  });

  it("keeps answering 200 when the session lookup fails", async () => {
    viewer.mockRejectedValue(new Error("boom"));
    expect((await probe()).status).toBe(200);
  });
});
