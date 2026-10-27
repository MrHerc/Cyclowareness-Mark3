import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { recordLabAttempt } from "../src/server/lab/attempts";

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
let tenantId = "";
let userId = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  const [user] = await db.insert(t.users).values({ tenantId, email: "lab@acme.test", name: "Lab Learner" }).returning();
  userId = user.id;
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("lab attempts", () => {
  it("awards the day's lab XP once when several runs arrive at the same time", async () => {
    const run = (score: number) => recordLabAttempt(db, { tenantId, userId, exercise: "inbox-triage", score, max: 4, fullXp: 40 });
    const awarded = await Promise.all([run(4), run(4), run(4), run(4), run(4)]);
    expect(awarded.filter((xp) => xp > 0)).toEqual([40]);
    expect(await db.select().from(t.labAttempts).where(eq(t.labAttempts.userId, userId))).toHaveLength(5);
    expect(await db.select().from(t.xpEvents).where(eq(t.xpEvents.userId, userId))).toHaveLength(1);
    const [u] = await db.select({ xp: t.users.xp }).from(t.users).where(eq(t.users.id, userId));
    expect(u.xp).toBe(40);
    // Another lab still earns its own XP the same day.
    expect(await recordLabAttempt(db, { tenantId, userId, exercise: "link-detective", score: 1, max: 2, fullXp: 30 })).toBe(15);
  });
});
