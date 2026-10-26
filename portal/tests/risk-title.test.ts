import { describe, expect, it } from "vitest";
import { encodeRiskTitle, riskTitle, riskTitles } from "../src/lib/risk-title";

describe("risk titles", () => {
  const stored = encodeRiskTitle({ az: "Qısa təkrar dərs", en: "Short refresher", ru: "Короткое повторение" });

  it("shows a stored title in the reader's language", () => {
    expect(riskTitle(stored, "az")).toBe("Qısa təkrar dərs");
    expect(riskTitle(stored, "en")).toBe("Short refresher");
    expect(riskTitle(stored, "ru")).toBe("Короткое повторение");
    expect(riskTitle(stored, "de")).toBe("Short refresher");
  });

  it("keeps older single-language rows as they are", () => {
    expect(riskTitles("IR-34: Açıq mətnli parol")).toBeNull();
    expect(riskTitle("IR-34: Açıq mətnli parol", "en")).toBe("IR-34: Açıq mətnli parol");
    expect(riskTitle("{not json", "en")).toBe("{not json");
  });

  it("caps each language at 300 characters", () => {
    const long = riskTitles(encodeRiskTitle({ en: "x".repeat(400) }));
    expect(long?.en).toHaveLength(300);
  });
});
