import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyMarket, azWorldSchema, brandName, marketPackSchema, marketSource, marketTokenErrors, type MarketPack } from "@/lib/content/market";
import { localeParityErrors } from "@/lib/content/locale-parity";
import type { Brand } from "@/lib/content/types";
import { brandsFor } from "@/server/brands";
import { TEMPLATES, TEMPLATE_BY_KEY, templateText } from "@/lib/campaigns/templates";

const MARKET = path.join(__dirname, "..", "content", "market");
const LESSONS = path.join(__dirname, "..", "content", "library", "lessons");
const read = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"));
const world = azWorldSchema.parse(read(path.join(MARKET, "az-world.json")));
const packs = Object.fromEntries(
  fs
    .readdirSync(MARKET)
    .filter((f) => /^[a-z]{2}\.json$/.test(f))
    .map((f) => [f.slice(0, 2), marketPackSchema.parse(read(path.join(MARKET, f)))]),
) as Record<string, MarketPack>;
const brands = read(path.join(__dirname, "..", "content", "library", "brands.json")) as Record<string, Brand>;
const READY = ["de", "fr", "ar"];
/** A name as an address writes it in German: "Müller" → "mueller". */
const slug = (name: string) => name.toLowerCase().replace(/ü/g, "ue").replace(/ö/g, "oe").replace(/ä/g, "ae").replace(/ß/g, "ss");

/** A lesson in the shape of the library's translations: ids and answers must survive, addresses follow the cast. */
const sim = {
  type: "simulation",
  id: "sim",
  environment: "inbox",
  title: "Leyla Məmmədova schreibt",
  intro: "Leyla aus Bakı braucht 300 Manat.",
  steps: [
    {
      id: "s1",
      say: "Hier spricht Staatsanwalt T. Abbasov. Rufen Sie +994 50 000 47 12 an.",
      artifact: {
        kind: "email",
        brandRef: "ulduzbank",
        from: { name: [{ text: "UlduzBank" }], address: [{ text: "leyla.mammadova@ulduzbank.az" }] },
        subject: [{ text: "Zahlung über 40 AZN an AZ00ULDZ00000000400520007731" }],
        body: [[{ text: "Leyla Məmmədova, Kamran Əliyev <k.aliyev@idare.example>, Gəncə, Kafe_Nargiz_Free, Hesabat_sentyabr.docx" }], [{ text: "Herr Tural hat TexKomek 24 angerufen." }]],
        url: [{ text: "https://" }, { text: "ulduzbnak.example" }, { text: "/giris" }],
        link: { text: "Öffnen", href: "https://ulduzbank.az/kartlar" },
      },
      actions: [{ id: "report", label: "Melden", kind: "report", outcome: "safe", feedback: "Richtig, Leyla. Die Bank schreibt von ulduzbank.az." }],
    },
  ],
};
const choice = { type: "choice", id: "q", question: { prompt: "Wer ist Kamran?", options: [{ id: "a", label: "Leyla", correct: true, feedback: "Ja" }, { id: "b", label: "Kamran", correct: false, feedback: "Nein" }] } };
const fixture = { formatVersion: 1, id: "fixture", title: "Fixture", minutes: 3, scenes: [sim, choice] };
type Sim = typeof sim;
type Choice = typeof choice;
const de = () => applyMarket(fixture, "module/fixture", packs.de, world);
const text = (doc: unknown) => JSON.stringify(doc);

describe("market packs", () => {
  it("validates az-world.json and every pack; de, fr and ar are ready, the other languages are skeletons for reviewers", () => {
    expect(Object.keys(packs).sort()).toEqual(["ar", "de", "fr", "ka", "ro", "ru", "tr", "uk"]);
    for (const [lang, pack] of Object.entries(packs)) expect(pack.status, lang).toBe(READY.includes(lang) ? "ready" : "skeleton");
  });

  it("refuses a ready pack with an empty field", () => {
    const parsed = marketPackSchema.safeParse({ ...packs.de, people: { ...packs.de.people, male: [] }, iban: "" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toEqual(["people.male", "iban"]);
    expect(marketPackSchema.safeParse(packs.tr).success).toBe(true);
  });

  it.each(READY)("%s names an analogue for every brand and address word of the Azerbaijani world, and no pack value is a token of that world", (lang) => {
    const pack = packs[lang];
    expect(Object.keys(pack.brands).sort()).toEqual(Object.keys(world.brands).sort());
    expect(Object.keys(pack.addresses).sort()).toEqual([...world.addressWords].sort());
    for (const id of Object.keys(world.brandSlugs)) expect(pack.brands[id], id).toBeDefined();
    const values = [
      ...Object.values(pack.people).flat(),
      ...pack.cities,
      ...pack.districts,
      ...Object.values(pack.government),
      ...Object.values(pack.brands).map((b) => b.name),
      ...pack.phrases.map(([, to]) => to),
    ].flatMap((v) => v.split("|"));
    expect(marketTokenErrors({ points: values }, world)).toEqual([]);
  });
});

describe("applyMarket", () => {
  it("is deterministic and idempotent", () => {
    const once = de();
    expect(de()).toEqual(once);
    expect(applyMarket(once, "module/fixture", packs.de, world, fixture)).toEqual(once);
  });

  it("changes only learner-facing text and addresses: ids, answers and brandRefs stay, and parity holds against the mapped English", () => {
    for (const lang of READY) {
      const out = applyMarket(fixture, "module/fixture", packs[lang], world);
      expect(localeParityErrors(marketSource(fixture, "module/fixture", packs[lang], world), out), lang).toEqual([]);
    }
    // The fixture is German text, so only German leaves no token behind.
    expect(marketTokenErrors(de(), world, packs.de)).toEqual([]);
    expect(text(de())).toContain('"brandRef":"ulduzbank"');
    expect(text(de())).toContain('"correct":true');
  });

  it("keeps one name per character within a lesson, in its text and its addresses", () => {
    const [s, q] = de().scenes as [Sim, Choice];
    const leyla = s.title.replace(" schreibt", "");
    const [given, family] = leyla.split(" ");
    expect(packs.de.people.female).toContain(given);
    expect(s.intro).toMatch(new RegExp(`^${given} aus Berlin braucht 300 Euro\\.$`));
    expect(q.question.options[0].label).toBe(given);
    const step = s.steps[0];
    expect(step.artifact.from.address[0].text).toBe(`${slug(given)}.${slug(family)}@nordsparkasse.de`);
    const kamran = /, (\p{L}+) (\p{L}+) </u.exec(step.artifact.body[0][0].text)!;
    expect(step.artifact.body[0][0].text).toContain(`<${slug(kamran[1])[0]}.${slug(kamran[2])}@verwaltungsamt.example>`);
  });

  it("gives a mailbox initial the mapped given name of its owner, also beside a namesake or with the given name alone", () => {
    const mail = { formatVersion: 1, id: "mail", title: "Rauf Hüseynov und Səbinə Hüseynova", say: "Hallo Səbinə", from: { name: [{ text: "Səbinə Hüseynova" }], address: [{ text: "s.huseynova@idare.example" }] } };
    const alone = { formatVersion: 1, id: "alone", say: "Hallo Səbinə", from: { address: [{ text: "s.huseynova@idare.example" }] } };
    for (const lang of READY) {
      const out = applyMarket(mail, "module/mail", packs[lang], world);
      const [given, family] = out.from.name[0].text.split(" ").map((n) => n.split("|").at(-1)!);
      const local = out.from.address[0].text.split("@")[0];
      expect(local, lang).toMatch(new RegExp(`^${given.normalize("NFD")[0].toLowerCase()}\\.\\p{L}+$`, "u"));
      expect(local.split(".")[1][0], lang).toBe(family.normalize("NFD")[0].toLowerCase());
      expect(applyMarket(out, "module/mail", packs[lang], world, mail), lang).toEqual(out);
      const solo = applyMarket(alone, "module/alone", packs[lang], world);
      const sabina = applyMarket({ say: "Sabina" }, "module/alone", packs[lang], world, alone).say;
      expect(solo.from.address[0].text[0], lang).toBe(sabina.normalize("NFD")[0].toLowerCase());
      expect(applyMarket(solo, "module/alone", packs[lang], world, alone), lang).toEqual(solo);
    }
  });

  it("drops a stale initial and localises money, numbers, brands, file names, links and look-alikes", () => {
    const step = (de().scenes[0] as Sim).steps[0];
    expect(step.say).toMatch(/^Hier spricht Staatsanwalt \p{Lu}\p{L}+\. Rufen Sie \+49 151 000 47 12 an\.$/u);
    expect(step.artifact.from.name[0].text).toBe("Nordsparkasse");
    expect(step.artifact.subject[0].text).toBe("Zahlung über 40 € an DE00000000400520007731");
    expect(step.artifact.body[0][0].text).toMatch(/, Cafe_Lindenhof_Free, Bericht_September\.docx$/);
    expect(step.artifact.url.map((p) => p.text)).toEqual(["https://", "nordsprakasse.example", "/anmeldung"]);
    expect(step.artifact.link.href).toBe("https://nordsparkasse.de/karten");
    expect(step.actions[0].feedback).toMatch(/schreibt von nordsparkasse\.de\.$/);
  });

  it("gives a title the family name, and a brand its number only once", () => {
    const body = (de().scenes[0] as Sim).steps[0].artifact.body[1][0].text;
    expect(body).toMatch(new RegExp(`^Herr (${packs.de.people.family.join("|")}) hat TechHilfe 24 angerufen\\.$`));
    expect(applyMarket({ text: "TexKomek 24 demande" }, "x", packs.fr, world).text).toBe("TechAide 24 demande");
  });

  it("depends on the lesson: another seed may cast other names, the same seed always the same", () => {
    const title = (seed: string) => applyMarket(sim, seed, packs.de, world).title;
    const seeds = ["a/1", "b/2", "c/3", "d/4", "e/5"].map(title);
    expect(new Set(seeds).size).toBeGreaterThan(1);
    expect(title("a/1")).toBe(seeds[0]);
  });

  it("undoes a French elision, gives a Latin spelling inside an Arabic password and reads the Arabic article", () => {
    const fr = applyMarket({ say: "Le téléphone d’Aysel." }, "x", packs.fr, world);
    expect(fr.say).toMatch(/^Le téléphone de \p{Lu}/u);
    const ar = applyMarket({ text: "آيسل: كلمة المرور Aysel2027" }, "x", packs.ar, world);
    const [name, latin] = ar.text.split(": كلمة المرور ");
    expect(packs.ar.people.female).toContain(`${name}|${latin.replace("2027", "")}`);
    expect(applyMarket({ value: "ملايين المانات" }, "x", packs.ar, world).value).toBe("ملايين الريالات");
    expect(marketTokenErrors({ value: "ملايين المانات" }, world)).toEqual(['$.value: "مانات" belongs to the Azerbaijani world']);
  });
});

describe("the lesson checker's market rule", () => {
  it("reports every token of the Azerbaijani world outside addresses", () => {
    const errors = marketTokenErrors(fixture, world);
    for (const token of ["Leyla", "Məmmədova", "Bakı", "Manat", "Abbasov", "+994", "AZN", "AZ00ULDZ00000000400520007731", "UlduzBank", "Kafe_Nargiz", "Gəncə", "Hesabat"])
      expect(errors.some((e) => e.includes(`"${token}"`)), token).toBe(true);
    expect(errors.some((e) => e.includes("mammadova@"))).toBe(false);
    expect(marketTokenErrors({ text: "Schreiben Sie an leyla.mammadova@idare.example" }, world)).toEqual([]);
  });

  it("with the market's pack, also reports a renamed sender whose address keeps the old name or brand", () => {
    const errors = marketTokenErrors({ to: "Anna Fischer <leyla.hasanova@rxagentlik.az>", href: "https://ulduzbank.az/giris" }, world, packs.de);
    for (const word of ["leyla", "hasanova", "rxagentlik", "az", "ulduzbank", "giris"]) expect(errors.some((e) => e.includes(`"${word}" in`)), word).toBe(true);
    expect(marketTokenErrors({ to: "Anna Fischer <anna.fischer@rx-amt.de>", href: "https://wifi-paket.test" }, world, packs.de)).toEqual([]);
    const left = marketTokenErrors({ text: "https://free-wifi-baku.top/login", label: "IBAN AZ21 NABZ 0000 0000 1370 1000 1944", href: "https://x.example.net/viza" }, world, packs.de);
    for (const word of ['"baku" in', "AZ21 NABZ", '"viza" in']) expect(left.some((e) => e.includes(word)), word).toBe(true);
  });

  it("maps a city inside an address like the text, a grouped IBAN to a grouped one, and a URL piece cut after gov.", () => {
    expect(applyMarket({ text: "https://free-wifi-baku.top/login" }, "x", packs.de, world).text).toBe("https://free-wifi-berlin.top/login");
    expect(applyMarket({ text: "IBAN AZ21 NABZ 0000 0000 1370 1000 1944" }, "x", packs.de, world).text).toBe("IBAN DE00 0000 0013 7010 0019 44");
    expect(applyMarket({ url: [{ text: "https://vetendasportal.gov." }, { text: "az-arayis.example" }] }, "x", packs.fr, world).url.map((p) => p.text).join("")).toBe(
      "https://portail-citoyen.gouv.fr-attestation.example",
    );
  });

  it.each(READY)("passes every committed %s lesson, which a second run leaves unchanged", (lang) => {
    for (const mod of fs.readdirSync(LESSONS)) {
      for (const f of fs.readdirSync(path.join(LESSONS, mod)).filter((x) => x.endsWith(`.${lang}.json`))) {
        const doc = read(path.join(LESSONS, mod, f));
        const id = f.slice(0, -8);
        expect(marketTokenErrors(doc, world, packs[lang]), `${mod}/${f}`).toEqual([]);
        expect(applyMarket(doc, `${mod}/${id}`, packs[lang], world, read(path.join(LESSONS, mod, `${id}.en.json`))), `${mod}/${f}`).toEqual(doc);
      }
    }
  }, 60_000);

  it.each(READY)("gives every %s mailbox of a person the English names (s.huseynova@ of Səbinə) the initial of that person's name", (lang) => {
    const givenForm = new Map(["female", "male"].flatMap((k) => Object.entries(world[k as "female"]).flatMap(([key, l]) => l.map((f) => [f, key] as const))));
    const familyForm = new Map(Object.entries(world.family).flatMap(([key, l]) => l.map((f) => [f, key] as const)));
    const alt = (forms: Iterable<string>) => [...forms].sort((a, b) => b.length - a.length).join("|");
    const givenRe = new RegExp(`(?<!\\p{L})(${alt(givenForm.keys())})(?!\\p{L})`, "gu");
    const pairRe = new RegExp(`(?<!\\p{L})(${alt(givenForm.keys())})\\s+(${alt(familyForm.keys())})(?!\\p{L})`, "gu");
    const latins = (key: string) => [...(world.female[key] ?? []), ...(world.male[key] ?? [])].filter((f) => /^\p{Script=Latin}/u.test(f));
    const latin = (key: string) => latins(key)[0];
    const first = (name: string) => name.replace(/^Ə/, "E").normalize("NFD")[0].toLowerCase();
    const strings = (en: unknown, loc: unknown, out: [string, string][] = []): [string, string][] => {
      if (typeof en === "string" && typeof loc === "string") out.push([en, loc]);
      else if (en && loc && typeof en === "object" && typeof loc === "object") for (const [k, v] of Object.entries(en)) strings(v, (loc as Record<string, unknown>)[k], out);
      return out;
    };
    let checked = 0;
    for (const mod of fs.readdirSync(LESSONS)) {
      for (const f of fs.readdirSync(path.join(LESSONS, mod)).filter((x) => x.endsWith(`.${lang}.json`))) {
        const id = f.slice(0, -8);
        const en = read(path.join(LESSONS, mod, `${id}.en.json`));
        const pairs = strings(en, read(path.join(LESSONS, mod, f)));
        const named = new Set(pairs.flatMap(([s]) => [...s.replace(/\S+@\S*/g, " ").matchAll(givenRe)].map((m) => givenForm.get(m[1])!)));
        const couples = pairs.flatMap(([s]) => [...s.matchAll(pairRe)].map((m) => [givenForm.get(m[1])!, familyForm.get(m[2])!] as const));
        for (const [s, loc] of pairs) {
          const theirs = [...loc.matchAll(/([\w.+-]+)@/g)].map((m) => m[1]);
          [...s.matchAll(/([\w.+-]+)@/g)].forEach(([, local], i) => {
            const m = /^([a-z])\.([a-z]+)(?=[.\d]|$)/.exec(local);
            const family = m && [...familyForm].find(([form]) => slug(form).replace(/ə/g, "e").replace(/ı/g, "i").replace(/ş/g, "sh").replace(/ç/g, "ch") === m[2])?.[1];
            if (!m || !family) return;
            const has = (g: string) => latins(g).some((form) => first(form) === m[1]);
            const byPair = [...new Set(couples.filter(([g, fam]) => fam === family && has(g)).map(([g]) => g))];
            const byInitial = [...named].filter(has);
            const who = byPair.length ? (byPair.length === 1 ? byPair[0] : undefined) : byInitial.length === 1 ? byInitial[0] : undefined;
            if (!who) return;
            const mapped = applyMarket({ say: latin(who) }, `${mod}/${id}`, packs[lang], world, en).say;
            expect(theirs[i]?.[0], `${mod}/${f}: ${local}@ of ${who} (${mapped})`).toBe(first(mapped));
            checked++;
          });
        }
      }
    }
    expect(checked).toBeGreaterThan(25);
  }, 60_000);
});

describe("brand names per language", () => {
  it("resolves the market's name, else the registry name", () => {
    expect(brandName(brands.ulduzbank, "de")).toBe("Nordsparkasse");
    expect(brandName(brands.ulduzbank, "fr")).toBe("Banque Étoile");
    expect(brandName(brands.ulduzbank, "ar")).toBe("بنك النجمة");
    expect(brandName(brands.ulduzbank, "az")).toBe("UlduzBank");
    expect(brandName(brands.ulduzbank, "ru")).toBe("UlduzBank");
    expect(brandName(brands["ofistechizat-fake"], "de")).toBe("BüroBedarf GmbH");
  });

  it("hands the player the brand in the lesson's language, without the Azerbaijani monogram", () => {
    const scenes = [{ artifact: { brandRef: "xidmet-agentliyi" } }];
    expect(brandsFor(scenes, "de")["xidmet-agentliyi"]).toMatchObject({ name: "Bürgerdienst-Agentur", monogram: undefined, glyph: brands["xidmet-agentliyi"].glyph });
    expect(brandsFor(scenes, "az")["xidmet-agentliyi"]).toEqual(brands["xidmet-agentliyi"]);
  });

  it("shows the local brand and sender in the simulation templates", () => {
    const sms = TEMPLATE_BY_KEY.get("parcel-sms")!;
    for (const lang of READY) {
      expect(templateText(sms.sender.name, lang)).toBe(brands.suretkargo.names?.[lang]);
      expect(templateText(sms.sender.address, lang)).toBe(brands.suretkargo.names?.[lang]);
      expect(templateText(sms.body, lang)).toContain(brands.suretkargo.names?.[lang]);
      expect(templateText(sms.body, lang)).not.toContain("AZN");
    }
    expect(templateText(sms.sender.address, "az")).toBe("SuretKargo");
    expect(templateText(TEMPLATE_BY_KEY.get("invoice")!.sender.name, "de")).toBe("BüroBedarf GmbH");
    expect(templateText(TEMPLATE_BY_KEY.get("bank-sms")!.body, "fr")).toContain("Banque Étoile");
  });

  it.each(READY)("leaves no token of the Azerbaijani world in any %s simulation template", (lang) => {
    for (const tpl of TEMPLATES) {
      const values = [tpl.name, tpl.sender.name, tpl.sender.address, tpl.subject, tpl.body, tpl.cta, tpl.attachment?.name, tpl.attachment?.size, ...tpl.redFlags];
      const points = values.flatMap((v) => (v ? [templateText(v, lang)] : []));
      expect(marketTokenErrors({ points }, world, packs[lang]), tpl.key).toEqual([]);
    }
  });
});
