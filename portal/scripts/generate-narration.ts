/**
 * Generates the lessons' natural narration: one clip per spoken string and language, with word timings
 * for the karaoke highlight (lesson-engine.md §1.6, recipe 6.6). Clips already on disk are reused, so a
 * rerun only makes new or changed text.
 *   npm run narration -- --lang en --provider piper
 *   npm run narration -- --lang az,ru --provider azure --dry-run
 *   npm run narration -- --lang en --provider piper --only <module>[/<lesson>] --concurrency 2
 * Providers (scripts/narration/): piper (free, offline, build machine only), azure (AZURE_SPEECH_KEY and
 * AZURE_SPEECH_REGION), elevenlabs (ELEVENLABS_API_KEY and ELEVENLABS_VOICE_<LOCALE> or ELEVENLABS_VOICE_ID).
 * Every clip is encoded by the build machine's ffmpeg (FFMPEG, else ffmpeg on PATH; deliberately not an app
 * dependency, so `npm ci` and the image never fetch it) to MP3, mono, 48 kbps, loudness-normalised.
 * Writes public/generated/tts/<locale>/<key>.mp3 (git-ignored) and content/narration/<locale>/<module>__<lesson>.json
 * (committed, read by src/server/narration.ts). Without a clip the player keeps the browser's voice.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { LOCALES, isLocale } from "../src/i18n/config";
import type { LessonFile } from "../src/lib/content/types";
import { NARRATION_DIR, clipUrl, manifestName, type NarrationClip, type NarrationClips } from "../src/lib/tts/clips";
import { clipKey } from "../src/lib/tts/key";
import { spokenTexts, type SpokenUi } from "../src/lib/tts/spoken";
import { azure } from "./narration/azure";
import { elevenLabs } from "./narration/elevenlabs";
import { piper } from "./narration/piper";
import { Fatal, failureStreak, type Provider } from "./narration/provider";

const LESSONS = path.join(process.cwd(), "content", "library", "lessons");
const PUBLIC = path.join(process.cwd(), "public");
const MANIFESTS = path.join(process.cwd(), ...NARRATION_DIR);
const FFMPEG = process.env.FFMPEG || "ffmpeg";
/** Failures in a row that mean a broken engine, encoder or disk rather than one bad text. */
const MAX_FAILURES_IN_A_ROW = 10;
const PROVIDERS: Record<string, (concurrency: number) => Provider> = { piper, azure: () => azure(), elevenlabs: elevenLabs };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const out: { locales: string[]; provider: string; only?: string; dryRun: boolean; concurrency: number } = { locales: [...LOCALES], provider: "elevenlabs", dryRun: false, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : fail(`${a} needs a value`));
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--locales" || a === "--lang") out.locales = value().split(",").map((l) => l.trim()).filter(Boolean);
    else if (a === "--provider") out.provider = value();
    else if (a === "--only") out.only = value().replace(/\/+$/, "");
    else if (a === "--concurrency") out.concurrency = Number(value());
    else fail(`Unknown argument ${a}. Options: --lang az,ru --provider ${Object.keys(PROVIDERS).join("|")} --only <module>[/<lesson>] --dry-run --concurrency 4`);
  }
  const bad = out.locales.filter((l) => !isLocale(l));
  if (bad.length || !out.locales.length) fail(`Unknown locale ${bad.join(", ") || "(none)"}; choose from ${LOCALES.join(", ")}`);
  if (!Object.hasOwn(PROVIDERS, out.provider)) fail(`Unknown provider ${out.provider}; choose from ${Object.keys(PROVIDERS).join(", ")}`);
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

/** Any audio ffmpeg reads → MP3, mono, 24 kHz, 48 kbps, normalised to −16 LUFS so every provider sounds equally loud. */
function encodeMp3(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1"];
    const child = spawn(FFMPEG, args);
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-1000)));
    child.on("error", (e) => reject(new Fatal(`ffmpeg (${FFMPEG}): ${e.message}; install ffmpeg with libmp3lame on the build machine or set FFMPEG to it`)));
    child.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-300)}`))));
    // ffmpeg that fails early closes its input: the exit code reports it.
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
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
  const provider = PROVIDERS[args.provider](args.concurrency);

  type Plan = { locale: string; voice: string; lessons: Lesson[]; ready: Map<string, NarrationClip>; clips: number; chars: number; newClips: number; newChars: number };
  const plans: Plan[] = args.locales.map((locale) => {
    const voice = provider.voice(locale);
    const lessons = lessonsIn(locale, args.only, spokenUi(locale));
    // Clips of earlier runs whose audio is still on disk (with no voice set, none can match).
    const ready = new Map([...knownClips(locale)].filter(([url]) => voice && fs.existsSync(path.join(PUBLIC, url))));
    const plan = { locale, voice, lessons, ready, clips: 0, chars: 0, newClips: 0, newChars: 0 };
    const seen = new Set<string>();
    for (const text of lessons.flatMap((l) => l.texts)) {
      const key = clipKey(locale, provider.model, voice, text);
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

  const usd = (chars: number) => `${((chars / 1000) * provider.usdPer1kChars).toFixed(2)} USD`;
  console.log(`Provider ${args.provider} (${provider.model}), about ${provider.usdPer1kChars} USD per 1,000 characters.`);
  for (const p of plans) {
    console.log(
      `${p.locale}${p.voice ? ` (${p.voice})` : ""}: ${p.lessons.length} lessons, ${p.clips} clips, ${p.chars.toLocaleString("en")} characters; to generate ${p.newClips} clips, ${p.newChars.toLocaleString("en")} characters (~${usd(p.newChars)})${p.voice ? "" : "; no voice set, so every clip counts as new"}`,
    );
  }
  const total = plans.reduce((n, p) => n + p.newChars, 0);
  console.log(`Total to generate: ${plans.reduce((n, p) => n + p.newClips, 0)} clips, ${total.toLocaleString("en")} characters (~${usd(total)}).`);
  if (args.dryRun) return;

  const voiceless = plans.filter((p) => !p.voice).map((p) => p.locale);
  if (voiceless.length) fail(`No ${args.provider} voice for ${voiceless.join(", ")}: see scripts/narration/${args.provider}.ts for the variable that sets it.`);

  let failed = 0;
  const tooMany = failureStreak(MAX_FAILURES_IN_A_ROW);
  let fatal: string | null = null;
  try {
    for (const p of plans) {
      for (const lesson of p.lessons) {
        if (fatal) break;
        const textOf = new Map(lesson.texts.map((text) => [clipKey(p.locale, provider.model, p.voice, text), text]));
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
              if (text.length > provider.maxChars) throw new Error(`longer than ${provider.maxChars} characters`);
              const { audio, durationMs, words } = await provider.synthesize(p.locale, p.voice, key, text);
              writeAtomic(path.join(PUBLIC, url), await encodeMp3(audio));
              p.ready.set(url, { url, durationMs, words });
              made++;
              tooMany(true);
            } catch (e) {
              failed++;
              if (e instanceof Fatal) fatal = e.message;
              else if (tooMany(false)) fatal = `${MAX_FAILURES_IN_A_ROW} clips failed in a row, the last: ${(e as Error).message}`;
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
  } finally {
    provider.close?.();
  }
  if (fatal) fail(`Stopped: ${fatal}`);
  if (failed) fail(`${failed} clips failed; run again to retry them.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
