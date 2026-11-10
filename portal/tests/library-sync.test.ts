import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as t from "../src/server/db/schema";
import { syncLibrary } from "../src/server/services/library";
import { DB_SETUP_TIMEOUT, testDb } from "./helpers/db";

/** The import runs on every start: with unchanged content it must not rewrite the library's rows. */
const { db, ready } = testDb();
const IMPORT_TIMEOUT = 300_000;

beforeAll(ready, DB_SETUP_TIMEOUT);

describe("library import", () => {
  it(
    "writes every row once, then only the rows whose content changed",
    async () => {
      const first = await syncLibrary(db);
      const texts = Object.values(first.locales).reduce((a, n) => a + n, 0);
      expect(first.written).toBe(first.modules + first.lessons + texts);

      const lastUpdate = () => db.select({ at: sql<string>`max(${t.lessonContents.updatedAt})::text` }).from(t.lessonContents);
      const before = await lastUpdate();
      expect((await syncLibrary(db)).written).toBe(0);
      expect(await lastUpdate()).toEqual(before);

      // A changed text, lesson title and module title are written back from the files, and nothing else.
      const [lesson] = await db.select().from(t.lessons).limit(1);
      await db.update(t.lessonContents).set({ scenes: [] }).where(and(eq(t.lessonContents.lessonId, lesson.id), eq(t.lessonContents.locale, "az")));
      await db.update(t.lessons).set({ title: { en: "Edited" } }).where(eq(t.lessons.id, lesson.id));
      await db.update(t.modules).set({ title: sql`${t.modules.title} || '{"en":"Edited"}'::jsonb` }).where(eq(t.modules.id, lesson.moduleId));
      expect((await syncLibrary(db)).written).toBe(3);
      expect((await syncLibrary(db)).written).toBe(0);
    },
    IMPORT_TIMEOUT,
  );
});
