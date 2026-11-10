import { describe, expect, it, vi } from "vitest";
import { SILENT_CLIP, armAudioUnlock, clipFor, nextClipUrl, volumeIsFixed } from "@/components/player/narrator";
import type { NarrationClips } from "@/lib/tts/clips";

const clip = (c: string) => ({ url: `/generated/tts/en/${c.repeat(64)}.mp3`, durationMs: 1000, words: [] });
const clips: NarrationClips = { "Hello.": clip("a"), "Check the sender.": clip("b"), "Well done.": clip("c") };

describe("clip or speech engine", () => {
  it("plays the lesson's clip for a text it has in the clips' language", () => {
    expect(clipFor(clips, "Hello.", "en", "en")).toBe(clips["Hello."]);
    expect(clipFor(clips, "Hello.", "en-US", "en")).toBe(clips["Hello."]);
  });

  it("leaves to Web Speech a text without a clip, another language, or a lesson without clips", () => {
    expect(clipFor(clips, "A changed sentence.", "en", "en")).toBeUndefined();
    expect(clipFor(clips, "Hello.", "az", "en")).toBeUndefined();
    expect(clipFor(null, "Hello.", "en", "en")).toBeUndefined();
    expect(clipFor(clips, "constructor", "en", "en")).toBeUndefined();
  });

  it("fetches ahead the clip of the next line in reading order", () => {
    expect(nextClipUrl(clips, "Hello.")).toBe(clips["Check the sender."].url);
    expect(nextClipUrl(clips, "Well done.")).toBeUndefined();
    expect(nextClipUrl(clips, "Not in the lesson.")).toBeUndefined();
  });
});

/** An audio element as far as the unlock uses it; play() resolves unless told otherwise. */
function fakeAudio(play: () => Promise<void> = () => Promise.resolve()) {
  return { src: "", play: vi.fn(play), pause: vi.fn() };
}

describe("audio unlock on the first gesture (iOS)", () => {
  it("plays silence on the clips' element inside the first gesture, pauses it, then disarms", async () => {
    const target = new EventTarget();
    const el = fakeAudio();
    armAudioUnlock(target, () => el as unknown as HTMLAudioElement);
    target.dispatchEvent(new Event("pointerup"));
    // Synchronously, inside the gesture.
    expect(el.src).toBe(SILENT_CLIP);
    expect(el.play).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(el.pause).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event("keydown"));
    expect(el.play).toHaveBeenCalledTimes(1);
  });

  it("leaves a clip that replaced the silence playing, and ignores a refused play()", async () => {
    const target = new EventTarget();
    const el = fakeAudio();
    armAudioUnlock(target, () => el as unknown as HTMLAudioElement);
    target.dispatchEvent(new Event("touchend"));
    el.src = "/generated/tts/en/clip.mp3";
    await Promise.resolve();
    expect(el.pause).not.toHaveBeenCalled();

    const refused = fakeAudio(() => Promise.reject(new DOMException("no", "NotAllowedError")));
    const other = new EventTarget();
    armAudioUnlock(other, () => refused as unknown as HTMLAudioElement);
    other.dispatchEvent(new Event("mousedown"));
    await Promise.resolve();
    expect(refused.pause).not.toHaveBeenCalled();
  });

  it("does nothing to an element that is already playing a clip, and disarms on unmount", () => {
    const target = new EventTarget();
    const element = vi.fn(() => null);
    armAudioUnlock(target, element);
    target.dispatchEvent(new Event("pointerup"));
    target.dispatchEvent(new Event("pointerup"));
    expect(element).toHaveBeenCalledTimes(1);

    const later = new EventTarget();
    const el = fakeAudio();
    armAudioUnlock(later, () => el as unknown as HTMLAudioElement)();
    later.dispatchEvent(new Event("keydown"));
    expect(el.play).not.toHaveBeenCalled();
  });
});

describe("volume slider", () => {
  it("is hidden where the element's volume is read-only (iOS reads 1 whatever is set)", () => {
    const ios = Object.defineProperty({} as { volume: number }, "volume", { get: () => 1, set: () => {} });
    expect(volumeIsFixed(ios)).toBe(true);
    expect(volumeIsFixed({ volume: 1 })).toBe(false);
  });
});
