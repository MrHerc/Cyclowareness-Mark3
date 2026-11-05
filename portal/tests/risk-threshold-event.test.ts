import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

const emitEvent = vi.fn();
vi.mock("../src/server/services/events", () => ({ emitEvent: (...a: unknown[]) => emitEvent(...a) }));
// The evidence is covered elsewhere: here the score is set directly.
let nextScore = 50;
vi.mock("../src/lib/domain/risk", async (orig) => ({ ...(await orig<typeof import("../src/lib/domain/risk")>()), riskScore: () => ({ score: nextScore }) }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
const { recomputeRisk } = await import("../src/server/services/risk");

let tenantId = "";
let userId = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  const [user] = await db.insert(t.users).values({ tenantId, email: "p@acme.test", name: "Person", locale: "en", status: "active" }).returning();
  userId = user.id;
}, 180_000);

const recompute = (score: number) => ((nextScore = score), recomputeRisk(db, tenantId, [userId]));

const setScore = (score: number) => db.update(t.users).set({ riskScore: score }).where(eq(t.users.id, userId));
const setThreshold = (riskThreshold?: number) => db.update(t.tenants).set({ settings: (riskThreshold ? { learning: { riskThreshold } } : {}) as never }).where(eq(t.tenants.id, tenantId));

describe("risk.threshold_crossed", () => {
  beforeEach(async () => {
    emitEvent.mockClear();
    await setScore(0);
    await setThreshold();
  });

  it("is emitted once per rise to the tenant's threshold, never while the score stays above or falls", async () => {
    await recompute(60);
    expect(emitEvent).not.toHaveBeenCalled();
    await recompute(80);
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenLastCalledWith(db, tenantId, "risk.threshold_crossed", { userId, score: 80, threshold: 67 });
    await recompute(90);
    await recompute(40);
    expect(emitEvent).toHaveBeenCalledTimes(1);
    await recompute(67);
    expect(emitEvent).toHaveBeenCalledTimes(2);
  });

  it("uses the threshold set in the tenant's learning settings", async () => {
    await setThreshold(80);
    await recompute(75);
    expect(emitEvent).not.toHaveBeenCalled();
    await recompute(80);
    expect(emitEvent).toHaveBeenLastCalledWith(db, tenantId, "risk.threshold_crossed", { userId, score: 80, threshold: 80 });
  });

  it("is emitted once when two recomputes for the same person run at the same time", async () => {
    nextScore = 85;
    await Promise.all([recomputeRisk(db, tenantId, [userId]), recomputeRisk(db, tenantId, [userId])]);
    expect(emitEvent).toHaveBeenCalledTimes(1);
  });
});
