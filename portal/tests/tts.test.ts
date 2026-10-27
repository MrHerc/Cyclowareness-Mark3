import { describe, expect, it } from "vitest";
import type { Scene } from "@/lib/content/types";
import { clipUrl, isClipUrl, manifestName, wordAt, wordTimings, type CharacterAlignment } from "@/lib/tts/clips";
import { TTS_MODEL, TTS_REVISION, clipKey } from "@/lib/tts/key";
import { spokenTexts } from "@/lib/tts/spoken";
import { speechText, wordsOf } from "@/lib/tts/text";

/** Character timings as the provider sends them: one entry per code point, 50 ms each. */
function align(text: string, skip: ReadonlySet<number> = new Set()): CharacterAlignment {
  const characters = [...text].filter((_, i) => !skip.has(i));
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * 0.05),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.05),
  };
}

describe("speech text", () => {
  it("drops stage directions and splits words on whitespace in every script", () => {
    expect(speechText("Wait <short pause> — then  look.")).toBe("Wait — then look.");
    expect(wordsOf("Diqqət: <breath> link saxtadır!")).toEqual(["Diqqət:", "link", "saxtadır!"]);
    expect(wordsOf("لا تضغط على الرابط.")).toEqual(["لا", "تضغط", "على", "الرابط."]);
    expect(wordsOf("Bonjour !")).toEqual(["Bonjour", "!"]);
  });
});

describe("word timings", () => {
  it("gives one entry per karaoke word with the times of its first and last character", () => {
    const words = wordTimings("Hello, world.", align("Hello, world."));
    expect(words).toEqual([
      { w: "Hello,", startMs: 0, endMs: 300 },
      { w: "world.", startMs: 350, endMs: 650 },
    ]);
  });

  it("matches the player's words for Cyrillic, Georgian and Arabic with its marks", () => {
    for (const text of ["Не открывайте вложение!", "არ დააჭიროთ ბმულს.", "لَا تَفْتَحِ المُرْفَقَ، أبداً."]) {
      const words = wordTimings(text, align(text));
      expect(words.map((w) => w.w)).toEqual(wordsOf(text));
      expect(words.every((w, i) => w.endMs >= w.startMs && (i === 0 || w.startMs > words[i - 1].startMs))).toBe(true);
    }
  });

  it("uses the text the player speaks: stage directions are not words", () => {
    const words = wordTimings("Stop <breath> now", align("Stop now"));
    expect(words.map((w) => w.w)).toEqual(["Stop", "now"]);
    expect(words[1].startMs).toBe(250);
  });

  it("survives characters the provider dropped or added without shifting later words", () => {
    // "—" missing from the alignment.
    const dropped = wordTimings("Wait — look", align("Wait — look", new Set([5])));
    expect(dropped.map((w) => w.w)).toEqual(["Wait", "—", "look"]);
    expect(dropped[2].startMs).toBeGreaterThan(dropped[0].startMs);
    expect(dropped[1].startMs).toBe(dropped[0].endMs);
    // An extra character that is not in the text is ignored.
    const extra = align("ab cd");
    extra.characters.splice(2, 0, "#");
    extra.character_start_times_seconds.splice(2, 0, 0.1);
    extra.character_end_times_seconds.splice(2, 0, 0.12);
    expect(wordTimings("ab cd", extra).map((w) => w.w)).toEqual(["ab", "cd"]);
  });

  it("treats a provider space as the text's no-break space", () => {
    const words = wordTimings("Bonjour !", align("Bonjour !"));
    expect(words).toEqual([
      { w: "Bonjour", startMs: 0, endMs: 350 },
      { w: "!", startMs: 400, endMs: 450 },
    ]);
  });

  it("finds the word being spoken at a playback position", () => {
    const words = [
      { w: "a", startMs: 0, endMs: 100 },
      { w: "b", startMs: 200, endMs: 300 },
      { w: "c", startMs: 400, endMs: 500 },
    ];
    expect([0, 150, 200, 399, 450, 9999].map((ms) => wordAt(words, ms))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(wordAt([], 100)).toBe(0);
  });
});

describe("clip keys and paths", () => {
  it("is a stable hash of language, model, voice, text and revision", () => {
    const key = clipKey("az", TTS_MODEL, "voice1234", "Salam.");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(clipKey("az", TTS_MODEL, "voice1234", "Salam.")).toBe(key);
    expect(new Set([clipKey("ru", TTS_MODEL, "voice1234", "Salam."), clipKey("az", "other", "voice1234", "Salam."), clipKey("az", TTS_MODEL, "voice5678", "Salam."), clipKey("az", TTS_MODEL, "voice1234", "Salam!")]).has(key)).toBe(false);
    // A new revision renames every clip, so browsers holding the immutable old file fetch the new take.
    expect(clipKey("az", TTS_MODEL, "voice1234", "Salam.", TTS_REVISION + 1)).not.toBe(key);
  });

  it("accepts only generated clip URLs of the language", () => {
    const url = clipUrl("az", "a".repeat(64));
    expect(url).toBe(`/generated/tts/az/${"a".repeat(64)}.mp3`);
    expect(isClipUrl(url, "az")).toBe(true);
    expect(isClipUrl(url, "ru")).toBe(false);
    for (const bad of ["https://evil.example/x.mp3", "/generated/tts/az/../../x.mp3", `/generated/tts/az/${"a".repeat(63)}.mp3`, `javascript:${"a".repeat(64)}`]) expect(isClipUrl(bad, "az")).toBe(false);
    expect(manifestName("phishing/spot-the-phish")).toBe("phishing__spot-the-phish.json");
  });
});

describe("spoken texts", () => {
  const scenes: Scene[] = [
    { type: "intro", id: "i", title: "Spot the phish", body: "Look <breath> closely." },
    { type: "tutor", id: "t", beats: [{ id: "b", say: "Hello!", mood: "talk", checkpoint: { prompt: "Ready?", options: [{ id: "y", label: "Yes", correct: true, feedback: "Great." }] } }] },
    {
      type: "choice",
      id: "c",
      explain: "Check the sender.",
      question: {
        prompt: "Which are red flags?",
        options: [
          { id: "a", label: "A", correct: true, feedback: "A is a flag." },
          { id: "b", label: "B", correct: true, feedback: "B is a flag." },
          { id: "c", label: "C", correct: false, feedback: "C is fine." },
        ],
      },
    },
    { type: "hotspot", id: "h", prompt: "Find them.", artifact: { kind: "url", url: "x" }, spots: [{ id: "s", label: "S", explain: "Odd domain." }], minToFind: 1 },
    { type: "recap", id: "r", points: ["One", "Two"] },
  ];
  const texts = spokenTexts(scenes, { multiHint: "Choose all that apply", hotspotDone: "You found enough." });

  it("lists the composed strings exactly as the scenes speak them", () => {
    expect(texts).toContain("Spot the phish. Look closely.");
    expect(texts).toContain("Hello!");
    expect(texts).toContain("Ready?");
    expect(texts).toContain("Great.");
    expect(texts).toContain("Which are red flags?");
    expect(texts).toContain("Which are red flags? Choose all that apply.");
    expect(texts).toContain("Odd domain.");
    expect(texts).toContain("You found enough.");
    expect(texts).toContain("One. Two");
  });

  it("lists every feedback a choose-all pick can produce, and the time-up one", () => {
    expect(texts).toContain("Check the sender.");
    // Right: both flags; wrong picks: the missed then the extra options.
    expect(texts).toContain("A is a flag. B is a flag. Check the sender.");
    expect(texts).toContain("B is a flag. Check the sender.");
    expect(texts).toContain("B is a flag. C is fine. Check the sender.");
    expect(texts).toContain("A is a flag. B is a flag. C is fine. Check the sender.");
  });

  it("has no repeats and no empty strings", () => {
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.every((t) => t === speechText(t) && t.length > 0)).toBe(true);
  });
});
