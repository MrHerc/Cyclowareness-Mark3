import { describe, expect, it } from "vitest";
import { pickVoice, voiceAvailability } from "@/components/player/narrator";

const v = (name: string, lang: string, localService = false) => ({ name, lang, localService });

// Voice lists as browsers report them (only `lang` matters for the decision).
const chromeWindows = [{ lang: "en-US" }, { lang: "en-GB" }, { lang: "ru-RU" }, { lang: "de-DE" }];
const edge = [{ lang: "az-AZ" }, { lang: "en-US" }, { lang: "ru-RU" }];
const android = [{ lang: "az_AZ" }, { lang: "en_US" }];

describe("voiceAvailability", () => {
  it("is unknown while the browser has listed no voices yet", () => {
    expect(voiceAvailability([], "az")).toBe("unknown");
    expect(voiceAvailability([], "en")).toBe("unknown");
  });

  it("is missing when no installed voice speaks the language, so the text is never read in another language", () => {
    expect(voiceAvailability(chromeWindows, "az")).toBe("missing");
    expect(voiceAvailability([{ lang: "tr-TR" }], "az")).toBe("missing");
  });

  it("is available for a voice of the language in any regional form, spelling or case", () => {
    expect(voiceAvailability(chromeWindows, "ru")).toBe("available");
    expect(voiceAvailability(chromeWindows, "en")).toBe("available");
    expect(voiceAvailability(edge, "az")).toBe("available");
    expect(voiceAvailability(android, "az")).toBe("available");
    expect(voiceAvailability([{ lang: "AZ-az" }], "az")).toBe("available");
    expect(voiceAvailability(edge, "az-AZ")).toBe("available");
  });
});

describe("pickVoice", () => {
  it("never reads with another language's voice", () => {
    expect(pickVoice([v("Microsoft David - English (United States)", "en-US", true)], "az", "tutor").v).toBeNull();
  });

  it("does not take German or Romanian for a man's voice (whole names only)", () => {
    for (const [lang, woman, man] of [
      ["de", "Microsoft Katja Online (Natural) - German (Germany)", "Microsoft Conrad Online (Natural) - German (Germany)"],
      ["ro", "Microsoft Alina Online (Natural) - Romanian (Romania)", "Microsoft Emil Online (Natural) - Romanian (Romania)"],
    ] as const) {
      const voices = [v(woman, `${lang}-XX`), v(man, `${lang}-XX`)];
      expect(pickVoice(voices, lang, "man").v?.name, lang).toBe(man);
      expect(pickVoice(voices, lang, "woman").v?.name, lang).toBe(woman);
      expect(pickVoice(voices, lang, "tutor").v?.name, lang).toBe(woman);
    }
  });

  it("knows Edge's natural voices of every library language, multilingual ones included", () => {
    const pairs: [string, string, string][] = [
      ["az-AZ", "Banu", "Babek"],
      ["ka-GE", "Eka", "Giorgi"],
      ["ar-SA", "Zariyah", "Hamed"],
      ["tr-TR", "Emel", "Ahmet"],
      ["uk-UA", "Polina", "Ostap"],
      ["ru-RU", "Svetlana", "Dmitry"],
      ["de-DE", "SeraphinaMultilingual", "FlorianMultilingual"],
      ["fr-FR", "VivienneMultilingual", "RemyMultilingual"],
      ["fr-FR", "Denise", "Henri"],
      ["en-US", "AvaMultilingual", "Andrew"],
      ["en-US", "Jenny", "Guy"],
    ];
    for (const [lang, woman, man] of pairs) {
      // The man is listed first, so a pick by list order alone would get the woman wrong.
      const voices = [v(`Microsoft ${man} Online (Natural) - X`, lang), v(`Microsoft ${woman} Online (Natural) - X`, lang)];
      expect(pickVoice(voices, lang.slice(0, 2), "tutor").v?.name, woman).toContain(woman);
      expect(pickVoice(voices, lang.slice(0, 2), "man").v?.name, man).toContain(man);
    }
  });

  it("prefers natural and online voices, then Saudi Arabic for Arabic", () => {
    const local = v("Microsoft Irina - Russian (Russia)", "ru-RU", true);
    const natural = v("Microsoft Svetlana Online (Natural) - Russian (Russia)", "ru-RU");
    expect(pickVoice([local, natural], "ru", "tutor").v).toBe(natural);
    const egypt = v("Microsoft Salma Online (Natural) - Arabic (Egypt)", "ar-EG");
    const saudi = v("Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)", "ar-SA");
    expect(pickVoice([egypt, saudi], "ar", "tutor").v).toBe(saudi);
    expect(pickVoice([egypt, v("Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)", "ar-SA")], "ar", "child").v?.lang).toBe("ar-SA");
  });

  it("shapes age with pitch and rate", () => {
    const voices = [v("Microsoft Banu Online (Natural) - Azerbaijani (Latin, Azerbaijan)", "az-AZ")];
    expect(pickVoice(voices, "az", "child").pitch).toBeGreaterThan(1);
    expect(pickVoice(voices, "az", "older-man")).toMatchObject({ pitch: 0.82, rateMul: 0.92 });
  });
});
