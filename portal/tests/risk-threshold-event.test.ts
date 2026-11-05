import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

const emitEvent = vi.fn();
vi.mock("../src/server/services/events", () => ({ emitEvent: (...a: unknown[]) => emitEvent(...a) }));
// The evidence is covered elsewhere: here the score is set directly, the band logic is the real one.
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

describe("risk.threshold_crossed", () => {
  it("is emitted once per rise into the high band, never while the score stays high or falls", async () => {
    await recompute(60);
    expect(emitEvent).not.toHaveBeenCalled();
    await recompute(80);
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenLastCalledWith(db, tenantId, "risk.threshold_crossed", { userId, score: 80, band: "high" });
    await recompute(90);
    await recompute(40);
    expect(emitEvent).toHaveBeenCalledTimes(1);
    await recompute(67);
    expect(emitEvent).toHaveBeenCalledTimes(2);
  });
});
