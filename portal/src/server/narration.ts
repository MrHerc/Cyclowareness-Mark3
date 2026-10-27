import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { NARRATION_DIR, isClipUrl, manifestName, type NarrationClips } from "@/lib/tts/clips";
import { readLibrary } from "./services/library";

/**
 * Pre-generated narration of library lessons (scripts/generate-narration.ts). The manifests stay on the
 * server and the lesson page hands one lesson's clips to the player, so lesson text never becomes a
 * public file; only the clips themselves are static files.
 */

const manifestSchema = (locale: string) =>
  z.record(
    z.string().min(1),
    z.object({
      url: z.string().refine((url) => isClipUrl(url, locale)),
      durationMs: z.number().int().nonnegative(),
      words: z.array(z.object({ w: z.string(), startMs: z.number().nonnegative(), endMs: z.number().nonnegative() })),
    }),
  );

/**
 * A manifest's clips whose audio file exists under `publicDir`, or null (no manifest, an invalid one, or
 * no audio). A missing clip is simply left to the browser's speech engine.
 */
export function readNarrationManifest(file: string, locale: string, publicDir: string): NarrationClips | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.warn(`[narration] ${path.basename(file)} is unreadable; the browser voice reads this lesson`);
    return null;
  }
  const parsed = manifestSchema(locale).safeParse(raw);
  if (!parsed.success) {
    console.warn(`[narration] ${path.basename(file)} is not a valid manifest; the browser voice reads this lesson`);
    return null;
  }
  const clips = Object.fromEntries(Object.entries(parsed.data).filter(([, clip]) => fs.existsSync(path.join(publicDir, clip.url))));
  return Object.keys(clips).length ? clips : null;
}

const production = process.env.NODE_ENV === "production";
let lessonKeys: Set<string> | null = null;
const manifests = new Map<string, NarrationClips | null>();

function libraryLessonKeys(): Set<string> {
  const keys = lessonKeys ?? new Set(readLibrary().modules.flatMap((m) => m.lessons.map((l) => `${m.slug}/${l.id}`)));
  if (production) lessonKeys = keys;
  return keys;
}

/**
 * The clips of a library lesson ("<module slug>/<lesson key>") in one language, keyed by speechText, or
 * null when it has none (studio lessons never do). Only lesson keys of the shipped library and interface
 * languages reach the file system. Production reads each manifest once (the files are part of the
 * image); development rereads them, so newly generated clips play without a restart.
 */
export function loadNarrationClips(lessonKey: string, locale: string): NarrationClips | null {
  if (!isLocale(locale) || !libraryLessonKeys().has(lessonKey)) return null;
  const file = path.join(process.cwd(), ...NARRATION_DIR, locale, manifestName(lessonKey));
  if (manifests.has(file)) return manifests.get(file) ?? null;
  const clips = readNarrationManifest(file, locale, path.join(process.cwd(), "public"));
  if (production) manifests.set(file, clips);
  return clips;
}
