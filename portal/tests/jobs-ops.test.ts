import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import { runJobs } from "../src/server/jobs";
import { addTenant, DB_SETUP_TIMEOUT, testDb } from "./helpers/db";

const { db, ready } = testDb();
const DAY = 86_400_000;
let tenantId = "";

beforeAll(async () => {
  await ready();
  tenantId = (await addTenant(db)).id;
}, DB_SETUP_TIMEOUT);

const demo = (name: string, createdAt: Date) => ({ name, email: `${name}@test.example`, organisation: "Org", country: "AZ", employees: "50-200", locale: "en", consentVersion: "2026-01-01", createdAt });
const answer = (id: string, createdAt: Date) => ({ id, tenantId, lessonId: crypto.randomUUID(), question: "q", answer: "a", model: "m", createdAt });

describe("job runner tick", () => {
  it("records its heartbeat at the end of every tick", async () => {
    const first = new Date("2026-11-05T10:00:00Z");
    const out = await runJobs(db, first);
    expect(out.tick).toBe(1);
    const second = new Date(first.getTime() + 60_000);
    await runJobs(db, second);
    const rows = await db.select().from(t.jobTicks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ job: "tick", ranAt: second });
    expect(rows[0].durationMs).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("deletes demo requests after 24 months and cached tutor answers after a year", async () => {
    const now = new Date("2026-11-06T10:00:00Z");
    await db.insert(t.demoRequests).values([demo("old", new Date(now.getTime() - 731 * DAY)), demo("recent", new Date(now.getTime() - 700 * DAY))]);
    await db.insert(t.tutorCache).values([answer("old", new Date(now.getTime() - 366 * DAY)), answer("recent", new Date(now.getTime() - 300 * DAY))]);
    globalThis.__jobsCleanupDay = undefined;
    await runJobs(db, now);
    expect((await db.select({ name: t.demoRequests.name }).from(t.demoRequests)).map((r) => r.name)).toEqual(["recent"]);
    expect((await db.select({ id: t.tutorCache.id }).from(t.tutorCache)).map((r) => r.id)).toEqual(["recent"]);
  }, 60_000);
});
