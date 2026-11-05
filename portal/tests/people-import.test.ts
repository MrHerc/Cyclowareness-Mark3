import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as t from "../src/server/db/schema";
import type { DB } from "../src/server/db/client";
import { departmentKey } from "../src/lib/departments";
import { toCsv } from "../src/lib/csv";
import { LOCALES } from "../src/i18n/config";
import { ASSIGNABLE_ROLES } from "../src/server/auth/permissions";
import type { Role } from "../src/server/db/schema";

// Only the import's own database writes are under test here.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("../src/server/services/audit", () => ({ audit: vi.fn() }));
vi.mock("../src/server/services/notify", () => ({ notifyUsers: vi.fn() }));
vi.mock("../src/server/services/risk", () => ({ recomputeRisk: vi.fn() }));
vi.mock("../src/server/services/assignments", () => ({}));
vi.mock("../src/server/queries/admin", () => ({}));
vi.mock("../src/server/auth/links", () => ({}));
vi.mock("../src/server/auth/session", () => ({}));
vi.mock("../src/server/request", () => ({ clientIp: async () => "127.0.0.1" }));

const pglite = new PGlite();
const db = drizzle(pglite, { schema: t }) as unknown as DB;
vi.mock("../src/server/db", async () => ({ db: () => db, t: await import("../src/server/db/schema") }));

let tenantId = "";
vi.mock("../src/server/auth/viewer", () => ({
  actionViewer: async () => ({
    user: { id: "00000000-0000-4000-8000-000000000001", role: "tenant_admin" },
    tenant: { id: tenantId, features: new Set(), settings: { defaultLocale: "en", email: { enabled: false } } },
  }),
}));

const { addPersonAction, importPeopleAction } = await import("../src/server/actions/people");

beforeAll(async () => {
  await migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  const [tenant] = await db.insert(t.tenants).values({ slug: "acme", name: "Acme", branding: {} as never, settings: {} as never }).returning();
  tenantId = tenant.id;
  await db.insert(t.departments).values({ tenantId, name: "Finance", nameKey: "finance" });
  // Starting the embedded database and applying the migrations takes a while.
}, 180_000);

describe("CSV import departments", () => {
  it("creates a department spelled two ways in one file once, under its first spelling, and matches existing ones case-insensitively", async () => {
    const csv = [
      "name,email,department",
      "Aysel Mammadova,aysel@acme.test,Sales",
      "Rauf Aliyev,rauf@acme.test,SALES",
      "Leyla Hasanova,leyla@acme.test,Satış",
      "Murad Guliyev,murad@acme.test,SATIŞ",
      "Nigar Huseynova,nigar@acme.test,finance",
    ].join("\n");

    const preview = await importPeopleAction(csv, false);
    expect(preview).toMatchObject({ ok: true, rows: 5, newDepartments: ["Sales", "Satış"] });

    const result = await importPeopleAction(csv, true);
    expect(result).toMatchObject({ ok: true, imported: 5, newDepartments: ["Sales", "Satış"] });

    const departments = await db.select().from(t.departments).where(eq(t.departments.tenantId, tenantId));
    expect(departments.map((d) => d.name).sort()).toEqual(["Finance", "Sales", "Satış"]);
    const idOf = new Map(departments.map((d) => [d.name, d.id]));
    const users = await db.select({ email: t.users.email, departmentId: t.users.departmentId }).from(t.users).where(eq(t.users.tenantId, tenantId));
    const deptOf = new Map(users.map((u) => [u.email, u.departmentId]));
    expect(deptOf.get("aysel@acme.test")).toBe(idOf.get("Sales"));
    expect(deptOf.get("rauf@acme.test")).toBe(idOf.get("Sales"));
    expect(deptOf.get("leyla@acme.test")).toBe(idOf.get("Satış"));
    expect(deptOf.get("murad@acme.test")).toBe(idOf.get("Satış"));
    expect(deptOf.get("nigar@acme.test")).toBe(idOf.get("Finance"));
  });
});

describe("CSV import department conflicts", () => {
  const usersByEmail = async (emails: string[]) => (await db.select({ email: t.users.email }).from(t.users).where(eq(t.users.tenantId, tenantId))).filter((u) => emails.includes(u.email));

  it("stores the key of each department it creates", async () => {
    const departments = await db.select({ name: t.departments.name, nameKey: t.departments.nameKey }).from(t.departments).where(eq(t.departments.tenantId, tenantId));
    for (const d of departments) expect(d.nameKey).toBe(departmentKey(d.name));
  });

  it("refuses a row whose department someone created between the check and the commit, and imports nothing", async () => {
    const csv = ["name,email,department", "Kamran Ismayilov,kamran@acme.test,Marketing", "Sevda Mammadli,sevda@acme.test,marketing"].join("\n");
    expect(await importPeopleAction(csv, false)).toMatchObject({ ok: true, newDepartments: ["Marketing"] });

    // Someone adds the department by hand after the commit's own check, just before it writes.
    const transaction = db.transaction.bind(db);
    vi.spyOn(db, "transaction").mockImplementationOnce(async (run, config) => {
      await db.insert(t.departments).values({ tenantId, name: "MARKETING", nameKey: departmentKey("MARKETING") });
      return transaction(run, config);
    });
    expect(await importPeopleAction(csv, true)).toMatchObject({ ok: false, problems: [{ line: 2, problem: "departmentTaken" }] });
    expect(await usersByEmail(["kamran@acme.test", "sevda@acme.test"])).toEqual([]);

    // Checked again, the file goes into the department that now exists.
    expect(await importPeopleAction(csv, true)).toMatchObject({ ok: true, imported: 2, newDepartments: [] });
    const marketing = await db.select({ name: t.departments.name }).from(t.departments).where(eq(t.departments.nameKey, "marketing"));
    expect(marketing).toEqual([{ name: "MARKETING" }]);
  });

  it("refuses a department name that matches more than one existing department", async () => {
    // Look-alikes can only exist with keys stored by an earlier departmentKey() (here one that kept case).
    await db.insert(t.departments).values({ tenantId, name: "Ops", nameKey: "ops" });
    await db.insert(t.departments).values({ tenantId, name: "OPS", nameKey: "OPS" });
    const csv = ["name,email,department", "Elvin Rzayev,elvin@acme.test,ops", "Gunel Aliyeva,gunel@acme.test,Finance"].join("\n");
    expect(await importPeopleAction(csv, false)).toEqual({ ok: false, rows: 2, problems: [{ line: 2, problem: "departmentAmbiguous" }], newDepartments: [] });
    expect(await importPeopleAction(csv, true)).toMatchObject({ ok: false, problems: [{ line: 2, problem: "departmentAmbiguous" }] });
    expect(await usersByEmail(["elvin@acme.test", "gunel@acme.test"])).toEqual([]);
  });
});

describe("CSV import roles", () => {
  it("refuses role words that only exist on every object, and accepts the listed ones", async () => {
    const csv = ["name,email,role", "Orxan Mammadov,orxan@acme.test,constructor", "Samir Aliyev,samir@acme.test,__proto__", "Lala Guliyeva,lala@acme.test,admin"].join("\n");
    expect(await importPeopleAction(csv, false)).toMatchObject({
      ok: false,
      problems: [
        { line: 2, problem: "role" },
        { line: 3, problem: "role" },
      ],
    });
  });

  it("imports the role names the people export writes in every interface language", async () => {
    const people = LOCALES.flatMap((l) => {
      const names = (JSON.parse(fs.readFileSync(path.join(__dirname, "..", "messages", l, "common.json"), "utf8")) as { roles: Record<Role, string> }).roles;
      return ASSIGNABLE_ROLES.map((role) => ({ email: `${l}.${role}@acme.test`, role, written: names[role] }));
    });
    const csv = toCsv(["name", "email", "role"], people.map((p) => [`Person ${p.email}`, p.email, p.written]));
    expect(await importPeopleAction(csv, true)).toMatchObject({ ok: true, problems: [], imported: people.length });
    const users = await db.select({ email: t.users.email, role: t.users.role }).from(t.users).where(eq(t.users.tenantId, tenantId));
    const roleOf = new Map(users.map((u) => [u.email, u.role]));
    for (const p of people) expect(roleOf.get(p.email), `${p.email} (${p.written})`).toBe(p.role);
  });
});

describe("Add person", () => {
  const form = (email: string) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ name: "Tural Hasanov", email, role: "learner", locale: "en" })) f.set(k, v);
    return f;
  };

  it("answers a database failure with a notice the dialog can show, instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    vi.spyOn(db, "insert").mockImplementationOnce((() => ({
      values: () => ({ returning: () => Promise.reject(Object.assign(new Error("terminating connection"), { code: "57P01" })) }),
    })) as never);
    expect(await addPersonAction(undefined, form("tural@acme.test"))).toEqual({ error: "generic" });
    // The unique indexes still answer with their own messages.
    expect(await addPersonAction(undefined, form("tural@acme.test"))).toEqual({ ok: true, name: "Tural Hasanov" });
    expect(await addPersonAction(undefined, form("tural@acme.test"))).toEqual({ error: "emailTaken" });
  });
});

describe("Existence oracle and limits", () => {
  const add = (values: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ name: "Nigar Aliyeva", role: "learner", locale: "en", ...values })) f.set(k, v);
    return f;
  };

  it("names an account only within the organisation; outside it the address or number just cannot be added", async () => {
    const [other] = await db.insert(t.tenants).values({ slug: "other", name: "Other", branding: {} as never, settings: {} as never }).returning();
    await db.insert(t.users).values({ tenantId: other.id, email: "guest@other.test", name: "Guest", phone: "+994501234599" });
    await db.insert(t.users).values({ tenantId, email: "ours@acme.test", name: "Ours", phone: "+994501234588" });
    const csv = toCsv(
      ["name", "email", "phone"],
      [
        ["A", "guest@other.test", ""],
        ["B", "ours@acme.test", ""],
        ["C", "c@acme.test", "+994501234599"],
        ["D", "d@acme.test", "+994501234588"],
      ],
    );
    expect((await importPeopleAction(csv, false)).problems).toEqual([
      { line: 2, problem: "cannotAdd" },
      { line: 3, problem: "exists" },
      { line: 4, problem: "cannotAdd" },
      { line: 5, problem: "phoneTaken" },
    ]);
    expect(await addPersonAction(undefined, add({ email: "guest@other.test" }))).toEqual({ error: "cannotAdd" });
    expect(await addPersonAction(undefined, add({ email: "ours@acme.test" }))).toEqual({ error: "emailTaken" });
    expect(await addPersonAction(undefined, add({ email: "e@acme.test", phone: "+994501234599" }))).toEqual({ error: "cannotAdd" });
    expect(await addPersonAction(undefined, add({ email: "e@acme.test", phone: "+994501234588" }))).toEqual({ error: "phoneTaken" });
  });

  it("limits checks and additions per administrator", async () => {
    const { rateLimit } = await import("../src/server/rate-limit");
    for (let i = 0; i < 20; i++) await rateLimit("people-import:00000000-0000-4000-8000-000000000001", 1000, 60 * 60_000);
    expect(await importPeopleAction("name,email\nX,x@acme.test", false)).toMatchObject({ ok: false, error: "rateLimited" });
    for (let i = 0; i < 60; i++) await rateLimit("people-add:00000000-0000-4000-8000-000000000001", 1000, 60 * 60_000);
    expect(await addPersonAction(undefined, add({ email: "x@acme.test" }))).toEqual({ error: "rateLimited" });
  });
});
