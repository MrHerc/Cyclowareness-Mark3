import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";

// rateLimit() counts in the server's database; here that is an in-memory PGlite.
const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", () => ({ db: () => db }));
const { rateLimit, rateLimitIn, RATE_LIMIT_MAX_WINDOW_MS } = await import("../src/server/rate-limit");

const count = async (key: string) => (await db.select().from(t.rateLimitBuckets).where(eq(t.rateLimitBuckets.key, key))).map((r) => r.count);

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
}, 180_000);

describe("rateLimit", () => {
  it("allows the limit within a window and refuses the next request, in the shared table", async () => {
    for (let i = 0; i < 20; i++) expect((await rateLimit("tutor:a", 20, 60 * 60_000)).ok).toBe(true);
    const refused = await rateLimit("tutor:a", 20, 60 * 60_000);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfterMs).toBeGreaterThan(0);
    expect(refused.retryAfterMs).toBeLessThanOrEqual(60 * 60_000);
    // Other keys have their own bucket.
    expect((await rateLimit("tutor:b", 20, 60 * 60_000)).ok).toBe(true);
    expect((await count("tutor:a")).reduce((a, b) => a + b, 0)).toBe(21);
  });

  it("refuses a window longer than the clean-up keeps", async () => {
    await expect(rateLimit("long", 1, RATE_LIMIT_MAX_WINDOW_MS + 1)).rejects.toThrow();
  });
});

describe("rateLimitIn (shared table)", () => {

  it("counts concurrent calls in one shared row", async () => {
    const now = Date.UTC(2026, 9, 20, 12, 0, 30);
    const [a, b] = await Promise.all([rateLimitIn(db, "tutor:x", 1, 60_000, now), rateLimitIn(db, "tutor:x", 1, 60_000, now)]);
    // Exactly one of the two gets the last allowed request.
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(await count("tutor:x")).toEqual([2]);
    const refused = a.ok ? b : a;
    expect(refused.retryAfterMs).toBe(30_000);
  });

  it("allows the limit, refuses the next request and starts over in the next window", async () => {
    const now = Date.UTC(2026, 9, 20, 13, 0, 0);
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimitIn(db, "report:y", 3, 60 * 60_000, now + i)).ok);
    expect(results).toEqual([true, true, true, false]);
    expect((await rateLimitIn(db, "report:other", 3, 60 * 60_000, now)).ok).toBe(true);
    expect((await rateLimitIn(db, "report:y", 3, 60 * 60_000, now + 60 * 60_000)).ok).toBe(true);
    expect(await count("report:y")).toEqual(expect.arrayContaining([4, 1]));
  });
});
