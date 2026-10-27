/**
 * Generates the lessons' natural narration: one ElevenLabs clip per spoken string and language, with
 * word timings for the karaoke highlight (lesson-engine.md §1.6). Clips already on disk are reused, so a
 * rerun only pays for new or changed text.
 *   npx tsx --env-file=.env.local scripts/generate-narration.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/generate-narration.ts --locales az,ru --only <module>[/<lesson>] --concurrency 4
 * Needs ELEVENLABS_API_KEY and a voice per language: ELEVENLABS_VOICE_<LOCALE> (ELEVENLABS_VOICE_AZ…) or
 * ELEVENLABS_VOICE_ID for all. --dry-run prints the character count and cost estimate only (no key needed).
 * Writes public/generated/tts/<locale>/<key>.mp3 and content/narration/<locale>/<module>__<lesson>.json
 * (read by src/server/narration.ts). Without a clip the player keeps the browser's voice.
 */
import fs from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { z } from "zod";
import { LOCALES, isLocale } from "../src/i18n/config";
import type { LessonFile } from "../src/lib/content/types";
import { NARRATION_DIR, clipUrl, manifestName, wordTimings, type NarrationClip, type NarrationClips } from "../src/lib/tts/clips";
import { TTS_MODEL, clipKey } from "../src/lib/tts/key";
import { spokenTexts, type SpokenUi } from "../src/lib/tts/spoken";

const LESSONS = path.join(process.cwd(), "content", "library", "lessons");
const PUBLIC = path.join(process.cwd(), "public");
const MANIFESTS = path.join(process.cwd(), ...NARRATION_DIR);
const API = "https://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "mp3_44100_128";
/** Rough API price of eleven_v3; the plan decides the real one. */
const USD_PER_1K_CHARS = 0.08;
/** eleven_v3's longest request. */
const MAX_CHARS = 5000;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 6;

class Fatal extends Error {}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const out: { locales: string[]; only?: string; dryRun: boolean; concurrency: number } = { locales: [...LOCALES], dryRun: false, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : fail(`${a} needs a value`));
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--locales") out.locales = value().split(",").map((l) => l.trim()).filter(Boolean);
    else if (a === "--only") out.only = value().replace(/\/+$/, "");
    else if (a === "--concurrency") out.concurrency = Number(value());
    else fail(`Unknown argument ${a}. Options: --locales az,ru --only <module>[/<lesson>] --dry-run --concurrency 4`);
  }
  const bad = out.locales.filter((l) => !isLocale(l));
  if (bad.length || !out.locales.length) fail(`Unknown locale ${bad.join(", ") || "(none)"}; choose from ${LOCALES.join(", ")}`);
  if (!Number.isInteger(out.concurrency) || out.concurrency < 1 || out.concurrency > 16) fail("--concurrency must be 1 to 16");
  return out;
}

type Lesson = { key: string; texts: string[] };

/** The library lessons in one language, with every string the player speaks in them. */
function lessonsIn(locale: string, only: string | undefined, ui: SpokenUi): Lesson[] {
  const out: Lesson[] = [];
  for (const mod of fs.readdirSync(LESSONS).sort()) {
    const dir = path.join(LESSONS, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      const id = file.endsWith(`.${locale}.json`) ? file.slice(0, -`.${locale}.json`.length) : null;
      if (!id) continue;
      const key = `${mod}/${id}`;
      if (only && key !== only && mod !== only) continue;
      const lesson = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as LessonFile;
      out.push({ key, texts: spokenTexts(lesson.scenes, ui) });
    }
  }
  return out;
}

/** The interface strings scenes read aloud, as next-intl formats them; absent until the locale has messages. */
function spokenUi(locale: string): SpokenUi {
  const file = path.join(process.cwd(), "messages", locale, "player.json");
  if (!fs.existsSync(file)) return {};
  const player = JSON.parse(fs.readFileSync(file, "utf8")) as { multiHint?: string; hotspot?: { done?: string } };
  const format = (msg?: string) => (msg ? String(new IntlMessageFormat(msg, locale).format()) : undefined);
  return { multiHint: format(player.multiHint), hotspotDone: format(player.hotspot?.done) };
}

/** Clips of earlier runs by URL: their word timings live only in the manifests. */
function knownClips(locale: string): Map<string, NarrationClip> {
  const dir = path.join(MANIFESTS, locale);
  const known = new Map<string, NarrationClip>();
  if (!fs.existsSync(dir)) return known;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      for (const clip of Object.values(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as NarrationClips)) known.set(clip.url, clip);
    } catch {
      console.warn(`skipping unreadable manifest ${locale}/${file}`);
    }
  }
  return known;
}

/** Writes through a temporary file, so an interrupted run never leaves a half-written clip that a rerun would reuse. */
function writeAtomic(file: string, data: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.part`, data);
  fs.renameSync(`${file}.part`, file);
}

const alignmentSchema = z
  .object({ characters: z.array(z.string()), character_start_times_seconds: z.array(z.number()), character_end_times_seconds: z.array(z.number()) })
  .refine((a) => a.characters.length === a.character_start_times_seconds.length && a.characters.length === a.character_end_times_seconds.length);
const responseSchema = z.object({ audio_base64: z.string().min(1), alignment: alignmentSchema.nullish() });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt: number) => Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);

/** One request with retries on rate limits, server errors, timeouts and network failures. The key is sent, never printed. */
async function synthesize(apiKey: string, voice: string, locale: string, key: string, text: string) {
  const url = `${API}/${encodeURIComponent(voice)}/with-timestamps?output_format=${OUTPUT_FORMAT}`;
  // The seed makes a regenerated clip sound the same (best effort on the provider's side).
  const body = JSON.stringify({ text, model_id: TTS_MODEL, language_code: locale, seed: parseInt(key.slice(0, 8), 16) });
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "application/json" }, body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`no answer after ${attempt} attempts (${(e as Error).name})`);
      await sleep(backoff(attempt));
      continue;
    }
    if (res.ok) {
      const parsed = responseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("unexpected response shape");
      if (!parsed.data.alignment) throw new Error("the response has no character timings");
      return { audio: Buffer.from(parsed.data.audio_base64, "base64"), alignment: parsed.data.alignment };
    }
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    // A wrong key, a used-up quota or a voice the account cannot use stops the whole run.
    if (res.status === 401 || res.status === 403) throw new Fatal(`HTTP ${res.status}: ${detail}`);
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(after > 0 ? Math.min(after, 60) * 1000 : backoff(attempt));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
}

async function pool<T>(items: readonly T[], size: number, run: (item: T) => Promise<void>, stopped: () => boolean) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length && !stopped()) await run(items[next++]);
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceOf = (locale: string) => (process.env[`ELEVENLABS_VOICE_${locale.toUpperCase()}`] || process.env.ELEVENLABS_VOICE_ID || "").trim();
  for (const locale of args.locales) {
    const voice = voiceOf(locale);
    // The voice id goes into the request path.
    if (voice && !/^[A-Za-z0-9]{8,64}$/.test(voice)) fail(`The ${locale} voice id is not an ElevenLabs voice id (letters and digits only).`);
  }

  type Plan = { locale: string; voice: string; lessons: Lesson[]; ready: Map<string, NarrationClip>; clips: number; chars: number; newClips: number; newChars: number };
  const plans: Plan[] = args.locales.map((locale) => {
    const voice = voiceOf(locale);
    const lessons = lessonsIn(locale, args.only, spokenUi(locale));
    // Clips of earlier runs whose audio is still on disk (with no voice set, none can match).
    const ready = new Map([...knownClips(locale)].filter(([url]) => voice && fs.existsSync(path.join(PUBLIC, url))));
    const plan = { locale, voice, lessons, ready, clips: 0, chars: 0, newClips: 0, newChars: 0 };
    const seen = new Set<string>();
    for (const text of lessons.flatMap((l) => l.texts)) {
      const key = clipKey(locale, TTS_MODEL, voice, text);
      if (seen.has(key)) continue;
      seen.add(key);
      plan.clips++;
      plan.chars += text.length;
      if (!ready.has(clipUrl(locale, key))) {
        plan.newClips++;
        plan.newChars += text.length;
      }
    }
    return plan;
  });
  if (args.only && plans.every((p) => !p.lessons.length)) fail(`No library lesson matches --only ${args.only}`);

  const usd = (chars: number) => `${((chars / 1000) * USD_PER_1K_CHARS).toFixed(2)} USD`;
  console.log(`Model ${TTS_MODEL}, ${OUTPUT_FORMAT}, about ${USD_PER_1K_CHARS} USD per 1,000 characters.`);
  for (const p of plans) {
    console.log(
      `${p.locale}: ${p.lessons.length} lessons, ${p.clips} clips, ${p.chars.toLocaleString("en")} characters; to generate ${p.newClips} clips, ${p.newChars.toLocaleString("en")} characters (~${usd(p.newChars)})${p.voice ? "" : "; no voice set, so every clip counts as new"}`,
    );
  }
  const total = plans.reduce((n, p) => n + p.newChars, 0);
  console.log(`Total to generate: ${plans.reduce((n, p) => n + p.newClips, 0)} clips, ${total.toLocaleString("en")} characters (~${usd(total)}).`);
  if (args.dryRun) return;

  if (!apiKey) fail("ELEVENLABS_API_KEY is not set (use --dry-run for the estimate only).");
  const voiceless = plans.filter((p) => !p.voice).map((p) => p.locale);
  if (voiceless.length) fail(`No voice for ${voiceless.join(", ")}: set ELEVENLABS_VOICE_ID or ELEVENLABS_VOICE_<LOCALE>.`);

  let failed = 0;
  let fatal: string | null = null;
  for (const p of plans) {
    for (const lesson of p.lessons) {
      if (fatal) break;
      const textOf = new Map(lesson.texts.map((text) => [clipKey(p.locale, TTS_MODEL, p.voice, text), text]));
      // A clip shared with an earlier lesson (an interface string) is made once.
      const missing = [...textOf.keys()].filter((key) => !p.ready.has(clipUrl(p.locale, key)));
      let made = 0;
      await pool(
        missing,
        args.concurrency,
        async (key) => {
          const text = textOf.get(key) ?? "";
          const url = clipUrl(p.locale, key);
          try {
            if (text.length > MAX_CHARS) throw new Error(`longer than ${MAX_CHARS} characters`);
            const { audio, alignment } = await synthesize(apiKey, p.voice, p.locale, key, text);
            writeAtomic(path.join(PUBLIC, url), audio);
            const durationMs = Math.round(Math.max(0, ...alignment.character_end_times_seconds) * 1000);
            p.ready.set(url, { url, durationMs, words: wordTimings(text, alignment) });
            made++;
          } catch (e) {
            failed++;
            if (e instanceof Fatal) fatal = e.message;
            console.error(`FAIL ${p.locale} ${lesson.key} "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}": ${(e as Error).message}`);
          }
        },
        () => fatal !== null,
      );
      // Written after every lesson: the manifests are the only record of the clips' word timings.
      const manifest: NarrationClips = {};
      for (const [key, text] of textOf) {
        const clip = p.ready.get(clipUrl(p.locale, key));
        if (clip) manifest[text] = clip;
      }
      if (Object.keys(manifest).length) writeAtomic(path.join(MANIFESTS, p.locale, manifestName(lesson.key)), `${JSON.stringify(manifest)}\n`);
      console.log(`${p.locale} ${lesson.key}: ${made} generated, ${Object.keys(manifest).length} of ${lesson.texts.length} texts have a clip`);
    }
  }
  if (fatal) fail(`Stopped: ${fatal}`);
  if (failed) fail(`${failed} clips failed; run again to retry them.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
