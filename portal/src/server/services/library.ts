/**
 * Training library: imports the shipped content (content/library) into the database.
 * Idempotent: run on every deploy (`npm run content:sync`) and by the seed.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { lessonFileSchema, lessonIntegrityErrors } from "../../lib/content/validate";
import type { ModuleFile } from "../../lib/content/types";
import { CATEGORY_FROM_LABEL } from "../../lib/domain/catalog";

const LIB = path.join(process.cwd(), "content", "library");

type I18n = { modules: Record<string, [string, string]>; lessons: Record<string, string> };

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function readLibrary() {
  const modules = readJson<ModuleFile[]>(path.join(LIB, "modules.json"));
  const az = readJson<I18n>(path.join(LIB, "i18n.az.json"));
  const ru = readJson<I18n>(path.join(LIB, "i18n.ru.json"));
  return { modules, az, ru };
}

export async function syncLibrary(db: DB): Promise<{ modules: number; lessons: number }> {
  const { modules, az, ru } = readLibrary();
  let lessonCount = 0;
  for (const [order, m] of modules.entries()) {
    const category = CATEGORY_FROM_LABEL[m.category];
    if (!category) throw new Error(`Unknown category ${m.category} in ${m.slug}`);
    const title = { en: m.title, az: az.modules[m.slug]?.[0] ?? m.title, ru: ru.modules[m.slug]?.[0] ?? m.title };
    const subtitle = { en: m.subtitle, az: az.modules[m.slug]?.[1] ?? m.subtitle, ru: ru.modules[m.slug]?.[1] ?? m.subtitle };
    const values = {
      slug: m.slug,
      category,
      audiences: m.audience,
      title,
      subtitle,
      minutes: m.minutes,
      xp: m.xp,
      difficulty: m.difficulty,
      origin: "library" as const,
      status: "published" as const,
      sortOrder: order,
    };
    const [existing] = await db.select({ id: t.modules.id }).from(t.modules).where(and(eq(t.modules.slug, m.slug), isNull(t.modules.tenantId)));
    let moduleId: string;
    if (existing) {
      moduleId = existing.id;
      await db.update(t.modules).set(values).where(eq(t.modules.id, moduleId));
    } else {
      [{ id: moduleId }] = await db.insert(t.modules).values(values).returning({ id: t.modules.id });
    }

    for (const [position, les] of m.lessons.entries()) {
      const file = path.join(LIB, "lessons", m.slug, `${les.id}.en.json`);
      const parsed = lessonFileSchema.safeParse(readJson(file));
      if (!parsed.success) throw new Error(`${m.slug}/${les.id}: ${parsed.error.message}`);
      const integrity = lessonIntegrityErrors(parsed.data);
      if (integrity.length) throw new Error(`${m.slug}/${les.id}: ${integrity.join("; ")}`);
      const key = `${m.slug}/${les.id}`;
      const lessonTitle = { en: les.title, az: az.lessons[key] ?? les.title, ru: ru.lessons[key] ?? les.title };
      const [row] = await db
        .select({ id: t.lessons.id })
        .from(t.lessons)
        .where(and(eq(t.lessons.moduleId, moduleId), eq(t.lessons.key, les.id)));
      let lessonId: string;
      if (row) {
        lessonId = row.id;
        await db.update(t.lessons).set({ title: lessonTitle, minutes: les.minutes, position }).where(eq(t.lessons.id, lessonId));
      } else {
        [{ id: lessonId }] = await db
          .insert(t.lessons)
          .values({ moduleId, key: les.id, title: lessonTitle, minutes: les.minutes, position })
          .returning({ id: t.lessons.id });
      }
      await db
        .insert(t.lessonContents)
        .values({ lessonId, locale: "en", scenes: parsed.data.scenes })
        .onConflictDoUpdate({ target: [t.lessonContents.lessonId, t.lessonContents.locale], set: { scenes: parsed.data.scenes, updatedAt: new Date() } });
      lessonCount++;
    }
  }
  return { modules: modules.length, lessons: lessonCount };
}

type PathFile = {
  key: string;
  mandatory: boolean;
  title: Record<string, string>;
  description: Record<string, string>;
  audience: Record<string, string>;
  recurrence: Record<string, string>;
  standards: string[];
  modules: string[];
};

/** Global learning paths (content/library/paths.json). */
export async function syncPaths(db: DB): Promise<number> {
  const paths = readJson<PathFile[]>(path.join(LIB, "paths.json"));
  const slugs = new Set(readLibrary().modules.map((m) => m.slug));
  for (const p of paths) {
    const missing = p.modules.filter((s) => !slugs.has(s));
    if (missing.length) throw new Error(`Path ${p.key} references unknown modules: ${missing.join(", ")}`);
    const values = {
      key: p.key,
      title: p.title,
      description: p.description,
      audience: p.audience,
      mandatory: p.mandatory,
      recurrence: p.recurrence,
      standards: p.standards,
      moduleSlugs: p.modules,
    };
    const [existing] = await db
      .select({ id: t.learningPaths.id })
      .from(t.learningPaths)
      .where(and(eq(t.learningPaths.key, p.key), isNull(t.learningPaths.tenantId)));
    if (existing) await db.update(t.learningPaths).set(values).where(eq(t.learningPaths.id, existing.id));
    else await db.insert(t.learningPaths).values(values);
  }
  return paths.length;
}
