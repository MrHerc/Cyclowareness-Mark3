/**
 * In-memory PostgreSQL (PGlite) for integration tests, migrated with the real migrations in
 * drizzle/, plus small factories for the rows most flows need. Each test file gets its own
 * database: call `testDb()` at module level and `await ready()` in `beforeAll`.
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as t from "../../src/server/db/schema";
import type { DB } from "../../src/server/db/client";
import type { Role } from "../../src/server/db/schema";
import { defaultSettings } from "../../src/lib/tenant-defaults";

/** Starting the embedded database and applying the migrations takes a few seconds (longer on Windows). */
export const DB_SETUP_TIMEOUT = 180_000;

export function testDb() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema: t }) as unknown as DB;
  const ready = () => migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "..", "drizzle") });
  return { pglite, db, ready };
}

let seq = 0;
const next = () => ++seq;

export async function addTenant(db: DB, o: Partial<typeof t.tenants.$inferInsert> = {}) {
  const n = next();
  const [row] = await db
    .insert(t.tenants)
    .values({ slug: `org${n}`, name: `Org ${n}`, branding: { primary: "#4f46e5", accent: "#ff7a1a" }, settings: defaultSettings("en"), ...o })
    .returning();
  return row;
}

export async function addDepartment(db: DB, tenantId: string, name: string, parentId: string | null = null) {
  const [row] = await db.insert(t.departments).values({ tenantId, name, nameKey: `${name.toLowerCase()}-${next()}`, parentId }).returning();
  return row;
}

export async function addUser(db: DB, tenantId: string, o: Partial<typeof t.users.$inferInsert> & { role?: Role } = {}) {
  const n = next();
  const [row] = await db
    .insert(t.users)
    .values({ tenantId, email: `person${n}@test.example`, name: `Person ${n}`, locale: "en", ...o })
    .returning();
  return row;
}

/** A module with `lessons` lessons at positions `firstPosition`, `firstPosition + 1`, … */
export async function addModule(db: DB, o: Partial<typeof t.modules.$inferInsert> & { lessons?: number; firstPosition?: number } = {}) {
  const { lessons = 3, firstPosition = 0, ...values } = o;
  const n = next();
  const [mod] = await db
    .insert(t.modules)
    .values({ slug: `module-${n}`, category: "email", audiences: ["everyone"], title: { en: `Module ${n}`, az: `Modul ${n}` }, subtitle: { en: "" }, minutes: 10, xp: 100, difficulty: "Easy", ...values })
    .returning();
  const rows = lessons
    ? await db
        .insert(t.lessons)
        .values(Array.from({ length: lessons }, (_, i) => ({ moduleId: mod.id, key: `lesson-${i + 1}`, title: { en: `Lesson ${i + 1}` }, minutes: 3, position: firstPosition + i })))
        .returning()
    : [];
  return { ...mod, lessons: rows.sort((a, b) => a.position - b.position) };
}

export async function assignEveryone(db: DB, tenantId: string, moduleId: string, o: Partial<typeof t.assignments.$inferInsert> = {}) {
  const [row] = await db.insert(t.assignments).values({ tenantId, moduleId, scope: "everyone", dueKind: "none", ...o }).returning();
  return row;
}
