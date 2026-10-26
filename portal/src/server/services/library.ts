/**
 * Training library: imports the shipped content (content/library) into the database.
 * Idempotent: run on every deploy (`npm run content:sync`) and by the seed.
 * Each lesson is `<id>.en.json` plus optional `<id>.az.json` / `<id>.ru.json` translations, stored as
 * one lesson_contents row per locale; tenant (studio) lessons are never touched.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import type { z } from "zod";
import { lessonFileSchema, lessonIntegrityErrors } from "../../lib/content/validate";
import { localeParityErrors } from "../../lib/content/locale-parity";
import type { ModuleFile } from "../../lib/content/types";
import { CATEGORY_FROM_LABEL } from "../../lib/domain/catalog";

const LIB = path.join(process.cwd(), "content", "library");

/**
 * PostgreSQL advisory lock taken around an import (server start-up, `npm run content:sync`), so two
 * imports never run at the same time. The UNIQUE NULLS NOT DISTINCT constraint on (slug, tenant_id)
 * would refuse the second copy of a new global module, but that error would fail the whole import;
 * with the lock, two concurrent first imports run one after the other and both succeed.
 */
export const CONTENT_SYNC_LOCK_KEY = 7_281_940;

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

/** Languages a library lesson may be translated into: `<id>.az.json` / `<id>.ru.json` next to `<id>.en.json`. */
export const LESSON_TRANSLATIONS = ["az", "ru"] as const;
type TranslationLocale = (typeof LESSON_TRANSLATIONS)[number];
type CheckedLesson = z.infer<typeof lessonFileSchema>;

/** Schema and integrity rules for every file; a translation must also keep its English original's structure. */
function checkedLesson(raw: unknown, label: string, english?: unknown): CheckedLesson {
  const parsed = lessonFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${label}: ${parsed.error.message}`);
  const integrity = lessonIntegrityErrors(parsed.data);
  if (integrity.length) throw new Error(`${label}: ${integrity.join("; ")}`);
  if (english !== undefined) {
    const parity = localeParityErrors(english, raw);
    if (parity.length) throw new Error(`${label}: ${parity.slice(0, 10).join("; ")}${parity.length > 10 ? ` (and ${parity.length - 10} more)` : ""}`);
  }
  return parsed.data;
}

/**
 * Reads a library lesson in English and in each translation that exists. A file that fails the checks
 * aborts with "<module>/<lesson>: …" (English) or "<module>/<lesson>.<locale>: …" (a translation).
 */
export function readLibraryLesson(slug: string, id: string): { en: CheckedLesson; translations: Partial<Record<TranslationLocale, CheckedLesson>> } {
  const key = `${slug}/${id}`;
  const file = (locale: string) => path.join(LIB, "lessons", slug, `${id}.${locale}.json`);
  const read = (locale: string, label: string): unknown => {
    try {
      return readJson(file(locale));
    } catch (e) {
      throw new Error(`${label}: ${(e as Error).message}`);
    }
  };
  const english = read("en", key);
  const en = checkedLesson(english, key);
  const translations: Partial<Record<TranslationLocale, CheckedLesson>> = {};
  for (const locale of LESSON_TRANSLATIONS) {
    const label = `${key}.${locale}`;
    if (fs.existsSync(file(locale))) translations[locale] = checkedLesson(read(locale, label), label, english);
  }
  return { en, translations };
}

export async function syncLibrary(db: DB): Promise<{ modules: number; lessons: number; locales: Record<"en" | TranslationLocale, number> }> {
  const { modules, az, ru } = readLibrary();
  let lessonCount = 0;
  const locales = { en: 0, az: 0, ru: 0 };
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
      const { en, translations } = readLibraryLesson(m.slug, les.id);
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
      const texts: Partial<Record<"en" | TranslationLocale, CheckedLesson>> = { en, ...translations };
      for (const locale of ["en", ...LESSON_TRANSLATIONS] as const) {
        const lesson = texts[locale];
        if (!lesson) {
          // The files are the source: a translation that was removed stops being served.
          await db.delete(t.lessonContents).where(and(eq(t.lessonContents.lessonId, lessonId), eq(t.lessonContents.locale, locale)));
          continue;
        }
        await db
          .insert(t.lessonContents)
          .values({ lessonId, locale, scenes: lesson.scenes })
          .onConflictDoUpdate({ target: [t.lessonContents.lessonId, t.lessonContents.locale], set: { scenes: lesson.scenes, updatedAt: new Date() } });
        locales[locale]++;
      }
      lessonCount++;
    }
  }
  return { modules: modules.length, lessons: lessonCount, locales };
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
