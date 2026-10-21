import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { departmentKey } from "../src/lib/departments";
import { isUniqueViolation } from "../src/server/db/errors";

// Only the department action's own database writes are under test here.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/services/notify", () => ({ notifyUsers: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

let tenantId = "";
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({ user: { id: "00000000-0000-4000-8000-000000000001", role: "tenant_admin" }, tenant: { id: tenantId } }),
}));

const { saveDepartmentAction } = await import("../src/server/actions/workspace");

const names = async () =>
  (await db.select({ name: t.departments.name }).from(t.departments).where(eq(t.departments.tenantId, tenantId))).map((d) => d.name).sort();
const idOf = async (name: string) => (await db.select({ id: t.departments.id }).from(t.departments).where(eq(t.departments.name, name)))[0].id;

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("departmentKey", () => {
  it("folds case, surrounding space and the dotted/dotless i, and keeps different names apart", () => {
    expect(departmentKey(" SALES ")).toBe(departmentKey("Sales"));
    expect(departmentKey("İT")).toBe(departmentKey("it"));
    expect(departmentKey("SATIŞ")).toBe(departmentKey("satiş"));
    expect(departmentKey("Satış")).not.toBe(departmentKey("Sales"));
  });
});

describe("saveDepartmentAction names", () => {
  it("refuses creating or renaming into a name another department already has, ignoring case and i-variants", async () => {
    expect(await saveDepartmentAction({ name: "Sales", parentId: null, headUserId: null })).toEqual({ ok: true });
    expect(await saveDepartmentAction({ name: "İT", parentId: null, headUserId: null })).toEqual({ ok: true });
    expect(await saveDepartmentAction({ name: "SALES", parentId: null, headUserId: null })).toEqual({ ok: false, error: "duplicate" });
    expect(await saveDepartmentAction({ name: "it", parentId: null, headUserId: null })).toEqual({ ok: false, error: "duplicate" });

    const itDept = await idOf("İT");
    expect(await saveDepartmentAction({ id: itDept, name: "sales", parentId: null, headUserId: null })).toEqual({ ok: false, error: "duplicate" });
    // Its own name in another spelling is a rename, not a duplicate.
    expect(await saveDepartmentAction({ id: itDept, name: "IT", parentId: null, headUserId: null })).toEqual({ ok: true });
    expect(await names()).toEqual(["IT", "Sales"]);
  });

  it("stores the key with each new name", async () => {
    const keys = await db.select({ name: t.departments.name, nameKey: t.departments.nameKey }).from(t.departments).where(eq(t.departments.tenantId, tenantId));
    expect(keys.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "IT", nameKey: "it" },
      { name: "Sales", nameKey: "sales" },
    ]);
  });

  it("still moves one of two look-alikes whose keys were stored by an earlier, case-keeping key", async () => {
    await db.insert(t.departments).values({ tenantId, name: "Finance", nameKey: "finance" });
    await db.insert(t.departments).values({ tenantId, name: "FINANCE", nameKey: "FINANCE" });
    expect(await saveDepartmentAction({ id: await idOf("FINANCE"), name: "FINANCE", parentId: await idOf("Sales"), headUserId: null })).toEqual({ ok: true });
  });
});

describe("department name uniqueness in the database", () => {
  it("refuses a second department with the same key in one organisation, not in another", async () => {
    await db.insert(t.departments).values({ tenantId, name: "Legal", nameKey: "legal" });
    const refused = await db
      .insert(t.departments)
      .values({ tenantId, name: "LEGAL", nameKey: "legal" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(isUniqueViolation(refused, "departments_tenant_name_key_idx")).toBe(true);
    const [other] = await db.insert(t.tenants).values({ slug: "other", name: "Other", branding: {} as never, settings: {} as never }).returning();
    await db.insert(t.departments).values({ tenantId: other.id, name: "Legal", nameKey: "legal" });
  });

  it("answers duplicate to the second of two saves racing to create look-alike names", async () => {
    // Both checks run before either insert: the unique index refuses the second one.
    const results = await Promise.all([saveDepartmentAction({ name: "Support", parentId: null, headUserId: null }), saveDepartmentAction({ name: "SUPPORT", parentId: null, headUserId: null })]);
    expect(results).toEqual([{ ok: true }, { ok: false, error: "duplicate" }]);
    expect((await names()).filter((n) => departmentKey(n) === "support")).toEqual(["Support"]);
  });

  it("answers duplicate to the second of two saves racing to rename into look-alike names", async () => {
    await saveDepartmentAction({ name: "Alpha", parentId: null, headUserId: null });
    await saveDepartmentAction({ name: "Beta", parentId: null, headUserId: null });
    const [alpha, beta] = [await idOf("Alpha"), await idOf("Beta")];
    const results = await Promise.all([saveDepartmentAction({ id: alpha, name: "Gamma", parentId: null, headUserId: null }), saveDepartmentAction({ id: beta, name: "GAMMA", parentId: null, headUserId: null })]);
    expect(results).toEqual([{ ok: true }, { ok: false, error: "duplicate" }]);
    expect((await names()).filter((n) => ["alpha", "beta", "gamma"].includes(departmentKey(n)))).toEqual(["Beta", "Gamma"]);
  });
});
