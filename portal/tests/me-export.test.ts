import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/auth/api", () => ({ rscProbe: () => null, deniedResponse: async (_: Request, status: number) => new Response(null, { status }) }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

let viewer: { user: { id: string }; tenant: { id: string; name: string; settings: { timeZone: string } } } | null = null;
vi.mock("../src/server/auth/viewer", () => ({ getViewer: async () => viewer }));

const { GET } = await import("../src/app/api/me/export/route");

const ROUTE = readFileSync(path.join(__dirname, "..", "src", "app", "api", "me", "export", "route.ts"), "utf8");

/** Tables that hold a person's rows but stay out of the download, and why. */
const NOT_EXPORTED: Record<string, string> = {
  authTokens: "live sign-in and reset links (secrets), valid for minutes",
  watermarkCodes: "leak-tracing codes: disclosing them defeats the watermark",
  assignments: "the organisation's training plan (shown on the learner's own pages)",
};

let me = "";
let other = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  [{ id: me }, { id: other }] = await db
    .insert(t.users)
    .values([
      { tenantId: tenant.id, email: "me@acme.test", name: "Me" },
      { tenantId: tenant.id, email: "other@acme.test", name: "Other" },
    ])
    .returning();
  const [campaign] = await db.insert(t.campaigns).values({ tenantId: tenant.id, name: "Q3 payroll lure", channel: "email", templateKey: "payroll", audience: "all", status: "running" }).returning();
  await db.insert(t.campaignRecipients).values([
    { campaignId: campaign.id, userId: me, token: "tokenmeaaaaaaaaaaa", sentAt: new Date(), clickedAt: new Date() },
    { campaignId: campaign.id, userId: other, token: "tokenotheraaaaaaaa", sentAt: new Date(), submittedAt: new Date() },
  ]);
  const [ticket] = await db.insert(t.supportTickets).values({ tenantId: tenant.id, number: 1, userId: me, category: "technical", priority: "low", subject: "Video", body: "The video does not play", slaDueAt: new Date() }).returning();
  await db.insert(t.ticketMessages).values([
    { ticketId: ticket.id, authorId: me, body: "The video does not play" },
    { ticketId: ticket.id, authorId: other, body: "Try another browser" },
  ]);
  await db.insert(t.problemReports).values([
    { tenantId: tenant.id, userId: me, message: "Typo in lesson 2" },
    { tenantId: tenant.id, userId: other, message: "Not mine" },
  ]);
  await db.insert(t.feedback).values({ tenantId: tenant.id, userId: me, rating: 4, topic: "platform", comment: "Nice" });
  await db.insert(t.threatReports).values({ tenantId: tenant.id, number: 1, reporterId: me, channel: "email", subject: "Odd mail", details: "Asked for my password", url: "https://evil.test" });
  await db.insert(t.sandboxAnalyses).values({ tenantId: tenant.id, number: 1, kind: "url", objectName: "https://evil.test", verdict: "malicious", score: 90, findings: [], iocs: [], mitre: [], submittedBy: me });
  await db.insert(t.sessions).values({ id: "session-hash", userId: me, tenantId: tenant.id, expiresAt: new Date(Date.now() + 86_400_000), ip: "198.51.100.7", userAgent: "Firefox" });
  viewer = { user: { id: me }, tenant: { id: tenant.id, name: tenant.name, settings: { timeZone: "Europe/Berlin" } } };
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("Download my data", () => {
  it("includes the person's simulation results and free-text records, and nobody else's", async () => {
    const res = await GET(new Request("http://localhost/api/me/export"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.simulations).toEqual([expect.objectContaining({ campaign: "Q3 payroll lure", channel: "email", submittedAt: null })]);
    expect(data.simulations[0].clickedAt).toBeTruthy();
    expect(JSON.stringify(data)).not.toContain("token");
    expect(data.supportTickets).toEqual([expect.objectContaining({ subject: "Video", body: "The video does not play" })]);
    expect(data.ticketMessages.map((m: { fromYou: boolean; body: string }) => [m.fromYou, m.body])).toEqual(
      expect.arrayContaining([
        [true, "The video does not play"],
        [false, "Try another browser"],
      ]),
    );
    expect(JSON.stringify(data.ticketMessages)).not.toContain(other);
    expect(data.problemReports).toEqual([expect.objectContaining({ message: "Typo in lesson 2" })]);
    expect(data.feedback).toEqual([expect.objectContaining({ rating: 4, comment: "Nice" })]);
    expect(data.reports).toEqual([expect.objectContaining({ details: "Asked for my password", url: "https://evil.test" })]);
    expect(data.sandbox).toEqual([expect.objectContaining({ objectName: "https://evil.test", verdict: "malicious" })]);
    expect(data.sessions).toEqual([expect.objectContaining({ ip: "198.51.100.7", userAgent: "Firefox" })]);
    expect(JSON.stringify(data.sessions)).not.toContain("session-hash");
  });

  it("covers every table that keeps rows about a person, or says why not", () => {
    const missing: string[] = [];
    for (const [name, table] of Object.entries(t)) {
      if (!(table instanceof PgTable)) continue;
      const subject = getTableConfig(table).columns.some((c) => ["user_id", "reporter_id", "submitted_by"].includes(c.name));
      if (subject && !ROUTE.includes(`t.${name}.`) && !(name in NOT_EXPORTED)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });
});
