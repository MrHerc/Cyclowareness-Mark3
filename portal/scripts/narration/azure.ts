/**
 * Azure AI Speech, batch synthesis REST API (api-version 2024-04-01): one job per clip with SSML, a 24 kHz
 * WAV and the word boundaries ([nnnn].word.json: Text, AudioOffset and Duration in ms). Batch synthesis
 * needs a Standard (S0) Speech resource; the free F0 tier has no batch API.
 * Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. westeurope) in .env.local; AZURE_VOICE_<LOCALE>
 * overrides the default voice of a language.
 */
import { z } from "zod";
import { wordTimings, type CharacterAlignment } from "../../src/lib/tts/clips";
import { unzip } from "../../src/server/zip";
import { Fatal, envVoice, fetchRetry, type Provider } from "./provider";

const API_VERSION = "2024-04-01";
/** Neural voices of the ten library languages (az and ru are the ones in scope; the owner chooses after a sample). */
const DEFAULT_VOICE: Record<string, string> = {
  az: "az-AZ-BanuNeural",
  en: "en-US-AvaNeural",
  ru: "ru-RU-SvetlanaNeural",
  tr: "tr-TR-EmelNeural",
  ro: "ro-RO-AlinaNeural",
  ka: "ka-GE-EkaNeural",
  uk: "uk-UA-PolinaNeural",
  de: "de-DE-KatjaNeural",
  fr: "fr-FR-DeniseNeural",
  ar: "ar-SA-ZariyahNeural",
};
/** A job longer than this has stalled. */
const JOB_TIMEOUT_MS = 15 * 60_000;

const jobSchema = z.object({ status: z.string(), outputs: z.object({ result: z.string() }).partial().optional(), properties: z.object({ error: z.object({ message: z.string() }).partial() }).partial().optional() });
const boundariesSchema = z.array(z.object({ Text: z.string(), AudioOffset: z.number(), Duration: z.number(), BoundaryType: z.string().optional() }));
type Boundary = z.infer<typeof boundariesSchema>[number];

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => `&${{ "<": "lt", ">": "gt", "&": "amp", '"': "quot", "'": "apos" }[c]};`);

export function ssml(voice: string, text: string): string {
  const lang = voice.split("-").slice(0, 2).join("-");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
}

/** Word boundaries as per-character timings (each character of a word gets the word's times) for wordTimings(). */
export function boundaryAlignment(boundaries: readonly Boundary[]): CharacterAlignment {
  const a: CharacterAlignment = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
  const push = (c: string, start: number, end: number) => {
    a.characters.push(c);
    a.character_start_times_seconds.push(start / 1000);
    a.character_end_times_seconds.push(end / 1000);
  };
  let last = 0;
  for (const b of boundaries) {
    if (b.BoundaryType === "SentenceBoundary") continue;
    if (a.characters.length && b.BoundaryType !== "PunctuationBoundary") push(" ", last, b.AudioOffset);
    for (const c of b.Text) push(c, b.AudioOffset, b.AudioOffset + b.Duration);
    last = b.AudioOffset + b.Duration;
  }
  return a;
}

/** Length of a PCM WAV from its fmt byte rate and data size. */
export function wavDurationMs(wav: Buffer): number {
  let byteRate = 0;
  for (let p = 12; p + 8 <= wav.length; ) {
    const id = wav.toString("ascii", p, p + 4);
    const size = wav.readUInt32LE(p + 4);
    if (id === "fmt ") byteRate = wav.readUInt32LE(p + 16);
    if (id === "data" && byteRate) return Math.round((Math.min(size, wav.length - p - 8) / byteRate) * 1000);
    p += 8 + size + (size % 2);
  }
  throw new Error("the WAV has no audio data");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `endpoint` and `pollMs` are for the tests' fake server. */
export function azure({ endpoint, pollMs = 2000 }: { endpoint?: string; pollMs?: number } = {}): Provider {
  return {
    model: "azure",
    // Standard (S0) neural price, 2026-11-05.
    usdPer1kChars: 0.015,
    maxChars: 5000,
    voice: (locale) => envVoice("AZURE_VOICE", locale, DEFAULT_VOICE[locale]),
    async synthesize(locale, voice, key, text) {
      const apiKey = process.env.AZURE_SPEECH_KEY?.trim();
      const region = process.env.AZURE_SPEECH_REGION?.trim();
      if (!apiKey || !region) throw new Fatal("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set (use --dry-run for the estimate only).");
      if (!/^[a-z0-9]+$/.test(region)) throw new Fatal("AZURE_SPEECH_REGION must be a region name such as westeurope.");
      // The voice goes into the SSML.
      if (!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/.test(voice)) throw new Fatal(`The ${locale} voice ${voice} is not an Azure neural voice name (xx-XX-NameNeural).`);
      const job = `${endpoint ?? `https://${region}.api.cognitive.microsoft.com`}/texttospeech/batchsyntheses/cw-${key.slice(0, 24)}-${Date.now().toString(36)}?api-version=${API_VERSION}`;
      const headers = { "Ocp-Apim-Subscription-Key": apiKey };
      await fetchRetry(job, {
        method: "PUT",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          inputKind: "SSML",
          inputs: [{ content: ssml(voice, text) }],
          properties: { outputFormat: "riff-24khz-16bit-mono-pcm", wordBoundaryEnabled: true, concatenateResult: false, timeToLiveInHours: 24 },
        }),
      });
      try {
        for (const started = Date.now(); ; await sleep(pollMs)) {
          const state = jobSchema.parse(await (await fetchRetry(job, { headers })).json());
          if (state.status === "Failed") throw new Error(`Azure synthesis failed: ${state.properties?.error?.message ?? "no reason given"}`);
          if (state.status === "Succeeded") {
            if (!state.outputs?.result) throw new Error("the finished job has no result");
            // The result is a storage URL with its own token: the Speech key is not sent there.
            const files = unzip(Buffer.from(await (await fetchRetry(state.outputs.result, {})).arrayBuffer()));
            const name = [...files.keys()].find((n) => n.endsWith(".wav"));
            const words = [...files.keys()].find((n) => n.endsWith(".word.json"));
            if (!name || !words) throw new Error("the result has no audio or no word boundaries");
            const audio = files.get(name) as Buffer;
            const boundaries = boundariesSchema.parse(JSON.parse((files.get(words) as Buffer).toString("utf8")));
            return { audio, durationMs: wavDurationMs(audio), words: wordTimings(text, boundaryAlignment(boundaries)) };
          }
          if (Date.now() - started > JOB_TIMEOUT_MS) throw new Error(`the job is still ${state.status} after ${JOB_TIMEOUT_MS / 60_000} minutes`);
        }
      } finally {
        // Jobs expire on their own after a day; deleting them keeps the resource's job list short.
        await fetch(job, { method: "DELETE", headers }).catch(() => {});
      }
    },
  };
}
