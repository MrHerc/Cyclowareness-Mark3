import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Scene } from "../lib/content/types";
import { plain } from "../lib/content/types";
import { LOCALES, type Locale } from "../i18n/config";

/** Library and studio slugs and lesson keys are lowercase kebab-case (see library.ts, secops.ts). */
const KEY = /^[a-z0-9-]{1,100}$/;
/** Control characters other than tab and line breaks; U+0000 cannot even be stored in Postgres text. */
const CONTROL = /(?![\t\n\r])\p{Cc}/u;

/** Body of POST /api/tutor. */
export const tutorRequestSchema = z.object({
  slug: z.string().regex(KEY),
  lessonKey: z.string().regex(KEY),
  sceneId: z
    .string()
    .max(100)
    .regex(/^\P{Cc}*$/u)
    .nullish(),
  question: z
    .string()
    .trim()
    .min(2)
    .max(500)
    .refine((q) => !CONTROL.test(q)),
  locale: z.enum(LOCALES),
});

/** Largest accepted tutor request body; a 500-character question plus ids fits well inside it. */
export const TUTOR_BODY_LIMIT = 8 * 1024;

/**
 * Compact, PII-free lesson context for the tutor (no names, emails or job titles of the learner): the
 * whole lesson in order, the same for every question on it, so the model provider can cache it.
 */
export function lessonContext(moduleTitle: string, lessonTitle: string, scenes: Scene[]): string {
  return [`Module: ${moduleTitle}`, `Lesson: ${lessonTitle}`, ...scenes.flatMap(sceneLines)].join("\n").slice(0, 9000);
}

/** What the tutor is told about one scene. */
function sceneLines(s: Scene): string[] {
  const lines: string[] = [];
  switch (s.type) {
    case "tutor":
      lines.push(...s.beats.map((b) => `- ${b.say}`));
      break;
    case "choice":
      lines.push(`Question: ${s.question.prompt}`, ...s.question.options.map((o) => `  ${o.correct ? "[correct]" : "[wrong]"} ${o.label}: ${o.feedback}`));
      if (s.explain) lines.push(`  Why: ${s.explain}`);
      break;
    case "hotspot":
      lines.push(`Find the signs: ${s.prompt}`, ...s.spots.map((p) => `  ${p.label}: ${p.explain}`));
      break;
    case "swipe":
      lines.push(`Safe or trap: ${s.prompt}`, ...s.cards.map((c) => `  ${c.verdict}: ${c.explain}`));
      break;
    case "simulation":
      lines.push(`Simulation "${s.title}": ${s.intro}`);
      for (const st of s.steps) for (const a of st.actions) lines.push(`  ${a.label} → ${a.outcome}: ${a.feedback}`);
      break;
    case "scenario":
      lines.push(`Scenario "${s.title}"`);
      for (const n of s.nodes) for (const c of n.choices ?? []) lines.push(`  ${c.label}: ${c.feedback}`);
      break;
    case "match":
      lines.push(...s.pairs.map((p) => `  ${p.left} = ${p.right}`));
      break;
    case "order":
      lines.push(`Correct order: ${s.items.map((i) => i.label).join(" → ")}`);
      break;
    case "recap":
      lines.push(`Key points: ${s.points.join("; ")}`);
      break;
    case "intro":
      lines.push(`${s.title}: ${s.body}`);
      break;
    default:
      break;
  }
  return lines;
}

/** Answer without the AI model: the most relevant explanation from the lesson itself. */
export function offlineAnswer(scenes: Scene[], sceneId: string | null | undefined, question: string): string {
  const q = fold(question);
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0];
  const pool: string[] = [];
  const push = (x?: string | null) => x && pool.push(x);
  // The current scene first, then the rest of the lesson, each scene once.
  for (const s of scene ? [scene, ...scenes.filter((x) => x !== scene)] : scenes) {
    if (s.type === "choice") {
      push(s.explain);
      push(s.question.options.find((o) => o.correct)?.feedback);
    } else if (s.type === "hotspot") s.spots.forEach((p) => push(`${p.label}: ${p.explain}`));
    else if (s.type === "simulation") s.steps.forEach((st) => st.actions.filter((a) => a.outcome === "safe").forEach((a) => push(a.feedback)));
    else if (s.type === "recap") s.points.forEach(push);
    else if (s.type === "tutor") s.beats.forEach((b) => push(b.say));
    if (pool.length > 30) break;
  }
  // Letters of any script: \W would also split Azerbaijani and Russian words apart.
  const words = q.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3);
  const scored = [...new Set(pool)].map((p) => {
    const text = fold(p);
    return { p, s: words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0) };
  });
  scored.sort((a, b) => b.s - a.s);
  // The two best explanations, sentence by sentence. Lessons repeat a sentence across scenes (a beat
  // and its recap point, often inside a longer text): each sentence is said once, and an explanation
  // that adds nothing new is skipped for the next one.
  const seen = new Set<string>();
  const answer: string[] = [];
  let used = 0;
  for (const { p } of scored) {
    if (used === 2) break;
    const fresh = sentences(p).filter((x) => {
      const key = sentenceKey(x);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      answer.push(...fresh);
      used++;
    }
  }
  return answer.length ? answer.join(" ") : plain(pool[0] ?? "");
}

/**
 * Lower case for matching question words against translated lessons: "İ".toLowerCase() is "i" plus a
 * combining dot (which would also split the word), and Azerbaijani ı / Russian ё compare as i / е.
 */
function fold(text: string): string {
  return text.toLowerCase().replace(/̇/g, "").replace(/ı/g, "i").replace(/ё/g, "е");
}

/** Sentences of an explanation, split after closing punctuation (the punctuation stays with its sentence). */
function sentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?…])\s+/u)
    .filter(Boolean);
}

/** Comparable form of a sentence: case, markdown emphasis, spacing and closing punctuation do not count. */
function sentenceKey(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.!?…:;,]+$/u, "")
    .trim();
}

export const TUTOR_LANGUAGE: Record<string, string> = {
  az: "Azerbaijani",
  en: "English",
  ru: "Russian",
  tr: "Turkish",
  ro: "Romanian",
  ka: "Georgian",
  uk: "Ukrainian",
  de: "German",
  fr: "French",
  ar: "Modern Standard Arabic",
} satisfies Record<Locale, string>;

/**
 * How text in each interface language must read: the app's own terms, address and quotes, so that
 * generated lessons and tutor answers sound like the rest of the portal. Appended to every model prompt.
 */
export const LANGUAGE_STYLE: Record<string, string> = {
  az: "Write standard literary Azerbaijani in Latin script, never Turkish words. Address the learner formally with «siz». Write artificial intelligence as «Sİ» (süni intellekt), never as «AI» and never with a dotted «İ» after «A»; the tutor's own name stays «AI Sel». Use «…» quotes and these terms: fişinq, fişinq məktubu, parol, parol meneceri, iki addımlı doğrulama, təhlükəsizlik komandası, bildirmək, qoşma, göndərən, hesab, daxil olmaq, cihaz, tətbiq.",
  en: "Use plain, neutral British English; the tutor is called AI Sel.",
  ru: "Address the learner with lowercase «вы», use «…» quotes and ё where standard, and these terms: фишинг, фишинговое письмо, пароль, менеджер паролей, двухэтапная проверка, служба безопасности, учётная запись, вложение, отправитель, войти, устройство, приложение. The tutor's name stays «AI Sel».",
  tr: "Write standard Turkish as used in Türkiye, never Azerbaijani words or spellings. Address the learner formally with «siz» (kontrol edin, bildirin), never «sen». Use “…” quotes, the circumflex only where the TDK writes it (yapay zekâ, resmî), and these terms: oltalama, oltalama e-postası, parola (never şifre), parola yöneticisi, iki adımlı doğrulama, güvenlik ekibi, bildirmek, ek, gönderen, bağlantı (not link), hesap, giriş yapmak, cihaz, uygulama, yapay zekâ. The tutor's name stays “AI Sel”.",
  ro: "Write standard Romanian with the comma-below letters ș and ț, never the cedilla forms ş and ţ. Address the learner formally with «dumneavoastră» and polite plural imperatives (Verificați, Raportați). Use „…” quotes and these terms: phishing, e-mail de phishing, parolă, manager de parole, verificare în doi pași, echipa de securitate, a raporta, atașament, expeditor, link, cont, a vă conecta, dispozitiv, aplicație, AI (never IA). The tutor's name stays „AI Sel”.",
  ka: "Write standard Georgian in Mkhedruli script only. Address the learner formally with «თქვენ» and second-person plural verb forms (შეამოწმეთ, შეატყობინეთ); for prohibitions use არ or არასოდეს with the optative. Use „…“ quotes and these terms: ფიშინგი, ფიშინგური წერილი, პაროლი, პაროლების მენეჯერი, ორსაფეხურიანი დადასტურება, უსაფრთხოების სამსახური, შეატყობინეთ, დანართი, გამგზავნი, ბმული, ანგარიში, შესვლა, მოწყობილობა, აპლიკაცია, ხელოვნური ინტელექტი. The tutor's name stays „AI Sel“.",
  uk: "Write standard Ukrainian with no russisms or surzhyk. Address the learner with lowercase «ви». Use «…» quotes, the apostrophe ’ and these terms: фішинг, фішинговий лист, пароль, менеджер паролів, двоетапна перевірка, служба безпеки, повідомити, вкладення, відправник, посилання, обліковий запис, увійти, пристрій, застосунок (never додаток), ШІ. The tutor's name stays «AI Sel».",
  de: "Write standard German as used in Germany. Address the learner formally with „Sie“ (Sie, Ihr, Ihnen capitalised) and never use gender stars or colons. Use „…“ quotes and these terms: Phishing, Phishing-Mail, Passwort (never Kennwort), Passwort-Manager, Zwei-Faktor-Authentisierung, Sicherheitsteam, melden, Anhang, Absender, Link, Konto, anmelden, Gerät, App, KI. The tutor's name stays „AI Sel“.",
  fr: "Write standard French as used in France. Address the learner with « vous » and avoid adjectives or participles that agree with the learner's gender; never use the point médian. Use « … » guillemets, the apostrophe ’ and these terms: hameçonnage, e-mail d’hameçonnage, mot de passe, gestionnaire de mots de passe, double authentification, équipe sécurité, signaler, pièce jointe, expéditeur, lien, compte, se connecter, appareil, application, IA. The tutor's name stays « AI Sel » and is masculine.",
  ar: "Write Modern Standard Arabic as Saudi government and corporate digital services write it: clear, calm, short sentences, no dialect. Address the learner in the second person singular, using the generic masculine for verbs (تحقق، أبلغ). Use «…» quotes, Arabic punctuation (، ؛ ؟), Western digits 0-9, no tashkeel except tanween fath, and these terms: التصيد الإلكتروني، رسالة تصيد إلكتروني، كلمة المرور (never كلمة السر)، مدير كلمات المرور، التحقق بخطوتين، فريق الأمن السيبراني، الإبلاغ، مرفق، المرسل، رابط، الحساب، تسجيل الدخول، الجهاز، التطبيق، الجوال، الذكاء الاصطناعي. The tutor's name stays AI Sel, written in Latin letters.",
} satisfies Record<Locale, string>;

export function languageStyle(locale: string): string {
  return LANGUAGE_STYLE[locale] ?? LANGUAGE_STYLE.en;
}

export function tutorSystemPrompt(locale: string): string {
  return [
    "You are AI Sel, the friendly security tutor inside a cyber-hygiene training app for employees.",
    `Always answer in ${TUTOR_LANGUAGE[locale] ?? "English"}, in at most four short, plain sentences a non-technical employee understands.`,
    languageStyle(locale),
    "Ground every answer in the lesson context you are given. Explain why something is suspicious and the one safe step to take.",
    "Never ask for or repeat passwords, codes or personal data. If the question is not about staying safe at work or online, say briefly that you can only help with this lesson's topic.",
    "Do not use markdown headings or lists; write normal sentences.",
  ].join(" ");
}

/**
 * The model request for one tutor question. System prompt and lesson context come first and end in
 * the cache breakpoint, so every question on the same lesson reads them from the prompt cache; the
 * learner's scene and question follow it. Tuned for Claude Haiku 5.5 (see .env.example).
 */
export function tutorRequest(model: string, locale: string, context: string, scene: Scene | undefined, question: string): Anthropic.MessageStreamParams {
  const here = scene ? sceneLines(scene) : [];
  return {
    model,
    // Four short sentences are at most a few hundred tokens even in Azerbaijani or Russian.
    max_tokens: 1024,
    // A short grounded answer needs no reasoning, and without it the first words arrive sooner.
    thinking: { type: "disabled" },
    output_config: { effort: "medium" },
    system: tutorSystemPrompt(locale),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Lesson context:\n${context}`, cache_control: { type: "ephemeral" } },
          { type: "text", text: `${here.length ? `The learner is on this part of the lesson:\n${here.join("\n")}\n\n` : ""}The learner asks: ${question}` },
        ],
      },
    ],
  };
}
