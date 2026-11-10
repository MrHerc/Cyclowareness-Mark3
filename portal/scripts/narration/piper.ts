/**
 * Piper (free, offline, build machine only: the engine is GPL-3.0 and never ships, see
 * docs/build/NARRATION-RESEARCH.md §1). One Python worker per voice (piper_worker.py) loads the model once
 * and returns a WAV with the phoneme alignments of each sentence, which become exact word timings.
 * Needs `py -3.12 -m pip install --user "piper-tts[alignment]"` and the voice in .voices/:
 *   py -3.12 -m piper.download_voices en_US-ljspeech-high --data-dir .voices
 * PIPER_VOICE_<LOCALE> picks another voice (its SHA-256 must be in PIPER_VOICES); PIPER_PYTHON the interpreter.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import type { ClipWord } from "../../src/lib/tts/clips";
import { wordsOf } from "../../src/lib/tts/text";
import { Fatal, envVoice, estimateWords, sentencesOf, type Provider } from "./provider";

/**
 * The voices the generator may load, with the SHA-256 of the .onnx downloaded from
 * huggingface.co/rhasspy/piper-voices (whose voices.json MD5 it also matched). A new language's voice is
 * added here after checking its MODEL_CARD licence (NARRATION-RESEARCH.md §1.3).
 */
export const PIPER_VOICES: Record<string, string> = {
  // LJ Speech, public domain.
  "en_US-ljspeech-high": "5d4f08ba6a2a48c44592eed3ce56bf85e9de3dd4e20df90541ae68a8310c029a",
};
const DEFAULT_VOICE: Record<string, string> = { en: "en_US-ljspeech-high" };
const VOICES_DIR = path.join(process.cwd(), ".voices");
const WORKER = path.join(process.cwd(), "scripts", "narration", "piper_worker.py");

/** The worker's answer: times in samples; `words` is null for a sentence Piper could not align. */
export type PiperResult = { rate: number; samples: number; sentences: { start: number; end: number; words: [number, number][] | null }[] };

/**
 * One timing per karaoke word of `text` (speechText). Piper's word groups are used as they are when they
 * match the words one to one, for the whole text or sentence by sentence; a sentence where espeak read a
 * number or an abbreviation as several words gets an estimate within its own exact start and end.
 */
export function piperWords(text: string, r: PiperResult): ClipWord[] {
  const ms = (samples: number) => Math.round((samples / r.rate) * 1000);
  const exact = (words: readonly string[], groups: [number, number][]) => words.map((w, i) => ({ w, startMs: ms(groups[i][0]), endMs: ms(groups[i][1]) }));
  const words = wordsOf(text);
  const groups = r.sentences.flatMap((s) => s.words ?? []);
  if (r.sentences.every((s) => s.words) && groups.length === words.length) return exact(words, groups);
  const parts = sentencesOf(words);
  if (parts.length !== r.sentences.length) return estimateWords(words, 0, ms(r.samples));
  return parts.flatMap((part, k) => {
    const s = r.sentences[k];
    return s.words?.length === part.length ? exact(part, s.words) : estimateWords(part, ms(s.start), ms(s.end));
  });
}

/** A long-running worker: requests and answers are JSON lines, answered in order. */
function startWorker(voice: string) {
  const model = path.join(VOICES_DIR, `${voice}.onnx`);
  if (!PIPER_VOICES[voice]) throw new Fatal(`Piper voice ${voice} is not in PIPER_VOICES (scripts/narration/piper.ts); check its licence and record its SHA-256 there.`);
  if (!fs.existsSync(model)) throw new Fatal(`Piper voice ${voice} is missing: py -3.12 -m piper.download_voices ${voice} --data-dir .voices`);
  const sha = createHash("sha256").update(fs.readFileSync(model)).digest("hex");
  if (sha !== PIPER_VOICES[voice]) throw new Fatal(`.voices/${voice}.onnx is not the recorded file (SHA-256 ${sha}); download it again.`);
  const [cmd, ...args] = (process.env.PIPER_PYTHON || (process.platform === "win32" ? "py -3.12" : "python3")).split(" ");
  const child = spawn(cmd, [...args, WORKER, model], { stdio: ["pipe", "pipe", "pipe"] });
  const pending: { resolve: (line: string) => void; reject: (e: Error) => void }[] = [];
  let stderr = "";
  let dead: Error | null = null;
  const die = (why: string) => {
    dead = new Fatal(`Piper worker stopped (${why}); is piper-tts[alignment] installed for ${cmd} ${args.join(" ")}? ${stderr.slice(-500)}`);
    for (const p of pending.splice(0)) p.reject(dead);
  };
  child.stderr.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)));
  child.on("error", (e) => die(e.message));
  child.on("exit", (code) => die(`exit ${code}`));
  readline.createInterface({ input: child.stdout }).on("line", (line) => pending.shift()?.resolve(line));
  return {
    busy: () => pending.length,
    ask: (req: { text: string; wav: string }) =>
      new Promise<string>((resolve, reject) => {
        if (dead) return reject(dead);
        pending.push({ resolve, reject });
        child.stdin.write(`${JSON.stringify(req)}\n`);
      }),
    close: () => child.stdin.end(),
  };
}

/** `workers`: processes per voice (the generator's --concurrency), each answering its own queue. */
export function piper(workers = 1): Provider {
  const pools = new Map<string, ReturnType<typeof startWorker>[]>();
  return {
    model: "piper",
    usdPer1kChars: 0,
    maxChars: 5000,
    voice: (locale) => envVoice("PIPER_VOICE", locale, DEFAULT_VOICE[locale]),
    async synthesize(_locale, voice, key, text) {
      const pool = pools.get(voice) ?? [];
      pools.set(voice, pool);
      if (pool.length < workers) pool.push(startWorker(voice));
      const worker = pool.reduce((a, b) => (b.busy() < a.busy() ? b : a));
      const wav = path.join(os.tmpdir(), `narration-${key}.wav`);
      // The temp folder can vanish during a run of hours (a closed session's TMP): every clip would fail.
      fs.mkdirSync(path.dirname(wav), { recursive: true });
      try {
        const out = JSON.parse(await worker.ask({ text, wav })) as PiperResult & { error?: string };
        if (out.error) throw new Error(out.error);
        return { audio: fs.readFileSync(wav), durationMs: Math.round((out.samples / out.rate) * 1000), words: piperWords(text, out) };
      } finally {
        fs.rmSync(wav, { force: true });
      }
    },
    close: () => pools.forEach((pool) => pool.forEach((w) => w.close())),
  };
}
