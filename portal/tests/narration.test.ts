import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { loadNarrationClips, readNarrationManifest } from "@/server/narration";
import { NARRATION_DIR, clipUrl, manifestName } from "@/lib/tts/clips";
import { readLibrary } from "@/server/services/library";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "narration-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const key = (c: string) => c.repeat(64);
const clip = (k: string, locale = "az") => ({ url: clipUrl(locale, k), durationMs: 900, words: [{ w: "Salam.", startMs: 0, endMs: 900 }] });

function setup(name: string, manifest: unknown, audio: string[]) {
  const pub = path.join(tmp, name, "public");
  fs.mkdirSync(path.join(pub, "generated", "tts", "az"), { recursive: true });
  for (const k of audio) fs.writeFileSync(path.join(pub, "generated", "tts", "az", `${k}.mp3`), "");
  const file = path.join(tmp, name, "lesson.json");
  fs.writeFileSync(file, typeof manifest === "string" ? manifest : JSON.stringify(manifest));
  return { file, pub };
}

describe("readNarrationManifest", () => {
  it("returns the clips whose audio exists, keyed by the spoken text", () => {
    const { file, pub } = setup("ok", { "Salam.": clip(key("a")), "Sağ olun.": clip(key("b")) }, [key("a")]);
    expect(readNarrationManifest(file, "az", pub)).toEqual({ "Salam.": clip(key("a")) });
  });

  it("is null without a manifest, with no audio, or for an invalid one", () => {
    expect(readNarrationManifest(path.join(tmp, "absent.json"), "az", tmp)).toBeNull();
    const none = setup("none", { "Salam.": clip(key("a")) }, []);
    expect(readNarrationManifest(none.file, "az", none.pub)).toBeNull();
    const broken = setup("broken", "{not json", []);
    expect(readNarrationManifest(broken.file, "az", broken.pub)).toBeNull();
  });

  it("refuses a manifest pointing outside the language's clip folder", () => {
    for (const url of ["/generated/tts/ru/" + key("a") + ".mp3", "https://cdn.example/" + key("a") + ".mp3", "/../../etc/passwd"]) {
      const bad = setup(`bad-${url.length}`, { "Salam.": { ...clip(key("a")), url } }, [key("a")]);
      expect(readNarrationManifest(bad.file, "az", bad.pub)).toBeNull();
    }
  });
});

describe("loadNarrationClips", () => {
  const m = readLibrary().modules[0];
  const lessonKey = `${m.slug}/${m.lessons[0].id}`;

  it("is null for a key outside the library or a language outside LOCALES (no path reaches the disk)", () => {
    for (const bad of ["../../../etc/passwd", `${m.slug}/../../secrets`, `${m.slug}`, `${lessonKey}/x`, "", "a/b"]) expect(loadNarrationClips(bad, "az")).toBeNull();
    for (const locale of ["xx", "../az", "", "AZ"]) expect(loadNarrationClips(lessonKey, locale)).toBeNull();
  });

  it("reads a library lesson's manifest from the app folder and keeps the clips whose audio is there", () => {
    const app = path.join(tmp, "app");
    const dir = path.join(app, ...NARRATION_DIR, "az");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, manifestName(lessonKey)), JSON.stringify({ "Salam.": clip(key("c")), "Sağ olun.": clip(key("d")) }));
    fs.mkdirSync(path.join(app, "public", "generated", "tts", "az"), { recursive: true });
    fs.writeFileSync(path.join(app, "public", clipUrl("az", key("c"))), "");
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(app);
    try {
      expect(loadNarrationClips(lessonKey, "az")).toEqual({ "Salam.": clip(key("c")) });
      // Another language of the same lesson has no manifest.
      expect(loadNarrationClips(lessonKey, "ru")).toBeNull();
    } finally {
      cwd.mockRestore();
    }
  });
});
