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
import type { Scene } from "../../src/lib/content/types";
import { defaultSettings } from "../../src/lib/tenant-defaults";

/** Starting the embedded database and applying the migrations takes a few seconds (longer on Windows). */
export const DB_SETUP_TIMEOUT = 180_000;

export function testDb() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema: t }) as unknown as DB;
  const ready = () => migrate(drizzle(pglite), { migrationsFolder: path.join(__dirname, "..", "..", "drizzle") });
  return { pglite, db, ready };
}

/**
 * rate-limit.ts for a test whose server database is a stub: rateLimit() counts in an in-memory PGlite of its own
 * through rateLimitIn. `vi.mock("../src/server/rate-limit", async (original) => (await import("./helpers/db")).rateLimitOnPglite(await original()))`.
 */
export async function rateLimitOnPglite<M extends typeof import("../../src/server/rate-limit")>(original: M): Promise<M> {
  const { db, ready } = testDb();
  await ready();
  return { ...original, rateLimit: (key: string, limit: number, windowMs: number) => original.rateLimitIn(db, key, limit, windowMs) };
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

/** The English text of every test lesson: a question "q1" (option "a" is right) and a one-step simulation "sim" ("report" is safe). */
export const TEST_SCENES: Scene[] = [
  { type: "intro", id: "start", title: "Start", body: "Welcome." },
  { type: "choice", id: "q1", question: { prompt: "Which one?", options: [{ id: "a", label: "A", correct: true, feedback: "Yes." }, { id: "b", label: "B", correct: false, feedback: "No." }] } },
  {
    type: "simulation",
    id: "sim",
    environment: "inbox",
    title: "Inbox",
    intro: "Handle the email.",
    steps: [{ id: "link", artifact: { kind: "email" }, actions: [{ id: "open", label: "Open", kind: "click-link", outcome: "risky", feedback: "Risky." }, { id: "report", label: "Report", kind: "report", outcome: "safe", feedback: "Safe." }] }],
  },
  { type: "recap", id: "recap", points: ["Done."] },
];

/** A module with `lessons` lessons at positions `firstPosition`, `firstPosition + 1`, …, each with TEST_SCENES as its English text. */
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
  if (rows.length) await db.insert(t.lessonContents).values(rows.map((l) => ({ lessonId: l.id, locale: "en", scenes: TEST_SCENES })));
  return { ...mod, lessons: rows.sort((a, b) => a.position - b.position) };
}

export async function assignEveryone(db: DB, tenantId: string, moduleId: string, o: Partial<typeof t.assignments.$inferInsert> = {}) {
  const [row] = await db.insert(t.assignments).values({ tenantId, moduleId, scope: "everyone", dueKind: "none", ...o }).returning();
  return row;
}
