import fs from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import type { LessonFile } from "@/lib/content/types";
import { NARRATION_DIR, isClipUrl, manifestName, type NarrationClips } from "@/lib/tts/clips";
import { spokenTexts } from "@/lib/tts/spoken";
import { wordsOf } from "@/lib/tts/text";

const LESSONS = path.join(process.cwd(), "content", "library", "lessons");
/** The languages whose clips are generated and whose manifests are committed (scripts/generate-narration.ts). */
const NARRATED = ["en"];

describe.each(NARRATED)("committed %s narration manifests", (locale) => {
  const player = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", locale, "player.json"), "utf8"));
  const format = (msg: string) => String(new IntlMessageFormat(msg, locale).format());
  const ui = { multiHint: format(player.multiHint), hotspotDone: format(player.hotspot.done) };
  const lessons = fs.readdirSync(LESSONS).flatMap((mod) =>
    fs
      .readdirSync(path.join(LESSONS, mod))
      .filter((f) => f.endsWith(`.${locale}.json`))
      .map((f) => ({ key: `${mod}/${f.slice(0, -`.${locale}.json`.length)}`, file: path.join(LESSONS, mod, f) })),
  );

  it.each(lessons)("$key has a clip for every spoken text, with one forward-moving timing per karaoke word", ({ key, file }) => {
    const lesson = JSON.parse(fs.readFileSync(file, "utf8")) as LessonFile;
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), ...NARRATION_DIR, locale, manifestName(key)), "utf8")) as NarrationClips;
    const texts = spokenTexts(lesson.scenes, ui);
    expect(Object.keys(manifest)).toEqual(texts);
    for (const text of texts) {
      const clip = manifest[text];
      expect(isClipUrl(clip.url, locale)).toBe(true);
      expect(clip.words.map((w) => w.w)).toEqual(wordsOf(text));
      clip.words.forEach((w, i) => {
        expect(w.endMs).toBeGreaterThanOrEqual(w.startMs);
        expect(w.endMs).toBeLessThanOrEqual(clip.durationMs);
        if (i) expect(w.startMs).toBeGreaterThanOrEqual(clip.words[i - 1].startMs);
      });
    }
  });
});
