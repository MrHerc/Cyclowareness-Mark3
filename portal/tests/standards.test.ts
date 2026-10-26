import { describe, expect, it } from "vitest";
import { localizeStandard } from "../src/lib/standards";

describe("localizeStandard", () => {
  it("localises only the article word", () => {
    expect(localizeStandard("NIS2 Art. 21(2)(g)", "az")).toBe("NIS2 maddə 21(2)(g)");
    expect(localizeStandard("NIS2 Art. 20", "ru")).toBe("NIS2 ст. 20");
    expect(localizeStandard("NIS2 Art. 20", "en")).toBe("NIS2 Art. 20");
  });

  it("leaves references without an article unchanged", () => {
    expect(localizeStandard("ISO/IEC 27001:2022 A.8.2", "az")).toBe("ISO/IEC 27001:2022 A.8.2");
    expect(localizeStandard("CIS Control 14.9", "ru")).toBe("CIS Control 14.9");
  });
});
