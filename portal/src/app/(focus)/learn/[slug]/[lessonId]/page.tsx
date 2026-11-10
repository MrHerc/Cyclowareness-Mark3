import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { privileged, requireViewer } from "@/server/auth/viewer";
import { getCatalog } from "@/server/queries/catalog";
import { loadNarrationClips } from "@/server/narration";
import { LessonPlayer } from "@/components/player/player";
import type { Scene } from "@/lib/content/types";
import { brandsFor } from "@/server/brands";
import { pickLessonContent } from "@/lib/content/lesson-locale";
import { CATEGORY_TOPIC } from "@/lib/domain/catalog";
import { DEFAULT_ATTESTATION } from "@/lib/tenant-defaults";
import { LOCALES, pick } from "@/i18n/config";
import { subtitleLanguageOptions } from "@/lib/content/subtitle-languages";
import { loadCaptionsAction } from "./actions";

export async function generateMetadata({ params }: PageProps<"/learn/[slug]/[lessonId]">) {
  const { slug, lessonId } = await params;
  const v = await requireViewer();
  const m = (await getCatalog(v, await getLocale(), privileged(v, "studio.write"))).find((x) => x.slug === slug);
  return { title: m?.lessons.find((l) => l.key === lessonId)?.title ?? m?.title ?? "" };
}

export default async function LessonPage({ params }: PageProps<"/learn/[slug]/[lessonId]">) {
  const { slug, lessonId } = await params;
  const v = await requireViewer();
  const locale = await getLocale();
  const m = (await getCatalog(v, locale, privileged(v, "studio.write"))).find((x) => x.slug === slug);
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
  // Studio modules have no generated clips, even one that reuses a library slug.
  const clips = m.origin === "library" ? loadNarrationClips(`${m.slug}/${lesson.key}`, fallback.locale) : null;

  return (
    <LessonPlayer
      viewerId={v.user.id}
      slug={m.slug}
      moduleTitle={m.title}
      topic={CATEGORY_TOPIC[m.category]}
      lesson={{ id: lesson.id, key: lesson.key, title: lesson.title, minutes: lesson.minutes, scenes }}
      syllabus={m.lessons.map((l) => ({ key: l.key, title: l.title, minutes: l.minutes, completed: l.completed }))}
      contentLocale={fallback.locale}
      captionLocales={LOCALES.filter((l) => l !== fallback.locale && contents.some((c) => c.locale === l))}
      // Named on the server, where every language has its display names (Chromium lacks Azerbaijani's).
      moreLanguages={v.tenant.features.has("ai_tutor") ? subtitleLanguageOptions(locale) : []}
      loadCaptions={loadCaptionsAction}
      clips={clips}
      completedBefore={lesson.completed}
      next={next ? { key: next.key, title: next.title } : null}
      brands={brandsFor(scenes, fallback.locale)}
      timeLimitSeconds={timeLimitSeconds}
      soundOn={v.user.soundOn}
      motion={v.user.motion}
      tutorEnabled={v.tenant.features.has("ai_tutor")}
      tutorVoice={v.tenant.features.has("tutor_voice")}
      attestationText={settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale)}
    />
  );
}
