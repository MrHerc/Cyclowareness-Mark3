import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ASSIGNABLE_ROLES, PERMISSIONS, PERMISSION_FEATURE, PRIVILEGED_ROLES, can, isConsoleRole, isPrivileged, twoFactorRequired, type Permission } from "@/server/auth/permissions";
import { decideSignInStep, emailDomain, ssoStartUrl, type SsoPerson, type SsoTenant } from "@/server/auth/sso-routing";
import { ROLES, type Role } from "@/server/db/schema";
import { DEFAULT_ATTESTATION, PLAN_FEATURES, defaultSettings, featuresFor, type Feature } from "@/lib/tenant-defaults";
import { checkPassword } from "@/lib/password-strength";
import { defang } from "@/lib/defang";
import { brandStyle, isHexColor, readableOn } from "@/lib/color";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, SITE_LOCALES, isLocale, isSiteLocale, negotiate, pick } from "@/i18n/config";

// crypto.ts derives its keys from APP_SECRET; the env schema wants 32+ characters. Stubbed before the
// module is loaded so a future switch to reading env.ts at import time keeps working. Test value only.
const TEST_SECRET = "test-only-app-secret-0123456789-abcdefghij-0123456789";
vi.stubEnv("APP_SECRET", TEST_SECRET);
const { encryptSecret, decryptSecret, hmac, signValue, unsignValue, sha256Hex } = await import("@/server/crypto");

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
const ALL_FEATURES: readonly Feature[] = [...PLAN_FEATURES.essentials, ...PLAN_FEATURES.professional, ...PLAN_FEATURES.enterprise_hrm];
const rolesOf = (p: Permission): readonly Role[] => PERMISSIONS[p];

describe("permissions", () => {
  it("lists only roles that exist in the schema, without duplicates", () => {
    for (const p of ALL_PERMISSIONS) {
      const roles = rolesOf(p);
      expect(roles.length, p).toBeGreaterThan(0);
      expect(new Set(roles).size, `${p} has duplicates`).toBe(roles.length);
      for (const r of roles) expect(ROLES, `${p} -> ${r}`).toContain(r);
    }
  });

  it("gives super_admin every permission", () => {
    for (const p of ALL_PERMISSIONS) expect(can("super_admin", p), p).toBe(true);
  });

  it("reserves platform.manage for super_admin only", () => {
    expect(rolesOf("platform.manage")).toEqual(["super_admin"]);
    for (const r of ROLES.filter((r) => r !== "super_admin")) expect(can(r, "platform.manage"), r).toBe(false);
  });

  it("gives tenant_admin everything except platform.manage", () => {
    for (const p of ALL_PERMISSIONS) expect(can("tenant_admin", p), p).toBe(p !== "platform.manage");
  });

  it("gives learners no admin permission at all", () => {
    for (const p of ALL_PERMISSIONS) expect(can("learner", p), p).toBe(false);
  });

  it("lets every non-learner role into the admin area", () => {
    for (const r of ROLES) expect(can(r, "admin.access"), r).toBe(r !== "learner");
  });

  it("scopes roles the way the product describes them", () => {
    expect(can("department_head", "people.read")).toBe(true);
    expect(can("department_head", "people.write")).toBe(false);
    expect(can("executive", "reports.read")).toBe(true);
    expect(can("executive", "leadership.read")).toBe(true);
    expect(can("executive", "people.read")).toBe(false);
    expect(can("campaign_manager", "campaigns.write")).toBe(true);
    expect(can("content_creator", "campaigns.write")).toBe(false);
    expect(can("content_creator", "policies.write")).toBe(true);
    expect(can("analyst", "approvals.decide")).toBe(true);
    expect(can("content_creator", "approvals.decide")).toBe(false);
    expect(can("analyst", "audit.read")).toBe(true);
    expect(can("campaign_manager", "audit.read")).toBe(false);
  });

  it("maps PERMISSION_FEATURE onto real permissions and plan features", () => {
    for (const [permission, feature] of Object.entries(PERMISSION_FEATURE)) {
      expect(ALL_PERMISSIONS, permission).toContain(permission);
      expect(ALL_FEATURES, `${permission} -> ${feature}`).toContain(feature);
    }
    expect(PERMISSION_FEATURE["campaigns.read"]).toBe("campaigns");
    expect(PERMISSION_FEATURE["leadership.read"]).toBe("leadership");
    expect(PERMISSION_FEATURE["admin.access"]).toBeUndefined();
    expect(PERMISSION_FEATURE["platform.manage"]).toBeUndefined();
  });

  it("never lets an administrator hand out super_admin", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("super_admin");
    expect(ASSIGNABLE_ROLES).toEqual(ROLES.filter((r) => r !== "super_admin"));
  });

  it("marks the roles that must use password plus two-step sign-in", () => {
    for (const r of PRIVILEGED_ROLES) expect(ROLES).toContain(r);
    for (const r of ["tenant_admin", "super_admin", "analyst", "campaign_manager"] as const) expect(isPrivileged(r), r).toBe(true);
    for (const r of ["learner", "department_head", "executive", "content_creator"] as const) expect(isPrivileged(r), r).toBe(false);
  });

  it("requires two-step verification of every console role when the organisation does, and of the operator always", () => {
    for (const r of ROLES) expect(isConsoleRole(r), r).toBe(r !== "learner");
    for (const r of ROLES) expect(twoFactorRequired(r, true), r).toBe(r !== "learner");
    for (const r of ROLES) expect(twoFactorRequired(r, false), r).toBe(r === "super_admin");
  });
});

describe("tenant defaults: featuresFor", () => {
  it("keeps the three tiers disjoint", () => {
    expect(new Set(ALL_FEATURES).size).toBe(ALL_FEATURES.length);
  });

  it("gives essentials exactly its own list", () => {
    expect([...featuresFor("essentials")].sort()).toEqual([...PLAN_FEATURES.essentials].sort());
    expect(featuresFor("essentials").has("ai_tutor")).toBe(false);
    expect(featuresFor("essentials").has("approvals")).toBe(false);
  });

  it("accumulates: essentials < professional < enterprise_hrm", () => {
    const e = featuresFor("essentials");
    const p = featuresFor("professional");
    const h = featuresFor("enterprise_hrm");
    for (const f of e) expect(p.has(f), f).toBe(true);
    for (const f of p) expect(h.has(f), f).toBe(true);
    expect(e.size).toBe(PLAN_FEATURES.essentials.length);
    expect(p.size).toBe(PLAN_FEATURES.essentials.length + PLAN_FEATURES.professional.length);
    expect(h.size).toBe(ALL_FEATURES.length);
    expect(p.has("sso")).toBe(true);
    expect(p.has("leadership")).toBe(false);
    expect(h.has("leadership")).toBe(true);
  });

  it("lets overrides add a feature to essentials", () => {
    const set = featuresFor("essentials", { ai_tutor: true, threat_intel: true });
    expect(set.has("ai_tutor")).toBe(true);
    expect(set.has("threat_intel")).toBe(true);
    expect(set.size).toBe(PLAN_FEATURES.essentials.length + 2);
  });

  it("lets overrides remove a feature from enterprise_hrm", () => {
    const set = featuresFor("enterprise_hrm", { leadership: false, learning: false });
    expect(set.has("leadership")).toBe(false);
    expect(set.has("learning")).toBe(false);
    expect(set.size).toBe(ALL_FEATURES.length - 2);
  });

  it("ignores a false override for a feature the plan does not have", () => {
    expect(featuresFor("essentials", { ops_center: false }).size).toBe(PLAN_FEATURES.essentials.length);
  });

  it("returns a fresh set each call", () => {
    const a = featuresFor("professional");
    a.delete("sso");
    expect(featuresFor("professional").has("sso")).toBe(true);
  });
});

describe("tenant defaults: defaultSettings", () => {
  it("defaults to Azerbaijani with all ten interface languages", () => {
    const s = defaultSettings();
    expect(s.defaultLocale).toBe("az");
    expect(s.locales).toEqual([...LOCALES]);
    expect(s.locales).toHaveLength(10);
    expect(defaultSettings("en").defaultLocale).toBe("en");
    expect(defaultSettings("ru").locales).toEqual([...LOCALES]);
  });

  it("has the documented shape and defaults", () => {
    const s = defaultSettings();
    expect(Object.keys(s).sort()).toEqual(["attestationText", "certificate", "defaultLocale", "email", "identity", "integrations", "learning", "locales", "notifications", "protection", "security", "timeZone"]);
    expect(s.timeZone).toBe("Asia/Baku");
    expect(s.protection).toEqual({ contentProtection: true, watermark: true });
    expect(s.learning).toEqual({ timeLimits: true, refresher: true, riskThreshold: 67, dailyGoalXp: 50 });
    expect(s.certificate).toEqual({ publicLink: true });
    expect(s.notifications).toEqual({ firstReminderDays: 3, urgentReminderHours: 24, overdueNotice: true, managerAlerts: true, failedSimulations: 2, overdueDays: 7 });
    expect(s.identity).toEqual({ requireAdmin2fa: true, maxDevices: null, ssoEnabled: false });
    expect(s.email).toEqual({ enabled: false });
    expect(s.integrations).toEqual({ webhookEnabled: false, webhookEvents: [], syslogEnabled: false });
    expect(s.security).toEqual({ supportAccessUntil: null });
  });

  it("copies the attestation text per interface language", () => {
    const s = defaultSettings();
    expect(Object.keys(s.attestationText).sort()).toEqual([...LOCALES].sort());
    expect(s.attestationText).toEqual(DEFAULT_ATTESTATION);
    expect(s.attestationText).not.toBe(DEFAULT_ATTESTATION);
  });

  it("returns fresh objects, so editing one tenant's settings cannot leak into another's", () => {
    const a = defaultSettings();
    a.locales.pop();
    a.attestationText.az = "changed";
    a.integrations.webhookEvents.push("qr.scanned");
    const b = defaultSettings();
    expect(b.locales).toEqual([...LOCALES]);
    expect(LOCALES).toHaveLength(10);
    expect(b.attestationText.az).toBe(DEFAULT_ATTESTATION.az);
    expect(b.integrations.webhookEvents).toEqual([]);
    expect(DEFAULT_ATTESTATION.az).not.toBe("changed");
  });
});

describe("password strength", () => {
  it("returns a zxcvbn result with a 0-4 score", () => {
    const r = checkPassword("k9Rt#vL2pZw4");
    expect(r.password).toBe("k9Rt#vL2pZw4");
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(4);
    expect(r.guesses).toBeGreaterThan(0);
    expect(r.feedback).toHaveProperty("suggestions");
    expect(r.feedback).toHaveProperty("warning");
  });

  it("scores the usual suspects as 0 and names the common-password list", () => {
    for (const p of ["password", "123456", "qwerty", "iloveyou", "letmein", "1234567890"]) {
      const r = checkPassword(p);
      expect(r.score, p).toBe(0);
      expect(r.feedback.warning, p).toBeTruthy();
      expect(r.sequence[0]?.pattern, p).toBe("dictionary");
      expect(r.sequence[0]?.dictionaryName, p).toBe("passwords-common");
    }
  });

  it("scores a long random password as 4", () => {
    expect(checkPassword("Tq8#vL2m!pZr9wK4&xN").score).toBe(4);
    expect(checkPassword("xylophone-ocean-granite-47").score).toBe(4);
    expect(checkPassword("Tq8#vL2m!pZr9wK4&xN").feedback.warning).toBeNull();
  });

  it("grows the score and the guess count with length", () => {
    const steps = ["k9", "k9Rt", "k9Rt#vL2", "k9Rt#vL2pZw4"].map((p) => checkPassword(p));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].score).toBeGreaterThanOrEqual(steps[i - 1].score);
      expect(steps[i].guesses).toBeGreaterThan(steps[i - 1].guesses);
    }
    expect(steps[0].score).toBe(0);
    expect(steps[steps.length - 1].score).toBe(4);
  });

  it("rates repeats and sequences far below varied characters of the same length", () => {
    const repeat = checkPassword("aaaaaaaaaa");
    const sequence = checkPassword("1234567890");
    const varied = checkPassword("Mk9!wTp3Lv");
    expect(repeat.score).toBe(0);
    expect(repeat.feedback.warning).toBe("simpleRepeat");
    expect(sequence.score).toBe(0);
    expect(varied.score).toBeGreaterThanOrEqual(3);
    expect(varied.guesses).toBeGreaterThan(repeat.guesses * 1000);
    expect(varied.guesses).toBeGreaterThan(sequence.guesses * 1000);
  });

  it("treats the person's own details (userInputs) as the weakest guess", () => {
    const plain = checkPassword("cyclowareness");
    const own = checkPassword("cyclowareness", ["cyclowareness"]);
    expect(plain.score).toBe(4);
    expect(own.score).toBe(0);
    expect(own.feedback.warning).toBe("userInputs");
    expect(own.sequence[0]?.dictionaryName).toBe("userInputs");
    expect(checkPassword("Cyclowareness2024!", ["cyclowareness"]).score).toBeLessThan(checkPassword("Cyclowareness2024!").score);
  });

  it("handles an empty password without throwing", () => {
    const r = checkPassword("");
    expect(r.score).toBe(0);
    expect(r.sequence).toEqual([]);
  });
});

describe("defang", () => {
  it("rewrites the scheme and every dot", () => {
    expect(defang("https://evil.top/x")).toBe("hxxps://evil[.]top/x");
    expect(defang("http://a.b.c/path?q=1")).toBe("hxxp://a[.]b[.]c/path?q=1");
  });

  it("matches the scheme case-insensitively and only at the start", () => {
    // Only the matched "http" prefix is rewritten; the rest of the scheme keeps its case.
    expect(defang("HTTPS://EVIL.TOP")).toBe("hxxpS://EVIL[.]TOP");
    expect(defang("https://a.b/http")).toBe("hxxps://a[.]b/http");
    expect(defang("ftp://files.example.com")).toBe("ftp://files[.]example[.]com");
  });

  it("works on bare hosts, IPs and e-mail addresses", () => {
    expect(defang("evil.com")).toBe("evil[.]com");
    expect(defang("10.0.0.1")).toBe("10[.]0[.]0[.]1");
    expect(defang("ceo@corp.example")).toBe("ceo@corp[.]example");
    expect(defang("")).toBe("");
    expect(defang("no dots here")).toBe("no dots here");
  });

  it("leaves no clickable dot behind", () => {
    const out = defang("https://login.bank.example/verify?next=a.b.c");
    expect(out.replace(/\[\.\]/g, "")).not.toContain(".");
    expect(out).not.toMatch(/^https?:/i);
  });
});

describe("color", () => {
  it("isHexColor accepts only six-digit #rrggbb strings (as implemented, no #abc shorthand)", () => {
    expect(isHexColor("#aabbcc")).toBe(true);
    expect(isHexColor("#AABBCC")).toBe(true);
    expect(isHexColor("#4f46e5")).toBe(true);
    expect(isHexColor("#000000")).toBe(true);
    expect(isHexColor("#abc")).toBe(false);
    expect(isHexColor("aabbcc")).toBe(false);
    expect(isHexColor("#aabbcg")).toBe(false);
    expect(isHexColor("#aabbccdd")).toBe(false);
    expect(isHexColor(" #aabbcc")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("")).toBe(false);
    expect(isHexColor(null)).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
    expect(isHexColor(0xaabbcc)).toBe(false);
  });

  it("readableOn returns white on dark backgrounds and ink on light ones", () => {
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("#16123a")).toBe("#ffffff");
    expect(readableOn("#4f46e5")).toBe("#ffffff");
    expect(readableOn("#0000ff")).toBe("#ffffff");
    expect(readableOn("#1e7b3c")).toBe("#ffffff");
    expect(readableOn("#ffffff")).toBe("#16123a");
    expect(readableOn("#ffff00")).toBe("#16123a");
    expect(readableOn("#ff7a1a")).toBe("#16123a");
    expect(readableOn("#e2b007")).toBe("#16123a");
    expect(readableOn("#FFFFFF")).toBe("#16123a");
  });

  it("brandStyle emits the four CSS variables with the defaults when nothing is given", () => {
    expect(brandStyle()).toEqual({ "--brand": "#4f46e5", "--brand-on": "#ffffff", "--accent": "#ff7a1a", "--accent-on": "#16123a" });
    expect(brandStyle(null, undefined)).toEqual(brandStyle());
  });

  it("brandStyle uses valid tenant colours verbatim and picks a readable foreground for each", () => {
    expect(brandStyle("#0F766E", "#FFFFFF")).toEqual({ "--brand": "#0F766E", "--brand-on": "#ffffff", "--accent": "#FFFFFF", "--accent-on": "#16123a" });
  });

  it("brandStyle falls back per colour on bad input", () => {
    const style = brandStyle("red", "#abc");
    expect(style["--brand"]).toBe("#4f46e5");
    expect(style["--accent"]).toBe("#ff7a1a");
    expect(brandStyle("#000000", "javascript:alert(1)")).toEqual({ "--brand": "#000000", "--brand-on": "#ffffff", "--accent": "#ff7a1a", "--accent-on": "#16123a" });
  });
});

describe("i18n config", () => {
  it("serves the app and the public site in the same ten languages, Arabic instead of Italian", () => {
    for (const l of LOCALES) {
      expect(isLocale(l), l).toBe(true);
      expect(isSiteLocale(l), l).toBe(true);
    }
    expect([...SITE_LOCALES]).toEqual([...LOCALES]);
    expect(LOCALES).toHaveLength(10);
    for (const l of ["tr", "uk", "de", "ar"]) expect(isLocale(l), l).toBe(true);
    expect(isLocale("it")).toBe(false);
    expect(isSiteLocale("it")).toBe(false);
    expect(isLocale("ar-SA")).toBe(false);
    expect(isSiteLocale("es")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(1)).toBe(false);
    expect(isSiteLocale({})).toBe(false);
    expect(isLocale(DEFAULT_LOCALE)).toBe(true);
    expect(Object.keys(LOCALE_NAMES).sort()).toEqual([...SITE_LOCALES].sort());
  });

  describe("negotiate", () => {
    it("parses q-values and region tags", () => {
      expect(negotiate("ru-RU,en;q=0.8", LOCALES, "az")).toBe("ru");
      expect(negotiate("en;q=0.8,ru;q=0.9", LOCALES, "az")).toBe("ru");
      expect(negotiate("az-Latn-AZ,en-US;q=0.9", LOCALES, "en")).toBe("az");
      expect(negotiate("uk-UA,ru;q=0.9", SITE_LOCALES, "en")).toBe("uk");
    });

    it("skips unsupported tags and q=0 entries, then falls back", () => {
      expect(negotiate("es,ru;q=0.5", LOCALES, "az")).toBe("ru");
      expect(negotiate("it-IT,es;q=0.9", LOCALES, "az")).toBe("az");
      expect(negotiate("ar-SA,en;q=0.8", LOCALES, "az")).toBe("ar");
      expect(negotiate("en;q=0,ru;q=0.1", LOCALES, "az")).toBe("ru");
      expect(negotiate("en;q=0", LOCALES, "az")).toBe("az");
      expect(negotiate("*", LOCALES, "ru")).toBe("ru");
      expect(negotiate(",,,", LOCALES, "az")).toBe("az");
    });

    it("falls back when the header is missing", () => {
      expect(negotiate(null, LOCALES, "en")).toBe("en");
      expect(negotiate(undefined, LOCALES, "ru")).toBe("ru");
      expect(negotiate("", LOCALES, "az")).toBe("az");
    });

    it("tolerates case, whitespace and malformed q-values", () => {
      expect(negotiate("EN-us", LOCALES, "az")).toBe("en");
      expect(negotiate(" en , ru ; q=0.3", LOCALES, "az")).toBe("en");
      expect(negotiate("en;q=abc,ru", LOCALES, "az")).toBe("ru");
      expect(negotiate("ru;q=0.5,en;q=0.5", LOCALES, "az")).toBe("ru");
    });
  });

  describe("pick", () => {
    it("prefers the exact locale, then en, then az, then whatever comes first", () => {
      expect(pick({ az: "A", en: "E", ru: "R" }, "ru")).toBe("R");
      expect(pick({ az: "A", en: "E" }, "ru")).toBe("E");
      expect(pick({ az: "A", ru: "R" }, "en")).toBe("A");
      expect(pick({ tr: "T", de: "D" }, "en")).toBe("T");
    });

    it("returns an empty string for a missing or empty map", () => {
      expect(pick(null, "az")).toBe("");
      expect(pick(undefined, "en")).toBe("");
      expect(pick({}, "ru")).toBe("");
    });
  });
});

describe("crypto", () => {
  const tamper = (value: string, part: number): string => {
    const parts = value.split(":");
    const s = parts[part];
    parts[part] = (s[0] === "A" ? "B" : "A") + s.slice(1);
    return parts.join(":");
  };

  describe("encryptSecret / decryptSecret", () => {
    it("round-trips text, including unicode", () => {
      for (const plain of ["smtp-password-1", "şifrə ✓ пароль", "x".repeat(2000)]) {
        expect(decryptSecret(encryptSecret(plain))).toBe(plain);
      }
    });

    it("emits a versioned kid:iv:tag:data envelope with a fresh IV every time", () => {
      const a = encryptSecret("same");
      const b = encryptSecret("same");
      expect(a).not.toBe(b);
      const parts = a.split(":");
      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe("v2");
      expect(parts[1]).toMatch(/^[0-9a-f]{8}$/);
      expect(Buffer.from(parts[2], "base64url")).toHaveLength(12);
      expect(Buffer.from(parts[3], "base64url")).toHaveLength(16);
      expect(a).not.toContain("same");
    });

    it("returns null for a tampered ciphertext, tag or IV", () => {
      const sealed = encryptSecret("webhook-signing-secret");
      expect(decryptSecret(tamper(sealed, 4))).toBeNull();
      expect(decryptSecret(tamper(sealed, 3))).toBeNull();
      expect(decryptSecret(tamper(sealed, 2))).toBeNull();
      const forged = ["v1", randomBytes(12).toString("base64url"), randomBytes(16).toString("base64url"), randomBytes(24).toString("base64url")].join(":");
      expect(decryptSecret(forged)).toBeNull();
    });

    it("returns null for a wrong version or a malformed value", () => {
      const sealed = encryptSecret("totp-key");
      expect(decryptSecret(sealed.replace(/^v2/, "v3"))).toBeNull();
      expect(decryptSecret(sealed.replace(/^v2/, "v0"))).toBeNull();
      expect(decryptSecret(sealed.split(":").slice(0, 4).join(":"))).toBeNull();
      expect(decryptSecret("v2:" + sealed.split(":")[1] + "::" + sealed.split(":")[3] + ":" + sealed.split(":")[4])).toBeNull();
      expect(decryptSecret("not-a-ciphertext")).toBeNull();
      expect(decryptSecret("")).toBeNull();
      expect(decryptSecret(null)).toBeNull();
      expect(decryptSecret(undefined)).toBeNull();
    });

    // BUG (minor): src/server/crypto.ts:29 rejects an empty data segment, but encryptSecret("") legitimately
    // produces one (GCM still authenticates it), so the round trip yields null instead of "".
    it("round-trips an empty string", () => {
      expect(decryptSecret(encryptSecret(""))).toBe("");
    });

    it("makes stored secrets unreadable after APP_SECRET changes without APP_SECRET_PREVIOUS", () => {
      const sealed = encryptSecret("ldap-bind-password");
      try {
        vi.stubEnv("APP_SECRET", "rotated-test-only-app-secret-9876543210-zyxwvutsrq");
        expect(decryptSecret(sealed)).toBeNull();
        expect(decryptSecret(encryptSecret("new"))).toBe("new");
      } finally {
        vi.stubEnv("APP_SECRET", TEST_SECRET);
      }
      expect(decryptSecret(sealed)).toBe("ldap-bind-password");
    });
  });

  describe("hmac", () => {
    it("is deterministic lowercase hex of 64 characters", () => {
      const a = hmac('{"event":"qr.scanned"}', "whsec_test");
      expect(a).toMatch(/^[0-9a-f]{64}$/);
      expect(hmac('{"event":"qr.scanned"}', "whsec_test")).toBe(a);
    });

    it("matches the HMAC-SHA256 reference vector", () => {
      expect(hmac("The quick brown fox jumps over the lazy dog", "key")).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
    });

    it("changes with the payload and with the secret", () => {
      const base = hmac("payload", "secret-a");
      expect(hmac("payload!", "secret-a")).not.toBe(base);
      expect(hmac("payload", "secret-b")).not.toBe(base);
    });
  });

  describe("signValue / unsignValue", () => {
    it("round-trips values, including ones that contain dots", () => {
      for (const value of ["session-id", "user.with.dots", "a:b|c d", "ünïcödé"]) {
        const signed = signValue(value);
        expect(signed.startsWith(`${value}.`)).toBe(true);
        expect(unsignValue(signed)).toBe(value);
      }
      expect(signValue("stable")).toBe(signValue("stable"));
    });

    it("rejects a forged or transplanted signature", () => {
      const signed = signValue("alice");
      const dot = signed.lastIndexOf(".");
      const sig = signed.slice(dot + 1);
      expect(unsignValue(`bob.${sig}`)).toBeNull();
      expect(unsignValue(`alice.${(sig[0] === "A" ? "B" : "A") + sig.slice(1)}`)).toBeNull();
      expect(unsignValue(`alice.${sig.slice(0, -1)}`)).toBeNull();
      expect(unsignValue("alice.")).toBeNull();
      expect(unsignValue("alice.not-a-signature")).toBeNull();
    });

    it("rejects missing, unsigned and empty values", () => {
      expect(unsignValue(null)).toBeNull();
      expect(unsignValue(undefined)).toBeNull();
      expect(unsignValue("")).toBeNull();
      expect(unsignValue("no-dot-at-all")).toBeNull();
      expect(unsignValue(".sig-only")).toBeNull();
      expect(unsignValue(signValue(""))).toBeNull();
    });

    it("stops honouring signatures after APP_SECRET rotates", () => {
      const signed = signValue("remember-me");
      try {
        vi.stubEnv("APP_SECRET", "rotated-test-only-app-secret-9876543210-zyxwvutsrq");
        expect(unsignValue(signed)).toBeNull();
      } finally {
        vi.stubEnv("APP_SECRET", TEST_SECRET);
      }
      expect(unsignValue(signed)).toBe("remember-me");
    });
  });

  it("sha256Hex matches the reference vectors", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("şifrə")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});

describe("sso routing", () => {
  const tenant: SsoTenant = { id: "t1", slug: "agency", domain: "agency.gov.az", domainVerifiedAt: new Date("2026-10-14T00:00:00Z"), ssoEnabled: true, ssoFeature: true, ssoReady: true, autoCreate: true };
  const learner: SsoPerson = { tenantId: "t1", role: "learner" };
  const sso = { step: "sso", url: "/api/sso/start?tenant=agency" };
  const password = { step: "password" };

  it("emailDomain lower-cases the part after the last @ and rejects anything else", () => {
    expect(emailDomain("Ali@Agency.GOV.az")).toBe("agency.gov.az");
    expect(emailDomain("a@b@c.example")).toBe("c.example");
    expect(emailDomain("no-at")).toBeNull();
    expect(emailDomain("@x.az")).toBeNull();
    expect(emailDomain("a@")).toBeNull();
    expect(emailDomain("a@   ")).toBeNull();
  });

  it("ssoStartUrl points at the start route with the slug encoded", () => {
    expect(ssoStartUrl("agency")).toBe("/api/sso/start?tenant=agency");
    expect(ssoStartUrl("a b&c")).toBe("/api/sso/start?tenant=a%20b%26c");
  });

  it("sends learners of a proven single sign-on domain to the provider", () => {
    expect(decideSignInStep("ali@agency.gov.az", tenant, learner)).toEqual(sso);
    for (const role of ["department_head", "executive", "content_creator"] as const) expect(decideSignInStep("x@agency.gov.az", tenant, { ...learner, role }), role).toEqual(sso);
  });

  it("keeps administrators and the other privileged roles on password plus two-step", () => {
    for (const role of ["tenant_admin", "super_admin", "analyst", "campaign_manager"] as const) expect(decideSignInStep("x@agency.gov.az", tenant, { ...learner, role }), role).toEqual(password);
  });

  it("uses the password step when the domain is not proven, SSO is off, the plan lacks it or the provider is not set up", () => {
    expect(decideSignInStep("ali@agency.gov.az", null, learner)).toEqual(password);
    expect(decideSignInStep("ali@agency.gov.az", { ...tenant, domainVerifiedAt: null }, learner)).toEqual(password);
    expect(decideSignInStep("ali@agency.gov.az", { ...tenant, domain: null }, learner)).toEqual(password);
    expect(decideSignInStep("ali@other.az", tenant, learner)).toEqual(password);
    expect(decideSignInStep("ali@agency.gov.az", { ...tenant, ssoEnabled: false }, learner)).toEqual(password);
    expect(decideSignInStep("ali@agency.gov.az", { ...tenant, ssoFeature: false }, learner)).toEqual(password);
    expect(decideSignInStep("ali@agency.gov.az", { ...tenant, ssoReady: false }, learner)).toEqual(password);
  });

  it("matches the domain regardless of case", () => {
    expect(decideSignInStep("Ali@AGENCY.gov.az", { ...tenant, domain: "Agency.Gov.AZ" }, learner)).toEqual(sso);
  });

  it("sends unknown people on the domain to the provider whether or not it may create them, so the step does not reveal accounts", () => {
    expect(decideSignInStep("new@agency.gov.az", tenant, null)).toEqual(sso);
    expect(decideSignInStep("new@agency.gov.az", { ...tenant, autoCreate: false }, null)).toEqual(sso);
    expect(decideSignInStep("new@agency.gov.az", { ...tenant, autoCreate: false }, null)).toEqual(decideSignInStep("ali@agency.gov.az", { ...tenant, autoCreate: false }, learner));
  });

  it("gives unknown and known people the same answer off the domain, so nothing says whether an account exists", () => {
    expect(decideSignInStep("new@other.az", tenant, null)).toEqual(decideSignInStep("ali@other.az", tenant, learner));
    expect(decideSignInStep("new@other.az", null, null)).toEqual(password);
    expect(decideSignInStep("not-an-email", tenant, null)).toEqual(password);
  });

  it("answers alike for every account status (the callback refuses suspended people), and ignores people of another organisation", () => {
    expect(decideSignInStep("ali@agency.gov.az", tenant, learner)).toEqual(decideSignInStep("new@agency.gov.az", tenant, null));
    expect(decideSignInStep("ali@agency.gov.az", tenant, { ...learner, tenantId: "t2" })).toEqual(password);
  });
});
