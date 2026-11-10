/**
 * Training library: imports the shipped content (content/library) into the database.
 * Idempotent: run on every deploy (`npm run content:sync`) and by the seed.
 * Each lesson is `<id>.en.json` plus an optional `<id>.<locale>.json` translation per other interface
 * language, stored as one lesson_contents row per locale; tenant (studio) lessons are never touched.
 */
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { log } from "../log";
import type { z } from "zod";
import { lessonFileSchema, lessonIntegrityErrors } from "../../lib/content/validate";
import { localeParityErrors } from "../../lib/content/locale-parity";
import { parityEnglish } from "../../lib/content/market-files";
import type { ModuleFile } from "../../lib/content/types";
import { CATEGORY_FROM_LABEL } from "../../lib/domain/catalog";
import { LOCALES, type Locale } from "../../i18n/config";
import { isLabId } from "../../lib/domain/labs";

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

/** Languages a library lesson may be translated into: `<id>.<locale>.json` next to `<id>.en.json`. */
export const LESSON_TRANSLATIONS = LOCALES.filter((l): l is TranslationLocale => l !== "en");
type TranslationLocale = Exclude<Locale, "en">;

/**
 * Module and lesson titles in one translation (content/library/i18n.<locale>.json). While a file is
 * missing the titles stay English, with a warning naming it (tests/content.test.ts requires every file).
 */
function readTitles(locale: TranslationLocale): I18n {
  const file = path.join(LIB, `i18n.${locale}.json`);
  const name = path.relative(process.cwd(), file);
  if (!fs.existsSync(file)) {
    log.warn(`[library] ${name} is missing: ${locale} module and lesson titles fall back to English.`);
    return { modules: {}, lessons: {} };
  }
  try {
    return readJson<I18n>(file);
  } catch (e) {
    throw new Error(`${name}: ${(e as Error).message}`);
  }
}

export function readLibrary() {
  const modules = readJson<ModuleFile[]>(path.join(LIB, "modules.json"));
  const titles = Object.fromEntries(LESSON_TRANSLATIONS.map((l) => [l, readTitles(l)])) as Record<TranslationLocale, I18n>;
  return { modules, titles };
}

type CheckedLesson = z.infer<typeof lessonFileSchema>;

/**
 * Schema and integrity rules for every file; a translation must also keep its English original's
 * structure (`english`, through its market's address map for a language with a market pack).
 */
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
    if (fs.existsSync(file(locale))) translations[locale] = checkedLesson(read(locale, label), label, parityEnglish(english, locale, key));
  }
  return { en, translations };
}

/** Whether any of `values` differs from the stored row (jsonb comes back with its keys in another order). */
const changed = (row: Record<string, unknown>, values: Record<string, unknown>) => Object.entries(values).some(([k, v]) => !isDeepStrictEqual(row[k], v));

/**
 * `written` counts the rows inserted, updated or deleted: an unchanged library writes none, so a start
 * with the same content costs reads only.
 */
export async function syncLibrary(db: DB): Promise<{ modules: number; lessons: number; locales: Record<Locale, number>; written: number }> {
  const { modules, titles } = readLibrary();
  let lessonCount = 0;
  let written = 0;
  const locales = Object.fromEntries(LOCALES.map((l) => [l, 0])) as Record<Locale, number>;
  /** `{ en, <translation>: text }`, English where a translation has none. */
  const localized = (en: string, text: (x: I18n) => string | undefined) => ({ en, ...Object.fromEntries(LESSON_TRANSLATIONS.map((l) => [l, text(titles[l]) ?? en])) });
  for (const [order, m] of modules.entries()) {
    const category = CATEGORY_FROM_LABEL[m.category];
    if (!category) throw new Error(`Unknown category ${m.category} in ${m.slug}`);
    const title = localized(m.title, (x) => x.modules[m.slug]?.[0]);
    const subtitle = localized(m.subtitle, (x) => x.modules[m.slug]?.[1]);
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
    const [existing] = await db.select().from(t.modules).where(and(eq(t.modules.slug, m.slug), isNull(t.modules.tenantId)));
    let moduleId: string;
    if (existing) {
      moduleId = existing.id;
      if (changed(existing, values)) {
        await db.update(t.modules).set(values).where(eq(t.modules.id, moduleId));
        written++;
      }
    } else {
      [{ id: moduleId }] = await db.insert(t.modules).values(values).returning({ id: t.modules.id });
      written++;
    }

    for (const [position, les] of m.lessons.entries()) {
      const { en, translations } = readLibraryLesson(m.slug, les.id);
      const key = `${m.slug}/${les.id}`;
      const lessonTitle = localized(les.title, (x) => x.lessons[key]);
      const [row] = await db
        .select()
        .from(t.lessons)
        .where(and(eq(t.lessons.moduleId, moduleId), eq(t.lessons.key, les.id)));
      let lessonId: string;
      const lessonValues = { title: lessonTitle, minutes: les.minutes, position };
      if (row) {
        lessonId = row.id;
        if (changed(row, lessonValues)) {
          await db.update(t.lessons).set(lessonValues).where(eq(t.lessons.id, lessonId));
          written++;
        }
      } else {
        [{ id: lessonId }] = await db
          .insert(t.lessons)
          .values({ moduleId, key: les.id, ...lessonValues })
          .returning({ id: t.lessons.id });
        written++;
      }
      const texts: Partial<Record<Locale, CheckedLesson>> = { en, ...translations };
      for (const locale of LOCALES) {
        const lesson = texts[locale];
        if (!lesson) {
          // The files are the source: a translation that was removed stops being served.
          const gone = await db
            .delete(t.lessonContents)
            .where(and(eq(t.lessonContents.lessonId, lessonId), eq(t.lessonContents.locale, locale)))
            .returning({ locale: t.lessonContents.locale });
          written += gone.length;
          continue;
        }
        const saved = await db
          .insert(t.lessonContents)
          .values({ lessonId, locale, scenes: lesson.scenes })
          .onConflictDoUpdate({
            target: [t.lessonContents.lessonId, t.lessonContents.locale],
            set: { scenes: lesson.scenes, updatedAt: new Date() },
            // Unchanged text keeps its row (and updatedAt) untouched.
            setWhere: sql`${t.lessonContents.scenes} is distinct from excluded.scenes`,
          })
          .returning({ locale: t.lessonContents.locale });
        written += saved.length;
        locales[locale]++;
      }
      lessonCount++;
    }
  }
  return { modules: modules.length, lessons: lessonCount, locales, written };
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
  /** Practice labs, shown after the modules. */
  labs?: string[];
};

/** Global learning paths (content/library/paths.json). */
export async function syncPaths(db: DB): Promise<number> {
  const paths = readJson<PathFile[]>(path.join(LIB, "paths.json"));
  const slugs = new Set(readLibrary().modules.map((m) => m.slug));
  for (const p of paths) {
    const missing = p.modules.filter((s) => !slugs.has(s));
    if (missing.length) throw new Error(`Path ${p.key} references unknown modules: ${missing.join(", ")}`);
    const badLabs = (p.labs ?? []).filter((id) => !isLabId(id));
    if (badLabs.length) throw new Error(`Path ${p.key} references unknown labs: ${badLabs.join(", ")}`);
    const values = {
      key: p.key,
      title: p.title,
      description: p.description,
      audience: p.audience,
      mandatory: p.mandatory,
      recurrence: p.recurrence,
      standards: p.standards,
      moduleSlugs: p.modules,
      labIds: p.labs ?? [],
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
