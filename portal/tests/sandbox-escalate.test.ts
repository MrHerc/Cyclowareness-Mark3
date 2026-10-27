import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("../src/server/request", () => ({ clientIp: async () => "127.0.0.1" }));
vi.mock("../src/server/services/events", () => ({ emitEvent: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/sandbox/analyze", () => ({}));
const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;

// Stores the report as the real service does, without its XP, notifications and events.
const submitThreatReport = vi.fn(async (_: DB, p: { tenantId: string; userId: string; channel: "link" | "file"; subject: string; url: string | null }) => {
  await db.insert(t.threatReports).values({ tenantId: p.tenantId, number: submitThreatReport.mock.calls.length, reporterId: p.userId, channel: p.channel, subject: p.subject, url: p.url });
  return { number: 1, simulation: false, xp: 0 };
});
vi.mock("../src/server/services/threats", () => ({ submitThreatReport: (...args: Parameters<typeof submitThreatReport>) => submitThreatReport(...args), insertNumbered: vi.fn() }));
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

let viewer: unknown = null;
vi.mock("../src/server/auth/viewer", () => ({ actionViewer: async () => viewer, allowed: () => false }));

const { escalateAnalysisAction } = await import("../src/server/actions/security");

let analysisId = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  const [user] = await db.insert(t.users).values({ tenantId: tenant.id, email: "me@acme.test", name: "Me" }).returning();
  const [a] = await db
    .insert(t.sandboxAnalyses)
    .values({ tenantId: tenant.id, number: 7, kind: "url", objectName: "https://evil.test", verdict: "malicious", score: 90, findings: [], iocs: [], mitre: [], submittedBy: user.id })
    .returning();
  analysisId = a.id;
  viewer = { user: { id: user.id, role: "learner" }, tenant: { id: tenant.id, features: new Set(["sandbox"]), settings: { defaultLocale: "en" } } };
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("escalating a sandbox result", () => {
  it("sends one threat report per analysis, however often it is clicked", async () => {
    expect(await escalateAnalysisAction(analysisId)).toEqual({ ok: true });
    expect(await escalateAnalysisAction(analysisId)).toEqual({ ok: true });
    expect(await escalateAnalysisAction(analysisId)).toEqual({ ok: true });
    expect(submitThreatReport).toHaveBeenCalledTimes(1);
    expect(submitThreatReport.mock.calls[0][1]).toMatchObject({ subject: "SB-7: https://evil.test", url: "https://evil.test" });
  });
});
