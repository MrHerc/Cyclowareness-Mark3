import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { clipKey } from "@/lib/tts/key";
import { wordsOf } from "@/lib/tts/text";
import { unzip, zip } from "@/server/zip";
import { azure, boundaryAlignment, ssml, wavDurationMs } from "../scripts/narration/azure";
import { piper, piperWords, type PiperResult } from "../scripts/narration/piper";
import { Fatal, estimateWords, failureStreak, sentencesOf } from "../scripts/narration/provider";

/** A PCM WAV of `ms` silence at 24 kHz, 16-bit mono (Azure's riff-24khz-16bit-mono-pcm). */
function wav(ms: number): Buffer {
  const data = Buffer.alloc(48 * ms);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(24_000, 24);
  h.writeUInt32LE(48_000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const forward = (words: { startMs: number; endMs: number }[]) => words.every((w, i) => w.endMs >= w.startMs && (i === 0 || w.startMs >= words[i - 1].startMs));

describe("timing estimate", () => {
  it("shares a stretch of audio between the words by length, moving forward only", () => {
    const words = estimateWords(["Hi", "there,", "friend."], 1000, 2700);
    expect(words.map((w) => w.w)).toEqual(["Hi", "there,", "friend."]);
    expect(words[0].startMs).toBe(1000);
    expect(words[2].endMs).toBeLessThanOrEqual(2700);
    expect(words[1].endMs - words[1].startMs).toBeGreaterThan(words[0].endMs - words[0].startMs);
    expect(forward(words)).toBe(true);
  });

  it("splits karaoke words into sentences at . ! ? … and closing quotes", () => {
    expect(sentencesOf(wordsOf('Stop. Is it "real?" Check… then go'))).toEqual([["Stop."], ["Is", "it", '"real?"'], ["Check…"], ["then", "go"]]);
  });
});

describe("failure streak", () => {
  it("stops only after the limit of failures in a row; a success resets the count", () => {
    const tooMany = failureStreak(3);
    expect([false, false, true, false, false].map((ok) => tooMany(ok))).toEqual([false, false, false, false, false]);
    expect(tooMany(false)).toBe(true);
  });
});

describe("Piper word timings", () => {
  const r = (sentences: PiperResult["sentences"], samples = 44_100): PiperResult => ({ rate: 22_050, samples, sentences });

  it("uses Piper's word groups as they are when they match the words", () => {
    const words = piperWords("Check it. Now!", r([{ start: 0, end: 22_050, words: [[0, 11_025], [11_025, 22_050]] }, { start: 22_050, end: 44_100, words: [[22_050, 44_100]] }]));
    expect(words).toEqual([
      { w: "Check", startMs: 0, endMs: 500 },
      { w: "it.", startMs: 500, endMs: 1000 },
      { w: "Now!", startMs: 1000, endMs: 2000 },
    ]);
  });

  it("estimates only inside the sentence espeak read differently, keeping its exact start and end", () => {
    // "2,500" became three spoken words in the first sentence.
    const words = piperWords("Pay 2,500 now. Stop!", r([{ start: 0, end: 22_050, words: [[0, 5000], [5000, 9000], [9000, 13_000], [13_000, 17_000], [17_000, 22_050]] }, { start: 22_050, end: 44_100, words: [[23_000, 44_000]] }]));
    expect(words.map((w) => w.w)).toEqual(["Pay", "2,500", "now.", "Stop!"]);
    expect(words[0].startMs).toBe(0);
    expect(words[2].endMs).toBeLessThanOrEqual(1000);
    expect(words[3]).toEqual({ w: "Stop!", startMs: 1043, endMs: 1995 });
    expect(forward(words)).toBe(true);
  });

  it("estimates over the whole clip when the sentences do not line up or were not aligned", () => {
    const words = piperWords("Dr. Smith called. Hang up.", r([{ start: 0, end: 44_100, words: null }]));
    expect(words).toHaveLength(5);
    expect(words[4].endMs).toBeLessThanOrEqual(2000);
    expect(forward(words)).toBe(true);
  });

  it("refuses a voice whose checksum is not recorded", async () => {
    const p = piper();
    await expect(p.synthesize("en", "en_US-lessac-high", "k", "Hi.")).rejects.toBeInstanceOf(Fatal);
    p.close?.();
  });
});

describe("clip keys per provider", () => {
  it("names a clip by provider and voice, so another provider or voice never reuses it", () => {
    const keys = [clipKey("en", "piper", "en_US-ljspeech-high", "Hi."), clipKey("en", "azure", "en_US-ljspeech-high", "Hi."), clipKey("en", "piper", "en_GB-cori-high", "Hi.")];
    expect(new Set(keys).size).toBe(3);
  });
});

describe("Azure helpers", () => {
  it("escapes the text into SSML with the voice's language", () => {
    expect(ssml("az-AZ-BanuNeural", 'Klikləmə <a> & "bax"')).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="az-AZ"><voice name="az-AZ-BanuNeural">Klikləmə &lt;a&gt; &amp; &quot;bax&quot;</voice></speak>',
    );
  });

  it("reads a WAV's length and a zip's files", () => {
    expect(wavDurationMs(wav(1250))).toBe(1250);
    const files = unzip(zip([{ name: "0001.word.json", data: Buffer.from("[]") }, { name: "0001.wav", data: wav(10) }]));
    expect(files.get("0001.word.json")?.toString()).toBe("[]");
    expect(files.get("0001.wav")?.length).toBe(44 + 480);
  });
});

describe("Azure batch synthesis against a fake server", () => {
  const boundaries = [
    { Text: "Salam", AudioOffset: 50, Duration: 400, BoundaryType: "WordBoundary" },
    { Text: ",", AudioOffset: 450, Duration: 0, BoundaryType: "PunctuationBoundary" },
    { Text: "dünya", AudioOffset: 600, Duration: 500, BoundaryType: "WordBoundary" },
    { Text: "!", AudioOffset: 1100, Duration: 0, BoundaryType: "PunctuationBoundary" },
  ];
  const seen: { method: string; url: string; key?: string; body?: string }[] = [];
  let mode: "ok" | "fail" | "denied" = "ok";
  let polls = 0;
  let base = "";
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", key: req.headers["ocp-apim-subscription-key"] as string | undefined, body });
      const json = (status: number, data: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(data));
      if (mode === "denied") return json(401, { error: "bad key" });
      if (req.url === "/result.zip") return res.writeHead(200).end(zip([{ name: "0001.wav", data: wav(1200) }, { name: "0001.word.json", data: Buffer.from(JSON.stringify(boundaries)) }, { name: "summary.json", data: Buffer.from("{}") }]));
      if (req.method === "PUT") return json(201, { status: "NotStarted" });
      if (req.method === "DELETE") return res.writeHead(204).end();
      if (mode === "fail") return json(200, { status: "Failed", properties: { error: { message: "voice not found" } } });
      return json(200, polls++ < 1 ? { status: "Running" } : { status: "Succeeded", outputs: { result: `${base}/result.zip` } });
    });
  });

  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vi.stubEnv("AZURE_SPEECH_KEY", "test-key");
    vi.stubEnv("AZURE_SPEECH_REGION", "westeurope");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    server.close();
  });

  it("submits SSML with word boundaries, polls, unzips the WAV and turns the boundaries into karaoke timings", async () => {
    const p = azure({ endpoint: base, pollMs: 1 });
    expect(p.voice("az")).toBe("az-AZ-BanuNeural");
    const out = await p.synthesize("az", "az-AZ-BanuNeural", "a".repeat(64), "Salam, dünya!");
    expect(out.durationMs).toBe(1200);
    expect(out.words).toEqual([
      { w: "Salam,", startMs: 50, endMs: 450 },
      { w: "dünya!", startMs: 600, endMs: 1100 },
    ]);
    const put = seen.find((s) => s.method === "PUT");
    expect(put?.url).toMatch(/^\/texttospeech\/batchsyntheses\/cw-a{24}-[0-9a-z]+\?api-version=2024-04-01$/);
    expect(put?.key).toBe("test-key");
    const body = JSON.parse(put?.body ?? "{}");
    expect(body.inputKind).toBe("SSML");
    expect(body.inputs[0].content).toContain('<voice name="az-AZ-BanuNeural">Salam, dünya!</voice>');
    expect(body.properties).toMatchObject({ outputFormat: "riff-24khz-16bit-mono-pcm", wordBoundaryEnabled: true });
    // The result URL carries its own token: the Speech key stays with the Speech endpoint.
    expect(seen.find((s) => s.url === "/result.zip")?.key).toBeUndefined();
    expect(seen.some((s) => s.method === "DELETE")).toBe(true);
  });

  it("reports a failed job and stops the run on a refused key", async () => {
    mode = "fail";
    await expect(azure({ endpoint: base, pollMs: 1 }).synthesize("ru", "ru-RU-SvetlanaNeural", "b".repeat(64), "Привет.")).rejects.toThrow("voice not found");
    mode = "denied";
    await expect(azure({ endpoint: base, pollMs: 1 }).synthesize("ru", "ru-RU-SvetlanaNeural", "b".repeat(64), "Привет.")).rejects.toBeInstanceOf(Fatal);
  });

  it("checks the key, region and voice before calling Azure", async () => {
    await expect(azure({ endpoint: base }).synthesize("az", "<voice>", "c".repeat(64), "Salam.")).rejects.toBeInstanceOf(Fatal);
    vi.stubEnv("AZURE_SPEECH_KEY", "");
    await expect(azure({ endpoint: base }).synthesize("az", "az-AZ-BanuNeural", "c".repeat(64), "Salam.")).rejects.toThrow("AZURE_SPEECH_KEY");
  });

  it("keeps boundary times per character for wordTimings", () => {
    const a = boundaryAlignment(boundaries);
    expect(a.characters.join("")).toBe("Salam, dünya!");
  });
});
