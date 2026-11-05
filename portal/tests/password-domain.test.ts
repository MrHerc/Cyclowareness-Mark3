import { beforeEach, describe, expect, it, vi } from "vitest";

const txt = new Map<string, string[][] | Error>();
const resolverOptions: unknown[] = [];
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    constructor(options: unknown) {
      resolverOptions.push(options);
    }
    async resolveTxt(name: string) {
      const v = txt.get(name);
      if (!v) throw Object.assign(new Error("queryTxt ENODATA"), { code: "ENODATA" });
      if (v instanceof Error) throw v;
      return v;
    }
  },
}));

const { DOMAIN_PROOF_PREFIX, domainProofFound, domainProofRecord, normaliseHost } = await import("@/server/auth/domain-proof");
const { PASSWORD_MIN_LENGTH, hashPassword, passwordProblem, verifyPassword } = await import("@/server/auth/password");
const { checkPassword, passphraseRules, personalWords } = await import("@/lib/password-strength");

describe("password hashing", () => {
  it("stores Argon2id and verifies only the same password", async () => {
    const stored = await hashPassword("Correct-Horse-Battery-9");
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(stored, "Correct-Horse-Battery-9")).toBe(true);
    expect(await verifyPassword(stored, "correct-horse-battery-9")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("Same-Password-123")).not.toBe(await hashPassword("Same-Password-123"));
  });

  it("refuses a missing or malformed hash instead of throwing", async () => {
    expect(await verifyPassword(null, "anything")).toBe(false);
    expect(await verifyPassword("", "anything")).toBe(false);
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("needs the minimum length and refuses absurdly long input", () => {
    expect(passwordProblem("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe("short");
    expect(passwordProblem(`Zq8!${"x".repeat(253)}`)).toBe("long");
  });

  it("refuses guessable passwords, including ones built from the person's own details", () => {
    expect(passwordProblem("password123")).toBe("weak");
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("weak");
    expect(passwordProblem("aysel.mammadova", ["Aysel Mammadova", "aysel.mammadova@example.com"])).toBe("weak");
  });

  it("accepts a strong passphrase", () => {
    expect(passwordProblem("Violet-Kettle-Orbit-42")).toBeNull();
  });
});

describe("personalWords", () => {
  it("splits names and email addresses into the words they give away", () => {
    expect(personalWords(["Aysel.Mammadova@SafarovIndustries.com", " Aysel Mammadova "]).sort()).toEqual(
      ["aysel", "aysel mammadova", "aysel.mammadova", "aysel.mammadova@safarovindustries.com", "mammadova", "safarovindustries"].sort(),
    );
  });

  it("keeps words in every script and skips blanks and very short pieces", () => {
    expect(personalWords(["Əli Həsənov", "", "  ", "Jo Li"])).toEqual(["əli həsənov", "əli", "həsənov", "jo li"]);
  });

  it("lowers the score of a password made from the person's own name", () => {
    const inputs = ["aysel.mammadova@safarovindustries.com", "Aysel Mammadova"];
    expect(checkPassword("AyselMammadova", inputs).score).toBeLessThan(checkPassword("AyselMammadova").score);
    expect(checkPassword("Violet-Kettle-Orbit-42", inputs).score).toBe(4);
  });

  it("makes the Password Forge lab refuse a passphrase built from the learner's details", () => {
    const ctx = { orgName: "Safarov Industries", orgSlug: "safarov", userName: "Aysel Mammadova", email: "aysel.mammadova@safarovindustries.com" };
    expect(passphraseRules("aysel mammadova industries", ctx).strong).toBe(false);
    expect(passphraseRules("violet kettle orbit lantern", ctx).strong).toBe(true);
  });
});

describe("normaliseHost", () => {
  it("lower-cases, trims and drops a trailing dot", () => {
    expect(normaliseHost("  Agency.GOV.az. ")).toBe("agency.gov.az");
    expect(normaliseHost("safarovindustries.com")).toBe("safarovindustries.com");
  });

  it("refuses anything that is not a plain domain", () => {
    for (const bad of ["", "localhost", "https://example.com", "example.com/path", "user@example.com", "exa mple.com", "-bad.com", "bad-.com", "1.2.3.4", "example..com", `${"a".repeat(64)}.com`, "*.example.com"]) {
      expect(normaliseHost(bad), bad).toBeNull();
    }
  });

  it("accepts the internationalised country domains of the markets the product is sold in", () => {
    // .рф (Russia), .укр (Ukraine), .გე (Georgia), .السعودية (Saudi Arabia), as typed and in their ASCII form.
    expect(normaliseHost("example.xn--p1ai")).toBe("example.xn--p1ai");
    expect(normaliseHost("пример.рф")).toBe("xn--e1afmkfd.xn--p1ai");
    expect(normaliseHost("приклад.укр")).toBe("xn--80aikifvh.xn--j1amh");
    expect(normaliseHost("example.გე")).toBe("example.xn--node");
    expect(normaliseHost("example.السعودية")).toBe("example.xn--mgberp4a5d4ar");
  });
});

describe("domain proof", () => {
  beforeEach(() => {
    txt.clear();
    resolverOptions.length = 0;
  });

  it("derives a record only the tenant's secret can produce", () => {
    const a = domainProofRecord("tenant-a", "s".repeat(32));
    expect(a).toMatch(new RegExp(`^${DOMAIN_PROOF_PREFIX}[0-9a-f]{24}$`));
    expect(domainProofRecord("tenant-a", "s".repeat(32))).toBe(a);
    expect(domainProofRecord("tenant-b", "s".repeat(32))).not.toBe(a);
    expect(domainProofRecord("tenant-a", "t".repeat(32))).not.toBe(a);
  });

  it("finds the record on the domain or on _cyclowareness.<domain>, also split into chunks", async () => {
    const expected = domainProofRecord("tenant-a", "s".repeat(32));
    txt.set("agency.gov.az", [["v=spf1 -all"], [expected.slice(0, 10), expected.slice(10)]]);
    expect(await domainProofFound("agency.gov.az", expected)).toBe(true);
    txt.clear();
    txt.set("_cyclowareness.agency.gov.az", [[` ${expected} `]]);
    expect(await domainProofFound("agency.gov.az", expected)).toBe(true);
    expect(resolverOptions.at(-1)).toEqual({ timeout: 5_000, tries: 1 });
  });

  it("counts a different value, a missing record and DNS errors as not found", async () => {
    const expected = domainProofRecord("tenant-a", "s".repeat(32));
    txt.set("agency.gov.az", [[domainProofRecord("tenant-b", "s".repeat(32))]]);
    expect(await domainProofFound("agency.gov.az", expected)).toBe(false);
    txt.set("agency.gov.az", Object.assign(new Error("queryTxt ETIMEOUT"), { code: "ETIMEOUT" }));
    expect(await domainProofFound("agency.gov.az", expected)).toBe(false);
    expect(await domainProofFound("nothing.az", expected)).toBe(false);
  });
});
