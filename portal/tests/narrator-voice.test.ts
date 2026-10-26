import { describe, expect, it } from "vitest";
import { voiceAvailability } from "@/components/player/narrator";

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
