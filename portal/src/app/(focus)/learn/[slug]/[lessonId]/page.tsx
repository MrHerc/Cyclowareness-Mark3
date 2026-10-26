import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { allowed, requireViewer } from "@/server/auth/viewer";
import { getCatalog } from "@/server/queries/catalog";
import { LessonPlayer } from "@/components/player/player";
import type { Brand, Scene } from "@/lib/content/types";
import { pickLessonContent } from "@/lib/content/lesson-locale";
import { CATEGORY_TOPIC } from "@/lib/domain/catalog";
import { DEFAULT_ATTESTATION } from "@/lib/tenant-defaults";
import { pick } from "@/i18n/config";

let brandCache: Record<string, Brand> | null = null;
function allBrands(): Record<string, Brand> {
  brandCache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "library", "brands.json"), "utf8")) as Record<string, Brand>;
  return brandCache;
}

/** Only the brands a lesson references are sent to the browser. */
function brandsFor(scenes: unknown): Record<string, Brand> {
  const refs = new Set<string>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    if (typeof o.brandRef === "string") refs.add(o.brandRef);
    Object.values(o).forEach(walk);
  };
  walk(scenes);
  const all = allBrands();
  return Object.fromEntries([...refs].filter((r) => all[r]).map((r) => [r, all[r]]));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]/[lessonId]">) {
  const { slug, lessonId } = await params;
  const v = await requireViewer();
  const m = (await getCatalog(v, await getLocale(), allowed(v, "studio.write"))).find((x) => x.slug === slug);
  return { title: m?.lessons.find((l) => l.key === lessonId)?.title ?? m?.title ?? "" };
}

export default async function LessonPage({ params }: PageProps<"/learn/[slug]/[lessonId]">) {
  const { slug, lessonId } = await params;
  const v = await requireViewer();
  const locale = await getLocale();
  const m = (await getCatalog(v, locale, allowed(v, "studio.write"))).find((x) => x.slug === slug);
  const lesson = m?.lessons.find((l) => l.key === lessonId);
  if (!m || !lesson) notFound();
  // The viewer's language, then English, then whatever the lesson was written in (own studio lessons).
  // contentLocale below tells the narrator which language the chosen text is in.
  const contents = await db().select({ scenes: t.lessonContents.scenes, locale: t.lessonContents.locale }).from(t.lessonContents).where(eq(t.lessonContents.lessonId, lesson.id));
  const fallback = pickLessonContent(contents, locale);
  if (!fallback) notFound();
  const scenes = fallback.scenes as Scene[];
  const idx = m.lessons.findIndex((l) => l.key === lessonId);
  const next = m.lessons[idx + 1] ?? null;
  const settings = v.tenant.settings;
  const timed = settings.learning.timeLimits && m.difficulty !== "Easy" && v.user.timerPref !== "off";
  const timeLimitSeconds = timed ? (v.user.timerPref === "more" ? 60 : 30) : null;

  return (
    <LessonPlayer
      viewerId={v.user.id}
      slug={m.slug}
      moduleTitle={m.title}
      topic={CATEGORY_TOPIC[m.category]}
      lesson={{ key: lesson.key, title: lesson.title, minutes: lesson.minutes, scenes }}
      contentLocale={fallback.locale}
      completedBefore={lesson.completed}
      next={next ? { key: next.key, title: next.title } : null}
      brands={brandsFor(scenes)}
      timeLimitSeconds={timeLimitSeconds}
      soundOn={v.user.soundOn}
      motion={v.user.motion}
      tutorEnabled={v.tenant.features.has("ai_tutor")}
      tutorVoice={v.tenant.features.has("tutor_voice")}
      attestationText={settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale)}
    />
  );
}
