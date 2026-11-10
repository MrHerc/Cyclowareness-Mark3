import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyMarket, azWorldSchema, brandName, marketPackSchema, marketTokenErrors, type MarketPack } from "@/lib/content/market";
import { localeParityErrors } from "@/lib/content/locale-parity";
import type { Brand } from "@/lib/content/types";
import { brandsFor } from "@/server/brands";
import { TEMPLATE_BY_KEY, templateText } from "@/lib/campaigns/templates";

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

/** A lesson in the shape of the library's translations: ids, answers and addresses must survive. */
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
        body: [[{ text: "Leyla Məmmədova, Kamran Əliyev <k.aliyev@idare.example>, Gəncə, Kafe_Nargiz_Free" }]],
      },
      actions: [{ id: "report", label: "Melden", kind: "report", outcome: "safe", feedback: "Richtig, Leyla." }],
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

  it.each(READY)("%s names an analogue for every brand of the Azerbaijani world, and no pack value is a token of that world", (lang) => {
    const pack = packs[lang];
    expect(Object.keys(pack.brands).sort()).toEqual(Object.keys(world.brands).sort());
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
    expect(applyMarket(once, "module/fixture", packs.de, world)).toEqual(once);
  });

  it("changes only learner-facing text: ids, answers, brandRefs and addresses stay", () => {
    for (const lang of READY) expect(localeParityErrors(fixture, applyMarket(fixture, "module/fixture", packs[lang], world)), lang).toEqual([]);
    expect(marketTokenErrors(de(), world)).toEqual([]);
    const out = text(de());
    expect(out).toContain("leyla.mammadova@ulduzbank.az");
    expect(out).toContain("k.aliyev@idare.example");
    expect(out).toContain('"brandRef":"ulduzbank"');
  });

  it("keeps one name per character within a lesson, drops a stale initial and localises money, numbers and brands", () => {
    const [s, q] = de().scenes as [Sim, Choice];
    const leyla = s.title.replace(" schreibt", "");
    const [given] = leyla.split(" ");
    expect(packs.de.people.female).toContain(given);
    expect(s.intro).toMatch(new RegExp(`^${given} aus (${packs.de.cities.join("|")}) braucht 300 Euro\\.$`));
    expect(q.question.options[0].label).toBe(given);
    const step = s.steps[0];
    expect(step.say).toMatch(/^Hier spricht Staatsanwalt \p{Lu}\p{L}+\. Rufen Sie \+49 151 000 47 12 an\.$/u);
    expect(step.artifact.from.name[0].text).toBe("Nordsparkasse");
    expect(step.artifact.subject[0].text).toBe("Zahlung über 40 € an DE00000000400520007731");
    expect(step.artifact.body[0][0].text).toMatch(new RegExp(`^${leyla}, `));
    expect(step.artifact.body[0][0].text).toContain("Cafe_Lindenhof_Free");
  });

  it("depends on the lesson: another seed may cast other names, the same seed always the same", () => {
    const title = (seed: string) => applyMarket(sim, seed, packs.de, world).title;
    const seeds = ["a/1", "b/2", "c/3", "d/4", "e/5"].map(title);
    expect(new Set(seeds).size).toBeGreaterThan(1);
    expect(title("a/1")).toBe(seeds[0]);
  });

  it("undoes a French elision and gives a Latin spelling inside an Arabic password", () => {
    const fr = applyMarket({ say: "Le téléphone d’Aysel." }, "x", packs.fr, world);
    expect(fr.say).toMatch(/^Le téléphone de \p{Lu}/u);
    const ar = applyMarket({ text: "آيسل: كلمة المرور Aysel2027" }, "x", packs.ar, world);
    const [name, latin] = ar.text.split(": كلمة المرور ");
    expect(packs.ar.people.female).toContain(`${name}|${latin.replace("2027", "")}`);
  });
});

describe("the lesson checker's market rule", () => {
  it("reports every token of the Azerbaijani world outside addresses", () => {
    const errors = marketTokenErrors(fixture, world);
    for (const token of ["Leyla", "Məmmədova", "Bakı", "Manat", "Abbasov", "+994", "AZN", "AZ00ULDZ00000000400520007731", "UlduzBank", "Kafe_Nargiz", "Gəncə"])
      expect(errors.some((e) => e.includes(`"${token}"`)), token).toBe(true);
    expect(errors.some((e) => e.includes("mammadova@"))).toBe(false);
    expect(marketTokenErrors({ text: "Schreiben Sie an leyla.mammadova@idare.example" }, world)).toEqual([]);
  });

  it.each(READY)("passes every committed %s lesson, which a second run leaves unchanged", (lang) => {
    for (const mod of fs.readdirSync(LESSONS)) {
      for (const f of fs.readdirSync(path.join(LESSONS, mod)).filter((x) => x.endsWith(`.${lang}.json`))) {
        const doc = read(path.join(LESSONS, mod, f));
        expect(marketTokenErrors(doc, world), `${mod}/${f}`).toEqual([]);
        expect(applyMarket(doc, `${mod}/${f.slice(0, -8)}`, packs[lang], world), `${mod}/${f}`).toEqual(doc);
      }
    }
  });
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

  it("shows the local brand in the simulation templates", () => {
    const sms = TEMPLATE_BY_KEY.get("parcel-sms")!;
    for (const lang of READY) {
      expect(templateText(sms.sender.name, lang)).toBe(brands.suretkargo.names?.[lang]);
      expect(templateText(sms.body, lang)).toContain(brands.suretkargo.names?.[lang]);
      expect(templateText(sms.body, lang)).not.toContain("AZN");
    }
    expect(templateText(sms.sender.name, "az")).toBe("SuretKargo");
    expect(templateText(TEMPLATE_BY_KEY.get("invoice")!.sender.name, "de")).toBe("BüroBedarf GmbH");
    expect(templateText(TEMPLATE_BY_KEY.get("bank-sms")!.body, "fr")).toContain("Banque Étoile");
  });
});
