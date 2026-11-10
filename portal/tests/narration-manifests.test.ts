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
      .map((f) => ({ key: `${mod}/${f.slice(0, -`.${locale}.json`.length)}`, file: path.join(LESSONS, mod, f) }))
      .map((l) => ({ ...l, manifest: path.join(process.cwd(), ...NARRATION_DIR, locale, manifestName(l.key)) })),
  );

  it.each(lessons)("$key has a manifest whose clips have one forward-moving timing per karaoke word", ({ key, file, manifest: manifestFile }) => {
    expect(fs.existsSync(manifestFile), `no manifest: npm run narration -- --lang ${locale} --only ${key}`).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as NarrationClips;
    // Text edited after the run has no clip yet and is read by Web Speech: reported, not failed, so lesson edits need no rerun.
    const lesson = JSON.parse(fs.readFileSync(file, "utf8")) as LessonFile;
    const stale = spokenTexts(lesson.scenes, ui).filter((t) => !Object.hasOwn(manifest, t));
    if (stale.length) console.warn(`${locale} ${key}: ${stale.length} texts without a clip (rerun the generator)`);
    for (const [text, clip] of Object.entries(manifest)) {
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
