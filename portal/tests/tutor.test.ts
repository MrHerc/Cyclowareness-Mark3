import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TUTOR_BODY_LIMIT, offlineAnswer, tutorRequestSchema } from "../src/server/tutor";
import type { Scene } from "../src/lib/content/types";
import { readBodyCapped } from "../src/server/request-body";

const valid = { slug: "phishing-email", lessonKey: "spot-the-signs", sceneId: "l1-tutor", question: "Why is this link unsafe?", locale: "en" };

describe("tutorRequestSchema", () => {
  it("accepts library and studio ids and a multi-line question", () => {
    expect(tutorRequestSchema.safeParse(valid).success).toBe(true);
    expect(tutorRequestSchema.safeParse({ ...valid, slug: "own-parol-qaydalari-x1y2", lessonKey: "lesson-1", sceneId: null }).success).toBe(true);
    expect(tutorRequestSchema.safeParse({ ...valid, question: "Line one\nline two\r\n\tindented" }).success).toBe(true);
    expect(tutorRequestSchema.safeParse({ ...valid, question: "Bu keçid niyə təhlükəlidir?" }).success).toBe(true);
  });

  it("rejects NUL and other control characters before they reach the database", () => {
    expect(tutorRequestSchema.safeParse({ ...valid, slug: "phishing\u0000email" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ ...valid, lessonKey: "spot\u0000" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ ...valid, sceneId: "l1\u0000tutor" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ ...valid, question: "Why\u0000 is this unsafe?" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ ...valid, question: "Why\u001b[31m unsafe?" }).success).toBe(false);
    expect(tutorRequestSchema.safeParse({ ...valid, question: "Why\u0085 unsafe?" }).success).toBe(false);
  });

  it("rejects ids outside the kebab-case format", () => {
    for (const slug of ["", "Phishing", "a/b", "a b", "x".repeat(101)]) {
      expect(tutorRequestSchema.safeParse({ ...valid, slug }).success, slug).toBe(false);
    }
    expect(tutorRequestSchema.safeParse({ ...valid, sceneId: "x".repeat(101) }).success).toBe(false);
  });
});

function streamed(parts: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Request("http://localhost/api/tutor", { method: "POST", body, duplex: "half" } as RequestInit);
}

describe("readBodyCapped", () => {
  it("returns the body when it fits, including multi-byte text split across chunks", async () => {
    expect(await readBodyCapped(new Request("http://localhost/", { method: "POST", body: JSON.stringify(valid) }), TUTOR_BODY_LIMIT)).toBe(JSON.stringify(valid));
    const bytes = new TextEncoder().encode("ə");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    });
    expect(await readBodyCapped(new Request("http://localhost/", { method: "POST", body, duplex: "half" } as RequestInit), 10)).toBe("ə");
    expect(await readBodyCapped(new Request("http://localhost/", { method: "POST" }), 10)).toBe("");
  });

  it("refuses a declared Content-Length over the limit without reading", async () => {
    // The body itself is tiny: only the header can be the reason for the refusal.
    const req = new Request("http://localhost/", { method: "POST", body: "{}", headers: { "content-length": String(3 * 1024 * 1024) } });
    expect(await readBodyCapped(req, TUTOR_BODY_LIMIT)).toBeNull();
    expect(req.bodyUsed).toBe(false);
  });

  it("cuts off a chunked body as soon as it passes the limit", async () => {
    expect(await readBodyCapped(streamed(["a".repeat(6000), "b".repeat(6000)]), TUTOR_BODY_LIMIT)).toBeNull();
    expect(await readBodyCapped(streamed(["a".repeat(4000), "b".repeat(4192)]), TUTOR_BODY_LIMIT)).toHaveLength(TUTOR_BODY_LIMIT);
  });
});

describe("offlineAnswer", () => {
  const hello = "Hello! I am your security helper.";
  const sender = "First, check the sender address.";
  const scenes: Scene[] = [
    { type: "tutor", id: "intro-tutor", beats: [{ id: "b1", say: hello, mood: "happy" }] },
    { type: "tutor", id: "spot-tutor", beats: [{ id: "b2", say: sender, mood: "happy" }] },
    { type: "recap", id: "recap", points: [sender, "Report it with the button."] },
  ];

  it("never repeats the same sentence, whether the scene is known, unknown or nothing matches", () => {
    for (const sceneId of ["intro-tutor", "spot-tutor", "missing", null]) {
      for (const question of ["Why is this email fake?", "check the sender address", "zz"]) {
        const answer = offlineAnswer(scenes, sceneId, question);
        const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean);
        expect(new Set(sentences).size, `${sceneId} / ${question}`).toBe(sentences.length);
      }
    }
  });

  it("puts the most relevant explanation first, also for Azerbaijani and Russian questions", () => {
    expect(offlineAnswer(scenes, "intro-tutor", "How do I check the sender?").startsWith(sender)).toBe(true);
    const az: Scene[] = [
      { type: "tutor", id: "a", beats: [{ id: "a1", say: "Salam!", mood: "happy" }] },
      { type: "recap", id: "r", points: ["Göndərənin ünvanını yoxlayın.", "Şübhəli halı bildirin."] },
    ];
    expect(offlineAnswer(az, "a", "Göndərənin ünvanı niyə vacibdir?").startsWith("Göndərənin ünvanını yoxlayın.")).toBe(true);
    const ru: Scene[] = [
      { type: "tutor", id: "a", beats: [{ id: "a1", say: "Привет!", mood: "happy" }] },
      { type: "recap", id: "r", points: ["Проверьте адрес отправителя.", "Сообщите о подозрительном письме."] },
    ];
    expect(offlineAnswer(ru, "a", "Зачем проверять отправителя?").startsWith("Проверьте адрес отправителя.")).toBe(true);
  });

  it("matches words of translated lessons whatever the learner types for İ, ı or ё", () => {
    const az: Scene[] = [
      { type: "tutor", id: "a", beats: [{ id: "a1", say: "Bank yoxlamanı telefonla etməz.", mood: "talk" }] },
      { type: "recap", id: "r", points: ["İkiaddımlı yoxlamanı açın."] },
    ];
    expect(offlineAnswer(az, "a", "ikiaddımlı yoxlamanı haradan açım?").startsWith("İkiaddımlı yoxlamanı açın.")).toBe(true);
    const ru: Scene[] = [
      { type: "tutor", id: "a", beats: [{ id: "a1", say: "Делать перевод по звонку нельзя.", mood: "talk" }] },
      { type: "recap", id: "r", points: ["Идёт звонок: положите трубку."] },
    ];
    expect(offlineAnswer(ru, "a", "идет звонок, что делать?").startsWith("Идёт звонок: положите трубку.")).toBe(true);
  });

  // Sentence identity as a learner reads it: case, emphasis and the closing full stop do not matter.
  const repeated = (answer: string) => {
    const keys = answer
      .split(/(?<=[.!?…])\s+/u)
      .map((x) => x.toLowerCase().replace(/[*_`~]/g, "").replace(/[\s.!?…:;,]+$/u, "").trim())
      .filter(Boolean);
    return keys.filter((k, i) => keys.indexOf(k) !== i);
  };

  it("does not repeat a sentence that also appears inside a longer explanation", () => {
    const short = "Check the licence yourself in the Central Bank's official list.";
    const long = `${short} A foreign licence is not enough here.`;
    const lesson: Scene[] = [
      { type: "tutor", id: "t", beats: [{ id: "t1", say: long, mood: "happy" }] },
      { type: "recap", id: "r", points: [short, "Never move money because of a call."] },
    ];
    const answer = offlineAnswer(lesson, "r", "Where do I check the licence?");
    // The short recap point and the beat that repeats it: the sentence is said once, the beat's new sentence is kept.
    expect(answer).toBe(long);
    // An explanation that adds nothing new is skipped for the next one.
    expect(offlineAnswer([...lesson, { type: "recap", id: "r2", points: [long] }], "r2", "Where do I check the licence?")).toBe(`${long} Never move money because of a call.`);
    expect(repeated(offlineAnswer([{ type: "recap", id: "r", points: ["**Stop** the call.", "Stop the call", "stop the CALL!"] }], "r", "stop"))).toEqual([]);
  });

  it("answers every scene of the library lessons without a repeated sentence (investment-scams/adviser-call, ac-recap among them)", () => {
    const root = path.join(__dirname, "..", "content", "library", "lessons");
    const questions = ["Where do I check the licence?", "Why is this unsafe?", "What should I do now?", "zz"];
    let replayed = 0;
    for (const dir of readdirSync(root)) {
      for (const file of readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".en.json"))) {
        const scenes = (JSON.parse(readFileSync(path.join(root, dir, file), "utf8")) as { scenes: Scene[] }).scenes;
        for (const scene of scenes) {
          for (const question of questions) {
            expect(repeated(offlineAnswer(scenes, scene.id, question)), `${dir}/${file} ${scene.id} / ${question}`).toEqual([]);
            replayed++;
          }
        }
      }
    }
    expect(replayed).toBeGreaterThan(1000);
  });
});
