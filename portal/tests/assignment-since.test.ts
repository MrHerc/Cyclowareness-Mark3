import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { resolveAssignments } from "../src/server/services/assignments";

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

let tenantId = "";
let moduleId = "";
let financeId = "";

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  const [mod] = await db
    .insert(t.modules)
    .values({ slug: "phishing-email", category: "phishing", audiences: [], title: { en: "Phishing" }, subtitle: { en: "" }, minutes: 10, xp: 100, difficulty: "Easy" })
    .returning();
  moduleId = mod.id;
  const [finance] = await db.insert(t.departments).values({ tenantId, name: "Finance", nameKey: "finance" }).returning();
  financeId = finance.id;
}, 180_000);

describe("resolveAssignments assignedAt", () => {
  it("counts from the activation and, for a department assignment, from the move into the department", async () => {
    const people = await db
      .insert(t.users)
      .values([
        { tenantId, email: "early@acme.test", name: "Early", locale: "en", departmentId: financeId, createdAt: day(1) },
        { tenantId, email: "invited@acme.test", name: "Invited", locale: "en", departmentId: financeId, createdAt: day(1), activatedAt: day(20) },
        { tenantId, email: "moved@acme.test", name: "Moved", locale: "en", departmentId: financeId, createdAt: day(1), departmentChangedAt: day(25) },
      ])
      .returning();
    const byEmail = new Map(people.map((p) => [p.email, p.id]));
    const [a] = await db.insert(t.assignments).values({ tenantId, moduleId, scope: "department", departmentId: financeId, dueKind: "none", createdAt: day(10) }).returning();
    const at = async () => {
      const resolved = await resolveAssignments(db, tenantId);
      return Object.fromEntries([...byEmail].map(([email, id]) => [email, resolved.get(id)?.get(moduleId)?.assignedAt.toISOString()]));
    };
    expect(await at()).toEqual({ "early@acme.test": day(10).toISOString(), "invited@acme.test": day(20).toISOString(), "moved@acme.test": day(25).toISOString() });
    // For an organisation-wide assignment a department move does not restart the clock.
    await db.update(t.assignments).set({ scope: "everyone", departmentId: null }).where(eq(t.assignments.id, a.id));
    expect((await at())["moved@acme.test"]).toBe(day(10).toISOString());
    expect((await at())["invited@acme.test"]).toBe(day(20).toISOString());
  });

  it("counts an 'after joining' due date from the activation, not the invite", async () => {
    const [m2] = await db
      .insert(t.modules)
      .values({ slug: "passwords", category: "passwords", audiences: [], title: { en: "Passwords" }, subtitle: { en: "" }, minutes: 10, xp: 100, difficulty: "Easy" })
      .returning();
    const people = await db
      .insert(t.users)
      .values([
        { tenantId, email: "joined@acme.test", name: "Joined", locale: "en", createdAt: day(1) },
        { tenantId, email: "accepted@acme.test", name: "Accepted", locale: "en", createdAt: day(1), activatedAt: day(20) },
      ])
      .returning();
    await db.insert(t.assignments).values({ tenantId, moduleId: m2.id, scope: "everyone", dueKind: "after_joining", dueDays: 14, createdAt: day(1) });
    const resolved = await resolveAssignments(db, tenantId);
    const due = (email: string) => resolved.get(people.find((p) => p.email === email)!.id)?.get(m2.id)?.due;
    expect(due("joined@acme.test")).toBe("2026-01-15");
    expect(due("accepted@acme.test")).toBe("2026-02-03");
  });

  it("counts 'after joining' from the Baku day of the activation", async () => {
    const [m3] = await db
      .insert(t.modules)
      .values({ slug: "mfa", category: "passwords", audiences: [], title: { en: "MFA" }, subtitle: { en: "" }, minutes: 10, xp: 100, difficulty: "Easy" })
      .returning();
    // 22:00 UTC on 9 Feb is 02:00 on 10 Feb in Baku: 14 days later is 24 Feb, not 23 Feb.
    const [late] = await db
      .insert(t.users)
      .values({ tenantId, email: "late-night@acme.test", name: "Late", locale: "en", createdAt: day(1), activatedAt: new Date("2026-02-09T22:00:00Z") })
      .returning();
    await db.insert(t.assignments).values({ tenantId, moduleId: m3.id, scope: "user", userId: late.id, dueKind: "after_joining", dueDays: 14, createdAt: day(1) });
    const resolved = await resolveAssignments(db, tenantId, [late.id]);
    expect(resolved.get(late.id)?.get(m3.id)?.due).toBe("2026-02-24");
  });
});
