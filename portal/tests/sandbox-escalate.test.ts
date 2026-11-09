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
// The real permission gates (allowed, twoFactorGap, privileged) over the test's viewer.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../src/server/auth/viewer", async (importOriginal) => ({ ...(await importOriginal<typeof import("../src/server/auth/viewer")>()), actionViewer: async () => viewer }));

const { escalateAnalysisAction } = await import("../src/server/actions/security");

let analysisId = "";
let tenantId = "";
const as = (user: { id: string; role: string }, totpEnabled: boolean) => {
  viewer = { user: { id: user.id, role: user.role, totpEnabled }, tenant: { id: tenantId, features: new Set(["sandbox", "threat_intake"]), settings: { defaultLocale: "en", identity: { requireAdmin2fa: true } } } };
};
let learner: { id: string; role: string };
let analyst: { id: string; role: string };

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  [learner] = await db.insert(t.users).values({ tenantId: tenant.id, email: "me@acme.test", name: "Me" }).returning();
  [analyst] = await db.insert(t.users).values({ tenantId: tenant.id, email: "analyst@acme.test", name: "Analyst", role: "analyst" }).returning();
  const [a] = await db
    .insert(t.sandboxAnalyses)
    .values({ tenantId: tenant.id, number: 7, kind: "url", objectName: "https://evil.test", verdict: "malicious", score: 90, findings: [], iocs: [], mitre: [], submittedBy: learner.id })
    .returning();
  analysisId = a.id;
  as(learner, false);
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

  it("lets an analyst act on another person's analysis only once the organisation's mandatory two-step verification is set up", async () => {
    as(analyst, false);
    expect(await escalateAnalysisAction(analysisId)).toEqual({ ok: false });
    as(analyst, true);
    expect(await escalateAnalysisAction(analysisId)).toEqual({ ok: true });
    // The learner's own analysis needs no console permission, so no authenticator either.
    as(learner, false);
    expect(await escalateAnalysisAction(analysisId)).toEqual({ ok: true });
  });
});
