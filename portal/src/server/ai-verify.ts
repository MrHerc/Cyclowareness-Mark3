import { z } from "zod";
import { lessonFileSchema, lessonIntegrityErrors } from "../lib/content/validate";
import type { LessonFile } from "../lib/content/types";
import { LOCALES } from "../i18n/config";

/**
 * Verification of a generated (or library-assembled) training before it is saved as a draft:
 * (1) schema, (2) safety rules, (3) an AI reviewer pass. Pure functions, no database, so the
 * pipeline is unit-tested with a fake model client (tests/ai-training.test.ts).
 */

/** The lesson illustration ids the player can draw (src/components/player/illustrations.tsx). */
export const ILLUSTRATION_IDS = [
  "shield", "eye", "lock", "alarm", "phone-lock", "handshake", "browser", "badge-id", "key", "mfa-phone",
  "inbox", "folder", "social", "mask", "download", "deepfake", "hook", "cloud", "usb", "desk",
  "update", "wifi", "ceo", "ransomware", "travel", "certificate", "vpn", "flag", "qr",
] as const;

export const TRAINING_LOCALES = LOCALES;

export type TrainingRequest = {
  prompt: string;
  locale: (typeof TRAINING_LOCALES)[number];
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  minutes: number;
  lessons: number;
};

export const trainingDraftSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().max(240),
  // The model is not asked for the format version: the Studio writes the current one.
  lessons: z.array(lessonFileSchema.extend({ formatVersion: lessonFileSchema.shape.formatVersion.default(1) })).min(1).max(3),
});
export type TrainingDraft = { title: string; subtitle: string; lessons: LessonFile[] };

export type Severity = "blocking" | "minor";
/**
 * What the checker found, for the Studio to show in the admin's language (secops.aiTrainer.issues.<code>
 * with `params`). The AI reviewer's own findings have no code: their `message` is already written in
 * the admin's language.
 */
export const ISSUE_CODES = [
  "missing", "wrongType", "textShort", "textLong", "fewItems", "manyItems", "numberSmall", "numberLarge", "badValue", "badFormat",
  "duplicateSceneId", "startMissing", "nextMissing", "noCorrectOption", "minToFindTooHigh", "structure",
  "emailOutside", "realDomain", "phone", "profanity", "unknownIllustration", "optionIdsRepeat", "multiFewCorrect", "multiNoWrong",
  "singleCorrectCount", "spotNotMarked", "orderIdsRepeat", "swipeNoThreat",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];
/**
 * `message` is English: it is the feedback the model gets when it rewrites a draft. `where` is a path
 * into the draft ("lessons.0.scenes.3.question.options.1.label") or, from the reviewer, "lesson id/scene id".
 */
export type Issue = { severity: Severity; message: string; where?: string; code?: IssueCode; params?: Record<string, string | number> };
export type StepId = "schema" | "safety" | "review";
export type StepStatus = "pass" | "fail" | "skipped";
export type VerifyStep = { id: StepId; status: StepStatus; issues: Issue[]; note?: "offline" | "unavailable" | "blocked" };
export type Verification = { verdict: "verified" | "needs_review"; steps: VerifyStep[]; attempts: number };

/* ───────── step 1: schema ───────── */

function valueAt(raw: unknown, path: readonly PropertyKey[]): unknown {
  let v = raw;
  for (const k of path) {
    if (!v || typeof v !== "object") return undefined;
    v = (v as Record<PropertyKey, unknown>)[k];
  }
  return v;
}

/** A schema problem as a code the Studio can translate; the zod message stays as the model's feedback. */
function schemaIssue(raw: unknown, i: z.core.$ZodIssue): Pick<Issue, "code" | "params"> {
  switch (i.code) {
    case "invalid_type":
      return { code: valueAt(raw, i.path) === undefined ? "missing" : "wrongType" };
    case "too_small": {
      const min = Number(i.minimum);
      return i.origin === "string" ? { code: "textShort", params: { min } } : i.origin === "array" ? { code: "fewItems", params: { min } } : { code: "numberSmall", params: { min } };
    }
    case "too_big": {
      const max = Number(i.maximum);
      return i.origin === "string" ? { code: "textLong", params: { max } } : i.origin === "array" ? { code: "manyItems", params: { max } } : { code: "numberLarge", params: { max } };
    }
    case "invalid_value":
    case "invalid_union":
      return { code: "badValue" };
    default:
      return { code: "badFormat" };
  }
}

/** Codes for the cross-reference errors of lessonIntegrityErrors ("<scene>: start node x missing", "<scene>/<step>: next y missing"…). */
function integrityIssue(lesson: LessonFile, li: number, e: string): Issue {
  const sceneAt = (id: string) => {
    const si = lesson.scenes.findIndex((s) => s.id === id);
    return si >= 0 ? `lessons.${li}.scenes.${si}` : `lessons.${li}`;
  };
  let m = /^([^:/]+): start node (.+) missing$/.exec(e);
  if (m) return { severity: "blocking", message: e, where: sceneAt(m[1]), code: "startMissing", params: { node: m[2] } };
  m = /^([^:/]+)\/[^:]+: next (.+) missing$/.exec(e);
  if (m) return { severity: "blocking", message: e, where: sceneAt(m[1]), code: "nextMissing", params: { next: m[2] } };
  m = /^([^:/]+): no correct option$/.exec(e);
  if (m) return { severity: "blocking", message: e, where: sceneAt(m[1]), code: "noCorrectOption" };
  m = /^([^:/]+)\/[^:]+: checkpoint without correct option$/.exec(e);
  if (m) return { severity: "blocking", message: e, where: sceneAt(m[1]), code: "noCorrectOption" };
  m = /^([^:/]+): minToFind > spots$/.exec(e);
  if (m) return { severity: "blocking", message: e, where: sceneAt(m[1]), code: "minToFindTooHigh" };
  // The English detail stays in `message` for the model; the Studio shows the translated sentence alone.
  return { severity: "blocking", message: e, where: `lessons.${li}`, code: "structure" };
}

/**
 * A saved draft is stored as is and sent to every learner who opens it. The largest library lesson is about 32 KB of
 * JSON, so a whole draft above this is not a training but extra data riding along (the lesson schema lets unknown keys through).
 */
export const DRAFT_MAX_CHARS = 512 * 1024;

/** Whether the client's draft serialises to at most DRAFT_MAX_CHARS (a value that cannot be serialised is refused). */
export function draftWithinLimit(draft: unknown): boolean {
  try {
    return (JSON.stringify(draft ?? null)?.length ?? 0) <= DRAFT_MAX_CHARS;
  } catch {
    return false;
  }
}

export function schemaCheck(raw: unknown): { draft: TrainingDraft | null; issues: Issue[] } {
  const p = trainingDraftSchema.safeParse(raw);
  if (!p.success) {
    return {
      draft: null,
      issues: p.error.issues.slice(0, 12).map((i) => ({ severity: "blocking" as const, message: i.message, where: i.path.join(".") || undefined, ...schemaIssue(raw, i) })),
    };
  }
  const issues: Issue[] = [];
  const draft = p.data as unknown as TrainingDraft;
  draft.lessons.forEach((l, li) => {
    for (const e of lessonIntegrityErrors(p.data.lessons[li])) issues.push(integrityIssue(l, li, e));
    const ids = l.scenes.map((s) => s.id);
    const di = ids.findIndex((id, i) => ids.indexOf(id) !== i);
    if (di >= 0) issues.push({ severity: "blocking", message: `duplicate scene id ${ids[di]}`, where: `lessons.${li}.scenes.${di}`, code: "duplicateSceneId", params: { id: ids[di] } });
  });
  return { draft, issues };
}

/* ───────── step 2: safety rules ───────── */

/** Reserved for documentation (RFC 2606 / 6761): the only domains a lesson may show. */
const SAFE_TLD = /\.(example|test|invalid|localhost)$/;
const SAFE_SLD = /(^|\.)example\.(com|net|org)$/;
/** "invoice.pdf" or "Node.js" look like domains to the pattern below; they are file names. */
const FILE_EXT = new Set("pdf doc docx xls xlsx xlsm ppt pptx txt csv zip rar 7z exe msi bat cmd scr lnk iso img png jpg jpeg gif svg webp mp3 mp4 wav mov html htm js ts json xml eml ics apk dmg pkg vbs ps1 py sh jar dll".split(" "));
const DOMAIN = /(?<![\p{L}\p{N}@._-])(?:https?:\/\/)?((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+\p{L}{2,24})(?![\p{L}\p{N}@-])/gu;
/**
 * Matched from the "@", with the local part (group 1) read backwards by the lookbehind, and at most 126
 * labels (the DNS limit) in the domain (group 2): each character is scanned a bounded number of times.
 * A pattern that starts with the local part re-scans a long run from every position (quadratic).
 */
const EMAIL = /@(?<=([\p{L}\p{N}._%+-]+)@)((?:[\p{L}\p{N}-]{1,63}\.){1,126}\p{L}{2,24})/gu;
/** Nine or more digits in a row, optionally split by spaces, dots, dashes or brackets, as phone numbers are written. */
const PHONE = /(?<![\p{N}])\+?\d(?:[\s().-]{0,2}\d){8,14}(?![\p{N}])/gu;
// Only unambiguous words per language (a false hit blocks saving a draft): en, ru/uk, az/tr, ro, ka, de, fr, ar.
const PROFANITY = new RegExp(
  `(?<!\\p{L})(${[
    "fuck\\p{L}*|shit|bullshit|bitch\\p{L}*|asshole|cunt|motherfucker",
    "хуй\\p{L}*|хуе\\p{L}*|пизд\\p{L}*|бля\\p{L}*|еба\\p{L}*|ёба\\p{L}*|йоб\\p{L}*|сука|мудак\\p{L}*|курв\\p{L}*",
    "sikim|sikdir\\p{L}*|siktir\\p{L}*|orospu\\p{L}*|yarrak\\p{L}*|qəhbə\\p{L}*|götveren|peysər\\p{L}*|gijdıllaq",
    "muie|pizd\\p{L}*|căcat",
    "ყლე|ბოზი|ტრაკი|მუტელი",
    "scheiße|scheisse|fick|ficken|fickt|gefickt|arschloch\\p{L}*|hurensohn|wichser|fotze",
    "putain|merde\\p{L}*|connard\\p{L}*|connasse|salope\\p{L}*|encul\\p{L}*",
    "شرموط\\p{L}*|منيوك\\p{L}*|كسمك|طيز\\p{L}*",
  ].join("|")})(?!\\p{L})`,
  "giu",
);

function safeDomain(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return SAFE_TLD.test(h) || SAFE_SLD.test(h);
}

/** Every string in the draft with its JSON path. Keys are not content and are skipped. */
function strings(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}.${i}`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) strings(v, path ? `${path}.${k}` : k, out);
}

function spotIds(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) value.forEach((v) => spotIds(v, out));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.spot === "string") out.add(o.spot);
    for (const v of Object.values(o)) spotIds(v, out);
  }
}

function illustrationIds(value: unknown, out: { path: string; id: string }[], path = "") {
  if (Array.isArray(value)) value.forEach((v, i) => illustrationIds(v, out, `${path}.${i}`));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (o.kind === "illustration" && typeof o.id === "string") out.push({ path, id: o.id });
    for (const [k, v] of Object.entries(o)) illustrationIds(v, out, path ? `${path}.${k}` : k);
  }
}

export function safetyIssues(draft: TrainingDraft): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string, where: string, code: IssueCode, params?: Issue["params"]) => {
    // One entry per problem (the first place it occurs), so a domain repeated in ten artifacts is one issue.
    if (issues.length < 30 && !issues.some((i) => i.message === message)) issues.push({ severity: "blocking", message, where, code, ...(params ? { params } : {}) });
  };
  const all: { path: string; text: string }[] = [];
  strings(draft, "", all);
  for (const { path, text } of all) {
    // Defanged hosts ("bank[.]com") are still real hosts.
    const norm = text.replace(/\[\.\]|\(\.\)|\{\.\}/g, ".").replace(/hxxps?:\/\//gi, "https://");
    for (const m of norm.matchAll(EMAIL)) {
      const address = m[1] + m[0];
      if (!safeDomain(m[2])) add(`email address outside example domains: ${address}`, path, "emailOutside", { value: address });
    }
    for (const m of norm.matchAll(DOMAIN)) {
      const host = m[1];
      const tld = host.split(".").pop()!.toLowerCase();
      if (FILE_EXT.has(tld) && !m[0].includes("://")) continue;
      if (!safeDomain(host)) add(`real-looking domain or URL: ${host}`, path, "realDomain", { value: host });
    }
    for (const m of norm.matchAll(PHONE)) add(`phone number: ${m[0].trim()}`, path, "phone", { value: m[0].trim() });
    for (const m of text.matchAll(PROFANITY)) add(`inappropriate word: ${m[0]}`, path, "profanity", { value: m[0] });
  }
  const known = new Set<string>(ILLUSTRATION_IDS);
  draft.lessons.forEach((lesson, li) => {
    const ill: { path: string; id: string }[] = [];
    illustrationIds(lesson, ill, `lessons.${li}`);
    for (const i of ill) if (!known.has(i.id)) add(`unknown illustration id: ${i.id}`, i.path, "unknownIllustration", { id: i.id });
    lesson.scenes.forEach((s, si) => {
      const where = `lessons.${li}.scenes.${si}`;
      if (s.type === "choice") {
        const opts = s.question.options;
        const correct = opts.filter((o) => o.correct).length;
        if (new Set(opts.map((o) => o.id)).size !== opts.length) add("choice option ids repeat", where, "optionIdsRepeat");
        if (s.multi) {
          if (correct < 2) add(`multi-answer question has ${correct} correct option(s), needs at least 2`, where, "multiFewCorrect", { count: correct });
          if (correct === opts.length) add("multi-answer question has no wrong option", where, "multiNoWrong");
        } else if (correct !== 1) add(`single-answer question has ${correct} correct options, needs exactly 1`, where, "singleCorrectCount", { count: correct });
      }
      if (s.type === "hotspot") {
        const marked = new Set<string>();
        spotIds(s.artifact, marked);
        s.spots.forEach((spot, pi) => {
          if (!marked.has(spot.id)) add(`hotspot spot "${spot.id}" is not marked in the artifact`, `${where}.spots.${pi}`, "spotNotMarked", { spot: spot.label || spot.id });
        });
      }
      if (s.type === "order" && new Set(s.items.map((i) => i.id)).size !== s.items.length) add("order item ids repeat", where, "orderIdsRepeat");
      if (s.type === "swipe" && !s.cards.some((c) => c.verdict === "threat")) add("swipe has no threat card", where, "swipeNoThreat");
    });
  });
  return issues;
}

/* ───────── the pipeline ───────── */

/** The model client the pipeline calls; the Anthropic one lives in src/server/ai.ts, tests pass a fake. */
export type TrainingModel = {
  generate(req: TrainingRequest, feedback?: string[]): Promise<unknown>;
  review(req: TrainingRequest, draft: TrainingDraft): Promise<Issue[]>;
};

/** Runs steps 1–3 on one draft. `review` is null when AI is not connected: step 3 is then skipped. */
export async function verifyDraft(raw: unknown, review: ((d: TrainingDraft) => Promise<Issue[]>) | null): Promise<{ draft: TrainingDraft | null; steps: VerifyStep[]; verdict: Verification["verdict"] }> {
  const schema = schemaCheck(raw);
  const steps: VerifyStep[] = [{ id: "schema", status: schema.issues.length ? "fail" : "pass", issues: schema.issues }];
  const draft = schema.draft;
  if (!draft || schema.issues.length) {
    steps.push({ id: "safety", status: draft ? "fail" : "skipped", issues: draft ? safetyIssues(draft) : [], note: draft ? undefined : "blocked" });
    if (steps[1].status === "fail" && !steps[1].issues.length) steps[1].status = "pass";
    steps.push({ id: "review", status: "skipped", issues: [], note: review ? "blocked" : "offline" });
    return { draft, steps, verdict: "needs_review" };
  }
  const safety = safetyIssues(draft);
  steps.push({ id: "safety", status: safety.length ? "fail" : "pass", issues: safety });
  if (!review) {
    steps.push({ id: "review", status: "skipped", issues: [], note: "offline" });
  } else if (safety.length) {
    steps.push({ id: "review", status: "skipped", issues: [], note: "blocked" });
  } else {
    try {
      const found = (await review(draft)).slice(0, 20);
      steps.push({ id: "review", status: found.some((i) => i.severity === "blocking") ? "fail" : "pass", issues: found });
    } catch {
      steps.push({ id: "review", status: "skipped", issues: [], note: "unavailable" });
    }
  }
  const verdict = steps.every((s) => s.status === "pass") ? "verified" : "needs_review";
  return { draft, steps, verdict };
}

/**
 * Generates a training, verifies it, and when schema/safety fail or the reviewer reports blocking
 * issues, regenerates once with those issues as feedback. Returns the last attempt's result.
 */
export async function generateVerified(model: TrainingModel, req: TrainingRequest): Promise<{ draft: TrainingDraft | null; verification: Verification }> {
  let feedback: string[] | undefined;
  let last: { draft: TrainingDraft | null; verification: Verification } = { draft: null, verification: { verdict: "needs_review", steps: [], attempts: 0 } };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await model.generate(req, feedback);
    const r = await verifyDraft(raw, (d) => model.review(req, d));
    last = { draft: r.draft, verification: { verdict: r.verdict, steps: r.steps, attempts: attempt } };
    const blocking = r.steps.flatMap((s) => s.issues.filter((i) => i.severity === "blocking"));
    if (r.verdict === "verified" || (!blocking.length && r.draft)) break;
    feedback = blocking.length ? blocking.map((i) => (i.where ? `${i.where}: ${i.message}` : i.message)) : ["The output was not a training object in the required format."];
  }
  return last;
}

/* ───────── library fallback ───────── */

export type LibraryModule = { id: string; slug: string; category: string; title: Record<string, string>; subtitle: Record<string, string> };

/**
 * Lower case without marks, for matching: "İ".toLowerCase() is "i" plus a combining dot (which split
 * "İnternet" into "i" + "nternet"), and Azerbaijani ı, Russian ё and letters with diacritics compare
 * as their plain forms, so a prompt typed as "internet" or "iki" finds "İnternet" / "İki".
 */
function fold(s: string): string {
  return s.toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "");
}

// Words shorter than three letters are dropped anyway (see words()).
const STOP = new Set(
  [
    "the and for with how what that this from into about your their them they you our are was were will can should training lesson lessons staff employees employee people course module teach teaches learn about",
    "və ilə üçün necə nədir bu bir olan olaraq təlim dərs işçilər işçilərə əməkdaşlar haqqında öyrət öyrətmək",
    "и в во на для как что это о об про с со по сотрудники сотрудников обучение урок курс научить",
    "ile için nasıl nedir olan olarak eğitim eğitimi ders dersi çalışan çalışanlar çalışanlara personel hakkında öğret öğretin öğretmek kurs modül",
    "pentru cum despre care este sunt acest această angajați angajaților angajatilor personal instruire curs lecție lecții modul învățați predați",
    "როგორ არის ერთი შესახებ თანამშრომლები თანამშრომლებს თანამშრომლებისთვის ტრენინგი გაკვეთილი კურსი მოდული ასწავლეთ სწავლება",
    "для про щодо цей ця це які який працівники працівників працівникам персонал навчання урок курс модуль навчити",
    "und für mit wie was das die der den dem des ein eine einen über zum zur sind ist mitarbeitende mitarbeitenden mitarbeiter beschäftigte schulung lektion kurs modul lernen beibringen",
    "les des pour avec comment quoi que qui est une sur aux dans leur leurs nos vos employés salariés personnel formation leçon cours module apprendre enseigner",
    "إلى كيف هذا هذه التي الذي حول الموظفين الموظفون للموظفين تدريب التدريب درس دورة وحدة تعليم",
  ]
    .join(" ")
    .split(" ")
    .map(fold),
);

function words(s: string): string[] {
  return (fold(s).match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3 && !STOP.has(w));
}

/** Words match on a shared stem (first five letters), so "passwords" finds "password" and "parol" finds "parolu". */
function stem(w: string): string {
  return w.slice(0, 5);
}

/**
 * Picks the library module whose title and subtitle (in the chosen language, English as well)
 * share the most words with the prompt; a category match adds a little. Null when nothing matches.
 */
export function matchLibrary(prompt: string, modules: LibraryModule[], locale: string, category?: string): LibraryModule | null {
  const want = new Set(words(prompt).map(stem));
  if (!want.size && !category) return null;
  let best: { m: LibraryModule; score: number } | null = null;
  for (const m of modules) {
    const title = new Set(words(`${m.title[locale] ?? ""} ${m.title.en ?? ""}`).map(stem));
    const sub = new Set(words(`${m.subtitle[locale] ?? ""} ${m.subtitle.en ?? ""} ${m.slug.replace(/-/g, " ")}`).map(stem));
    let score = 0;
    for (const w of want) score += title.has(w) ? 3 : sub.has(w) ? 1 : 0;
    if (category && m.category === category) score += score > 0 ? 1 : 0.5;
    if (score > 0 && (!best || score > best.score)) best = { m, score };
  }
  return best?.m ?? null;
}
