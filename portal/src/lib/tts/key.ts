import { createHash } from "node:crypto";

/**
 * ElevenLabs text-to-speech model of the clips: the one that reads all ten library languages,
 * Azerbaijani and Georgian included (eleven_v4 is only offered through the dialogue API).
 */
export const TTS_MODEL = "eleven_v3";

/**
 * Part of every clip name. Clips are served as immutable, so a clip remade with the same text, voice and
 * model (a bad take, a mispronunciation) needs a new name: raise this and rerun the generator.
 */
export const TTS_REVISION = 1;

/**
 * File name of a clip (`text` is speechText). The same language, model, voice, text and revision always
 * give the same key, so a clip is generated once; changing any of them makes a new clip.
 */
export function clipKey(locale: string, model: string, voice: string, text: string, revision = TTS_REVISION): string {
  return createHash("sha256").update(JSON.stringify([locale, model, voice, text, revision])).digest("hex");
}
