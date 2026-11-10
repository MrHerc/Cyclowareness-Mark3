/**
 * ElevenLabs (paid): POST text-to-speech/{voice}/with-timestamps, with per-character timings.
 * Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_<LOCALE> or ELEVENLABS_VOICE_ID (letters and digits).
 */
import { z } from "zod";
import { wordTimings } from "../../src/lib/tts/clips";
import { TTS_MODEL } from "../../src/lib/tts/key";
import { Fatal, envVoice, fetchRetry, type Provider } from "./provider";

const API = "https://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "mp3_44100_128";

const alignmentSchema = z
  .object({ characters: z.array(z.string()), character_start_times_seconds: z.array(z.number()), character_end_times_seconds: z.array(z.number()) })
  .refine((a) => a.characters.length === a.character_start_times_seconds.length && a.characters.length === a.character_end_times_seconds.length);
const responseSchema = z.object({ audio_base64: z.string().min(1), alignment: alignmentSchema.nullish() });

export function elevenLabs(): Provider {
  return {
    model: TTS_MODEL,
    // Rough API price of eleven_v3; the plan decides the real one.
    usdPer1kChars: 0.08,
    maxChars: 5000,
    voice: (locale) => envVoice("ELEVENLABS_VOICE", locale, process.env.ELEVENLABS_VOICE_ID),
    async synthesize(locale, voice, key, text) {
      const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
      if (!apiKey) throw new Fatal("ELEVENLABS_API_KEY is not set (use --dry-run for the estimate only).");
      // The voice id goes into the request path.
      if (!/^[A-Za-z0-9]{8,64}$/.test(voice)) throw new Fatal(`The ${locale} voice id is not an ElevenLabs voice id (letters and digits only).`);
      const res = await fetchRetry(`${API}/${encodeURIComponent(voice)}/with-timestamps?output_format=${OUTPUT_FORMAT}`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        // The seed makes a regenerated clip sound the same (best effort on the provider's side).
        body: JSON.stringify({ text, model_id: TTS_MODEL, language_code: locale, seed: parseInt(key.slice(0, 8), 16) }),
      });
      const parsed = responseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("unexpected response shape");
      const alignment = parsed.data.alignment;
      if (!alignment) throw new Error("the response has no character timings");
      return {
        audio: Buffer.from(parsed.data.audio_base64, "base64"),
        durationMs: Math.round(Math.max(0, ...alignment.character_end_times_seconds) * 1000),
        words: wordTimings(text, alignment),
      };
    },
  };
}
