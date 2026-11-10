import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import type { DB } from "../db/client";
import * as t from "../db/schema";
import { brandsFor } from "../brands";
import { pickLessonContent } from "../../lib/content/lesson-locale";
import type { Scene } from "../../lib/content/types";
import { CATEGORY_TOPIC, type Category } from "../../lib/domain/catalog";
import { dirOf, pick, type Locale } from "../../i18n/config";
import { loadMessages } from "../../i18n/messages";
import { MASTERY_SCORE, hasScoredScene } from "../../scorm/scorm-api";
import type { ScormData } from "../../scorm/app";

/**
 * A module as a SCORM 1.2 package: one SCO (launcher.html) that runs the app's lesson player offline
 * (src/scorm, built by scripts/build-scorm-player.ts) over every lesson of the module in one language.
 */

/** The module's package data in `locale` (a lesson without that text falls back to English), or null when the tenant cannot reach it: neither the library's nor its own. */
export async function scormData(db: DB, tenantId: string, moduleId: string, locale: Locale): Promise<ScormData | null> {
  const [mod] = await db
    .select()
    .from(t.modules)
    .where(and(eq(t.modules.id, moduleId), or(isNull(t.modules.tenantId), eq(t.modules.tenantId, tenantId))));
  if (!mod) return null;
  const lessons = await db.select().from(t.lessons).where(eq(t.lessons.moduleId, mod.id)).orderBy(asc(t.lessons.position));
  const contents = lessons.length
    ? await db.select({ lessonId: t.lessonContents.lessonId, locale: t.lessonContents.locale, scenes: t.lessonContents.scenes }).from(t.lessonContents).where(inArray(t.lessonContents.lessonId, lessons.map((l) => l.id)))
    : [];
  const out = lessons.flatMap((l) => {
    const c = pickLessonContent(
      contents.filter((x) => x.lessonId === l.id),
      locale,
    );
    return c ? [{ id: l.id, key: l.key, title: pick(l.title, locale), minutes: l.minutes, contentLocale: c.locale, scenes: c.scenes as Scene[] }] : [];
  });
  const { common, player, learner } = await loadMessages(locale);
  return {
    locale,
    module: { slug: mod.slug, title: pick(mod.title, locale), topic: CATEGORY_TOPIC[mod.category as Category] },
    lessons: out,
    brands: brandsFor(out.map((l) => l.scenes), locale),
    // Only what the player reads: the rest of the learner app's strings would weigh as much as the lessons.
    messages: { common, player, learner: { profile: learner.profile, attest: learner.attest, problem: learner.problem } },
  };
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** imsmanifest.xml: one organization with one SCO item for the module; `files` are the SCO's resource files. */
export function manifestXml(data: ScormData, files: readonly string[]): string {
  // Identifiers are xs:ID values: a slug's characters fit, anything else becomes "_".
  const id = `cyclowareness-${data.module.slug}`.replace(/[^A-Za-z0-9_.-]/g, "_");
  const title = xml(data.module.title);
  const mastery = data.lessons.some((l) => hasScoredScene(l.scenes)) ? `\n        <adlcp:masteryscore>${MASTERY_SCORE}</adlcp:masteryscore>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${id}-org">
    <organization identifier="${id}-org">
      <title>${title}</title>
      <item identifier="${id}-item" identifierref="${id}-sco" isvisible="true">
        <title>${title}</title>${mastery}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${id}-sco" type="webcontent" adlcp:scormtype="sco" href="launcher.html">
${files.map((f) => `      <file href="${xml(f)}"/>`).join("\n")}
    </resource>
  </resources>
</manifest>
`;
}

function launcherHtml(data: ScormData): string {
  return `<!doctype html>
<html lang="${xml(data.locale)}" dir="${dirOf(data.locale)}" data-motion="full">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${xml(data.module.title)}</title>
<link rel="stylesheet" href="player.css">
</head>
<body>
<div id="root"></div>
<script src="lessons.js"></script>
<script src="player.js"></script>
</body>
</html>
`;
}

/** Every file of the package, imsmanifest.xml first. Relative paths only, so it also runs from file://. */
export function scormFiles(data: ScormData, player: { js: Buffer; css: Buffer }): { name: string; data: Buffer }[] {
  const b = (s: string) => Buffer.from(s, "utf8");
  const sco = [
    { name: "launcher.html", data: b(launcherHtml(data)) },
    // A script, not JSON to fetch: browsers refuse fetches from file:// pages.
    { name: "lessons.js", data: b(`window.CYCLOWARENESS_SCORM = ${JSON.stringify(data)};\n`) },
    { name: "player.js", data: player.js },
    { name: "player.css", data: player.css },
  ];
  return [{ name: "imsmanifest.xml", data: b(manifestXml(data, sco.map((f) => f.name))) }, ...sco];
}
