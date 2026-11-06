"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { LessonPlayer } from "@/components/player/player";
import { Toaster } from "@/components/ui/toast";
import type { Brand, Scene } from "@/lib/content/types";
import type { ScormSession } from "./scorm-api";

/** What a SCORM package carries (its lessons.js, written by src/server/scorm/package.ts). */
export type ScormData = {
  /** The interface language of the package. */
  locale: string;
  module: { slug: string; title: string; topic: string };
  /** Every lesson of the module in order, in the package's language or English where it has none. */
  lessons: { id: string; key: string; title: string; minutes: number; contentLocale: string; scenes: Scene[] }[];
  brands: Record<string, Brand>;
  /** The message namespaces the player reads (common, player, learner), in `locale`. */
  messages: Record<string, unknown>;
};

const noCaptions = async () => null;

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * No <AzNumbersGate>: nothing is rendered on a server to hydrate, and the player's numbers (minutes, steps)
 * stay below a thousand, where az and ka print like the browser's fallback; its polyfill would add 1.4 MB.
 */
export function ScormProviders({ data, children }: { data: ScormData; children?: ReactNode }) {
  return (
    <NextIntlClientProvider locale={data.locale} messages={data.messages as AbstractIntlMessages}>
      {children}
      <Toaster />
    </NextIntlClientProvider>
  );
}

/**
 * The module in an LMS: the app's own lesson player without a server. The lesson shown follows the hash the
 * player's links set (see next-shim.tsx), else the first one not finished yet; each finish goes to the session.
 */
export function ScormApp({ data, session }: { data: ScormData; session: ScormSession }) {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const [done, setDone] = useState(session.done);
  const wanted = /^#\/learn\/[^/]+\/([^/?#]+)$/.exec(hash)?.[1];
  const linked = data.lessons.findIndex((l) => l.key === wanted);
  const index = Math.max(0, linked >= 0 ? linked : data.lessons.findIndex((l) => !done.has(l.key)));
  const lesson = data.lessons[index];
  const next = data.lessons[index + 1] ?? null;
  return (
    <ScormProviders data={data}>
      <LessonPlayer
        // Any navigation (next lesson, leave, back to the module) opens the lesson anew.
        key={`${hash}|${lesson.key}`}
        viewerId="scorm"
        slug={data.module.slug}
        moduleTitle={data.module.title}
        topic={data.module.topic}
        lesson={{ id: lesson.id, key: lesson.key, title: lesson.title, minutes: lesson.minutes, scenes: lesson.scenes }}
        syllabus={data.lessons.map((l) => ({ key: l.key, title: l.title, minutes: l.minutes, completed: done.has(l.key) }))}
        contentLocale={lesson.contentLocale}
        captionLocales={[]}
        moreLanguages={[]}
        loadCaptions={noCaptions}
        clips={null}
        completedBefore={done.has(lesson.key)}
        next={next ? { key: next.key, title: next.title } : null}
        brands={data.brands}
        timeLimitSeconds={null}
        soundOn
        motion="full"
        tutorEnabled={false}
        tutorVoice={false}
        attestationText=""
        onComplete={(answers) => {
          const res = session.complete(lesson.key, answers);
          if (res.ok) setDone(session.done());
          return { ok: res.ok, xp: 0, moduleStatus: res.moduleDone ? "completed" : "in_progress", nextKey: next?.key ?? null };
        }}
      />
    </ScormProviders>
  );
}
