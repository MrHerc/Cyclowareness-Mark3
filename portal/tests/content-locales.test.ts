import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lessonFileSchema, lessonIntegrityErrors } from "../src/lib/content/validate";
import { APP_IDENTIFIERS, addressTokens, localeParityErrors } from "../src/lib/content/locale-parity";
import { pickLessonContent, sharedContentLocale } from "../src/lib/content/lesson-locale";
import { LESSON_TRANSLATIONS, readLibraryLesson } from "../src/server/services/library";

const root = path.join(__dirname, "..", "content", "library");
const modules = JSON.parse(readFileSync(path.join(root, "modules.json"), "utf8")) as { slug: string; lessons: { id: string }[] }[];
const lessonFile = (slug: string, id: string, locale: string) => path.join(root, "lessons", slug, `${id}.${locale}.json`);

// Every library lesson has an az and a ru translation; each file that exists must pass. A missing one
// fails `npx tsx scripts/check-lesson-locales.ts --coverage`, not this test.
const translations = modules
  .flatMap((m) => m.lessons.flatMap((l) => LESSON_TRANSLATIONS.map((locale) => ({ slug: m.slug, id: l.id, locale }))))
  .filter((x) => existsSync(lessonFile(x.slug, x.id, x.locale)));

describe("lesson translations on disk", () => {
  it("are named <lesson>.<en|az|ru>.json after a lesson listed in modules.json", () => {
    const stray = modules.flatMap((m) => {
      const ids = new Set(m.lessons.map((l) => l.id));
      return readdirSync(path.join(root, "lessons", m.slug))
        .filter((f) => {
          const match = /^(.+)\.(en|az|ru)\.json$/.exec(f);
          return !match || !ids.has(match[1]);
        })
        .map((f) => `${m.slug}/${f}`);
    });
    expect(stray).toEqual([]);
  });

  for (const { slug, id, locale } of translations) {
    it(`${slug}/${id}.${locale} passes the schema, integrity and parity rules`, () => {
      const raw: unknown = JSON.parse(readFileSync(lessonFile(slug, id, locale), "utf8"));
      const parsed = lessonFileSchema.safeParse(raw);
      expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
      if (parsed.success) expect(lessonIntegrityErrors(parsed.data)).toEqual([]);
      expect(localeParityErrors(JSON.parse(readFileSync(lessonFile(slug, id, "en"), "utf8")), raw)).toEqual([]);
    });
  }

  it("are all accepted by the library import, which reads exactly the translations present", () => {
    for (const m of modules) {
      for (const l of m.lessons) {
        const { translations: read } = readLibraryLesson(m.slug, l.id);
        expect(Object.keys(read).sort(), `${m.slug}/${l.id}`).toEqual(LESSON_TRANSLATIONS.filter((locale) => existsSync(lessonFile(m.slug, l.id, locale))));
      }
    }
  });
});

describe("localeParityErrors", () => {
  const notification = (app: string) => ({ kind: "notification", app, brandRef: "it-dept", time: "09:41" });
  const chat = (app: string) => ({ kind: "chat", app, contact: [{ text: "Anar" }], messages: [{ from: "them", body: "Salam" }] });
  const email = (to: string) => ({ kind: "email", to, subject: "Hi", time: "09:10" });

  it("accepts a translated app label on a notification or permission", () => {
    expect(localeParityErrors(notification("Settings"), notification("Parametrlər"))).toEqual([]);
    expect(localeParityErrors(notification("IT Security"), notification("ИТ-безопасность"))).toEqual([]);
    expect(localeParityErrors({ kind: "permission", app: "Maps" }, { kind: "permission", app: "Xəritələr" })).toEqual([]);
  });

  it("accepts a translated brand display name and keeps its brandRef", () => {
    const login = (brand: string, brandRef = "office") => ({ kind: "login", brand, brandRef, url: "https://portal.idare.example/giris" });
    expect(localeParityErrors(login("Office portal"), login("Ofis portalı"))).toEqual([]);
    expect(localeParityErrors(login("Office portal"), login("Служебный портал", "other"))).toHaveLength(1);
  });

  it("keeps every app identifier the player compares byte-identical", () => {
    for (const id of APP_IDENTIFIERS) {
      expect(localeParityErrors(chat(id), chat(id))).toEqual([]);
      expect(localeParityErrors(chat(id), chat(id.toUpperCase()))).toEqual([`$.app: must stay "${id}" (got "${id.toUpperCase()}")`]);
    }
    expect(localeParityErrors(chat("whatsapp"), chat("WhatsApp"))).toHaveLength(1);
    expect(localeParityErrors(chat("generic"), chat("ümumi"))).toHaveLength(1);
  });

  it("accepts a translated To line but keeps every address in it", () => {
    expect(localeParityErrors(email("you"), email("siz"))).toEqual([]);
    expect(localeParityErrors(email("Anar Hasanov"), email("Анар Гасанов"))).toEqual([]);
    expect(localeParityErrors(email("40 partners, all in the To field"), email("40 tərəfdaş, hamısı «Kimə» sahəsində"))).toEqual([]);
    const named = "Rəşad Əliyev <reshad.aliyev@rxagentlik-az.com>";
    expect(localeParityErrors(email(named), email("Рашад Алиев <reshad.aliyev@rxagentlik-az.com>"))).toEqual([]);
    expect(localeParityErrors(email(named), email("Рашад Алиев <рашад.алиев@rxagentlik-az.com>"))).toEqual(['$.to: address or domain "reshad.aliyev@rxagentlik-az.com" must stay unchanged']);
    const list = "layihe-qrupu@rxagentlik.az, e.rzayev@merkez-konsalting.example";
    expect(localeParityErrors(email(list), email(list))).toEqual([]);
    expect(localeParityErrors(email(list), email("layihe-qrupu@rxagentlik.az, e.rzayev@merkez-konsalting.az"))).toEqual(['$.to: address or domain "e.rzayev@merkez-konsalting.example" must stay unchanged']);
    // A whole-value address is still compared as a whole.
    expect(localeParityErrors(email("you@idare.example"), email("siz@idare.example"))).toEqual(['$.to: address or domain "you@idare.example" must stay unchanged']);
  });

  it("keeps the addresses, URLs and domains inside any translatable text", () => {
    const say = (text: string) => ({ id: "b1", say: text, mood: "talk" });
    expect(localeParityErrors(say("Open https://portal.idare.example/giris now."), say("İndi https://portal.idare.example/giris ünvanını açın."))).toEqual([]);
    expect(localeParityErrors(say("Open https://portal.idare.example/giris now."), say("İndi https://portal.idare.example ünvanını açın."))).toEqual([
      '$.say: address or domain "https://portal.idare.example/giris" must stay unchanged',
    ]);
    expect(localeParityErrors(say("Go to ispoct-mail.example.net/kvota first."), say("Сначала откройте ispoct-mail.example.net."))).toEqual([
      '$.say: address or domain "ispoct-mail.example.net/kvota" must stay unchanged',
    ]);
    // An address split across spans keeps both halves.
    const spans = (a: string, b: string) => ({ body: [{ text: a }, { text: b, spot: "domain" }] });
    expect(localeParityErrors(spans("r.mammadli@", "idare.example"), spans("r.mammadli@", "idare.example"))).toEqual([]);
    expect(localeParityErrors(spans("r.mammadli@", "idare.example"), spans("r.mammədli@", "idarə.example"))).toEqual([
      '$.body[0].text: address or domain "r.mammadli@" must stay unchanged',
      '$.body[1].text: address or domain "idare.example" must stay unchanged',
    ]);
  });

  it("lets a file name inside a sentence be localised, but not a whole-value one", () => {
    expect(addressTokens("Budget draft 2027, final.xlsx")).toEqual([]);
    expect(localeParityErrors({ name: "Budget draft 2027, final.xlsx" }, { name: "Büdcə layihəsi 2027, yekun.xlsx" })).toEqual([]);
    expect(localeParityErrors({ name: "Rekvizitler.pdf" }, { name: "Реквизиты.pdf" })).toEqual(['$.name: address or domain "Rekvizitler.pdf" must stay unchanged']);
  });

  it("still keeps every value outside a translatable key", () => {
    expect(localeParityErrors({ kind: "dialog", tone: "app" }, { kind: "dialog", tone: "tətbiq" })).toEqual(['$.tone: must stay "app" (got "tətbiq")']);
    expect(localeParityErrors(notification("Settings"), { ...notification("Parametrlər"), brandRef: "it-dept-az" })).toEqual(['$.brandRef: must stay "it-dept" (got "it-dept-az")']);
    expect(localeParityErrors(chat("telegram"), { ...chat("telegram"), messages: [{ from: "biz", body: "Salam" }] })).toEqual(['$.messages[0].from: must stay "them" (got "biz")']);
  });
});

describe("pickLessonContent", () => {
  const en = { locale: "en", scenes: "EN" };
  const az = { locale: "az", scenes: "AZ" };
  const ru = { locale: "ru", scenes: "RU" };

  it("serves the viewer's language when the lesson has it", () => {
    expect(pickLessonContent([en, az, ru], "az")).toBe(az);
    expect(pickLessonContent([ru, en, az], "ru")).toBe(ru);
    expect(pickLessonContent([az, en], "en")).toBe(en);
  });

  it("falls back to English, then to the only language a studio lesson was written in", () => {
    expect(pickLessonContent([en, az], "ru")).toBe(en);
    expect(pickLessonContent([az], "en")).toBe(az);
    expect(pickLessonContent([ru], "az")).toBe(ru);
    expect(pickLessonContent([], "az")).toBeUndefined();
  });
});

describe("sharedContentLocale", () => {
  it("keeps the chosen language only when every lesson has it, else English", () => {
    expect(sharedContentLocale([["en", "az"], ["az", "en", "ru"]], "az")).toBe("az");
    expect(sharedContentLocale([["en", "az"], ["en"]], "az")).toBe("en");
    expect(sharedContentLocale([["en"], ["en"]], "en")).toBe("en");
    expect(sharedContentLocale([], "ru")).toBe("en");
  });
});
