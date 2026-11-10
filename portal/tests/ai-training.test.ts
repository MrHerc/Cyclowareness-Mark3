import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/i18n/config";
import { generateVerified, ISSUE_CODES, matchLibrary, safetyIssues, schemaCheck, verifyDraft, type Issue, type LibraryModule, type TrainingDraft, type TrainingModel, type TrainingRequest } from "../src/server/ai-verify";

const req: TrainingRequest = { prompt: "Teach staff to spot fake invoice emails", locale: "en", category: "email", difficulty: "Easy", minutes: 6, lessons: 1 };

function good(): TrainingDraft {
  return {
    title: "Fake invoices",
    subtitle: "Spot a fake invoice email before you pay.",
    lessons: [
      {
        formatVersion: 1,
        id: "lesson-1",
        title: "Check before you pay",
        minutes: 6,
        scenes: [
          { type: "intro", id: "intro", title: "Fake invoices", body: "An invoice arrives from a supplier you know.", mood: "talk" },
          { type: "tutor", id: "steps", beats: [{ id: "b1", say: "Check the sender domain, for example billing@supplier.example.", mood: "think", visual: { kind: "illustration", id: "inbox" } }] },
          {
            type: "hotspot",
            id: "find",
            prompt: "Find the signs.",
            artifact: { kind: "email", from: { address: [{ text: "pay@" }, { text: "suppl1er-pay.test", spot: "domain" }] }, subject: [{ text: "Pay today", spot: "urgent" }], body: "See invoice.pdf" },
            spots: [
              { id: "domain", label: "Foreign domain", explain: "Not the supplier's domain." },
              { id: "urgent", label: "Urgency", explain: "Pressure to act fast." },
            ],
            minToFind: 2,
          },
          {
            type: "choice",
            id: "check",
            question: {
              prompt: "The bank details changed. What do you do?",
              options: [
                { id: "o1", label: "Call the supplier on the number you know", correct: true, feedback: "Right." },
                { id: "o2", label: "Pay quickly", correct: false, feedback: "No." },
              ],
            },
          },
          { type: "recap", id: "recap", points: ["Check the domain", "Call the number you know"], mood: "celebrate" },
        ],
      },
    ],
  };
}

const messages = (issues: Issue[]) => issues.map((i) => i.message).join("\n");

describe("safety checker", () => {
  it("passes a clean training with example domains and file names", () => {
    expect(safetyIssues(good())).toEqual([]);
  });

  it("flags real-looking domains, defanged hosts, emails, phone numbers and profanity", () => {
    const d = good();
    const tutor = d.lessons[0].scenes[1] as Extract<TrainingDraft["lessons"][0]["scenes"][0], { type: "tutor" }>;
    tutor.beats[0].say = "Go to https://paypal.com, mail boss@realcorp.az, see bank[.]com, call +994 50 123 45 67. Shit happens.";
    const m = messages(safetyIssues(d));
    expect(m).toContain("paypal.com");
    expect(m).toContain("boss@realcorp.az");
    expect(m).toContain("bank.com");
    expect(m).toContain("phone number");
    expect(m).toContain("inappropriate word");
  });

  it("flags profanity in every interface language, but not a word that only starts like one", () => {
    for (const word of ["Scheiße", "putain", "orospu", "muie", "ყლე", "курва", "شرموط"]) {
      const d = good();
      d.subtitle = `Spot it. ${word}!`;
      expect(messages(safetyIssues(d)), word).toContain("inappropriate word");
    }
    const d = good();
    d.subtitle = "A fickle sender: götürün, technique.";
    expect(safetyIssues(d)).toEqual([]);
  });

  it("checks correct-answer counts, unknown illustrations and unmarked hotspot spots", () => {
    const d = good();
    const scenes = d.lessons[0].scenes;
    const choice = scenes[3] as Extract<(typeof scenes)[number], { type: "choice" }>;
    choice.question.options[1].correct = true;
    const tutor = scenes[1] as Extract<(typeof scenes)[number], { type: "tutor" }>;
    tutor.beats[0].visual = { kind: "illustration", id: "unicorn" };
    const hot = scenes[2] as Extract<(typeof scenes)[number], { type: "hotspot" }>;
    hot.spots.push({ id: "link", label: "Link", explain: "Outside form." });
    const m = messages(safetyIssues(d));
    expect(m).toContain("2 correct options, needs exactly 1");
    expect(m).toContain("unknown illustration id: unicorn");
    expect(m).toContain('spot "link" is not marked');
  });

  it("accepts a multi-answer question with two correct options", () => {
    const d = good();
    const choice = d.lessons[0].scenes[3] as Extract<TrainingDraft["lessons"][0]["scenes"][0], { type: "choice" }>;
    choice.multi = true;
    choice.question.options.push({ id: "o3", label: "Report it", correct: true, feedback: "Yes." });
    expect(safetyIssues(d)).toEqual([]);
  });
});

describe("schema step", () => {
  it("rejects a draft that is not in the lesson format", () => {
    const r = schemaCheck({ title: "x", lessons: [] });
    expect(r.draft).toBeNull();
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("reports integrity errors such as a missing scenario start node", () => {
    const d = good();
    d.lessons[0].scenes.push({ type: "scenario", id: "sc", title: "T", start: "nope", nodes: [{ id: "n1", text: "Hi" }] });
    expect(messages(schemaCheck(d).issues)).toContain("start node nope missing");
  });

  it("writes formatVersion 1 on a lesson the model sent without it, and refuses another version", () => {
    const d = good();
    const unversioned: Partial<TrainingDraft["lessons"][0]> = { ...d.lessons[0] };
    delete unversioned.formatVersion;
    const r = schemaCheck({ ...d, lessons: [unversioned] });
    expect(r.issues).toEqual([]);
    expect(r.draft?.lessons[0].formatVersion).toBe(1);
    expect(schemaCheck({ ...d, lessons: [{ ...unversioned, formatVersion: 2 }] }).draft).toBeNull();
  });
});

describe("issue codes for the Studio", () => {
  it("gives every checker issue a code, parameters and a path to the scene", () => {
    const d = good();
    const choice = d.lessons[0].scenes[3] as Extract<TrainingDraft["lessons"][0]["scenes"][0], { type: "choice" }>;
    choice.question.options[1].correct = true;
    const tutor = d.lessons[0].scenes[1] as Extract<TrainingDraft["lessons"][0]["scenes"][0], { type: "tutor" }>;
    tutor.beats[0].say = "Call +994 50 123 45 67 or open realbank.com.";
    const issues = safetyIssues(d);
    expect(issues.every((i) => i.code)).toBe(true);
    expect(issues).toContainEqual(expect.objectContaining({ code: "singleCorrectCount", params: { count: 2 }, where: "lessons.0.scenes.3" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "realDomain", params: { value: "realbank.com" }, where: "lessons.0.scenes.1.beats.0.say" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "phone" }));
  });

  it("maps schema and integrity errors to codes", () => {
    const missing = schemaCheck({ subtitle: "", lessons: [{ id: "l", title: "T", minutes: 3, scenes: [{ type: "recap", id: "r", points: ["a"] }] }] });
    expect(missing.issues[0]).toMatchObject({ code: "missing", where: "title" });
    const short = schemaCheck({ title: "ab", subtitle: "", lessons: [{ id: "l", title: "T", minutes: 3, scenes: [{ type: "recap", id: "r", points: ["a"] }] }] });
    expect(short.issues[0]).toMatchObject({ code: "textShort", params: { min: 3 } });
    const d = good();
    d.lessons[0].scenes.push({ type: "scenario", id: "sc", title: "T", start: "nope", nodes: [{ id: "n1", text: "Hi" }] });
    d.lessons[0].scenes.push({ type: "recap", id: "recap", points: ["Again"] });
    const tutor = d.lessons[0].scenes[1] as Extract<TrainingDraft["lessons"][0]["scenes"][0], { type: "tutor" }>;
    tutor.beats[0].checkpoint = { prompt: "Which?", options: [{ id: "a", label: "A", correct: false, feedback: "No." }, { id: "b", label: "B", correct: false, feedback: "No." }] };
    const codes = schemaCheck(d).issues;
    expect(codes).toContainEqual(expect.objectContaining({ code: "noCorrectOption", where: "lessons.0.scenes.1" }));
    expect(codes).toContainEqual(expect.objectContaining({ code: "startMissing", params: { node: "nope" }, where: "lessons.0.scenes.5" }));
    expect(codes).toContainEqual(expect.objectContaining({ code: "duplicateSceneId", params: { id: "recap" } }));
  });

  it("has a message for every code in every interface language", () => {
    for (const locale of LOCALES) {
      const secops = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", locale, "secops.json"), "utf8"));
      for (const code of ISSUE_CODES) expect(secops.aiTrainer.issues[code], `${locale}: ${code}`).toBeTypeOf("string");
    }
  });
});

function fakeModel(drafts: unknown[], reviews: Issue[][]): TrainingModel & { calls: { feedback?: string[] }[] } {
  const calls: { feedback?: string[] }[] = [];
  let g = 0;
  let r = 0;
  return {
    calls,
    async generate(_req, feedback) {
      calls.push({ feedback });
      return drafts[Math.min(g++, drafts.length - 1)];
    },
    async review() {
      return reviews[Math.min(r++, reviews.length - 1)] ?? [];
    },
  };
}

describe("verification pipeline", () => {
  it("verifies a good training on the first attempt", async () => {
    const model = fakeModel([good()], [[{ severity: "minor", message: "Shorter sentences" }]]);
    const r = await generateVerified(model, req);
    expect(r.verification.verdict).toBe("verified");
    expect(r.verification.attempts).toBe(1);
    expect(r.verification.steps.map((s) => s.status)).toEqual(["pass", "pass", "pass"]);
    expect(model.calls).toHaveLength(1);
  });

  it("regenerates once with the safety issues as feedback and passes", async () => {
    const bad = good();
    (bad.lessons[0].scenes[0] as { body: string }).body = "Visit realbank.com now.";
    const model = fakeModel([bad, good()], [[]]);
    const r = await generateVerified(model, req);
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1].feedback?.join(" ")).toContain("realbank.com");
    expect(r.verification.verdict).toBe("verified");
    expect(r.verification.attempts).toBe(2);
  });

  it("regenerates on blocking reviewer issues and ends in needs_review when they persist", async () => {
    const blocking: Issue[] = [{ severity: "blocking", message: "Advice to pay first is wrong", where: "lesson-1/check" }];
    const model = fakeModel([good(), good()], [blocking, blocking]);
    const r = await generateVerified(model, req);
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1].feedback?.[0]).toContain("Advice to pay first is wrong");
    expect(r.verification.verdict).toBe("needs_review");
    expect(r.verification.steps[2]).toMatchObject({ id: "review", status: "fail" });
  });

  it("skips the AI review without a reviewer and never calls the draft verified", async () => {
    const r = await verifyDraft(good(), null);
    expect(r.steps.map((s) => [s.id, s.status])).toEqual([
      ["schema", "pass"],
      ["safety", "pass"],
      ["review", "skipped"],
    ]);
    expect(r.steps[2].note).toBe("offline");
    expect(r.verdict).toBe("needs_review");
  });

  it("treats a reviewer error as skipped, not passed", async () => {
    const r = await verifyDraft(good(), async () => {
      throw new Error("down");
    });
    expect(r.steps[2]).toMatchObject({ status: "skipped", note: "unavailable" });
    expect(r.verdict).toBe("needs_review");
  });
});

describe("library fallback matcher", () => {
  const modules: LibraryModule[] = [
    { id: "1", slug: "password-basics", category: "accounts", title: { en: "Strong passwords", az: "Güclü parollar" }, subtitle: { en: "Make passwords you can remember" } },
    { id: "2", slug: "invoice-fraud", category: "email", title: { en: "Invoice fraud", az: "Hesab-faktura fırıldağı" }, subtitle: { en: "Fake invoices and changed bank details" } },
    { id: "3", slug: "usb-drops", category: "devices", title: { en: "Found USB sticks" }, subtitle: { en: "Unknown devices" } },
  ];

  it("picks the module sharing the most words with the prompt", () => {
    expect(matchLibrary("Teach staff to spot fake invoices from suppliers", modules, "en")?.slug).toBe("invoice-fraud");
    expect(matchLibrary("passwords for new employees", modules, "en")?.slug).toBe("password-basics");
  });

  it("matches in the chosen language", () => {
    expect(matchLibrary("İşçilərə güclü parol yaratmağı öyrət", modules, "az")?.slug).toBe("password-basics");
  });

  it("returns null when nothing matches", () => {
    expect(matchLibrary("quantum chromodynamics", modules, "en")).toBeNull();
  });
});

describe("draftWithinLimit", () => {
  it("accepts a real draft and refuses one padded past the limit or one that cannot be serialised", async () => {
    const { DRAFT_MAX_CHARS, draftWithinLimit } = await import("../src/server/ai-verify");
    expect(draftWithinLimit(good())).toBe(true);
    expect(draftWithinLimit({ ...good(), extra: "x".repeat(DRAFT_MAX_CHARS) })).toBe(false);
    const cyclic: Record<string, unknown> = { ...good() };
    cyclic.self = cyclic;
    expect(draftWithinLimit(cyclic)).toBe(false);
    expect(draftWithinLimit(undefined)).toBe(true);
  });
});
