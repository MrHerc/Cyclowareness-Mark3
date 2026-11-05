import { afterEach, describe, expect, it, vi } from "vitest";
import { isUuid } from "@/lib/ids";
import { cn } from "@/lib/cn";
import { isAppPath } from "@/lib/app-paths";
import { policyBaseLocale, policyTextFor } from "@/lib/policy-text";
import { hapticsEnabled, hapticsSupported, setHapticsEnabled, vibrate } from "@/lib/haptics";

describe("isUuid", () => {
  it("accepts canonical UUIDs in either case", () => {
    expect(isUuid("0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60")).toBe(true);
    expect(isUuid("0B9E5F4E-3C1D-4A7B-9F2E-1D2C3B4A5F60")).toBe(true);
  });

  it("refuses anything a uuid column comparison would throw on", () => {
    for (const bad of ["", "not-a-uuid", "0b9e5f4e3c1d4a7b9f2e1d2c3b4a5f60", "{0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60}", "0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60 ", "0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f6g"]) {
      expect(isUuid(bad), bad).toBe(false);
    }
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(["0b9e5f4e-3c1d-4a7b-9f2e-1d2c3b4a5f60"])).toBe(false);
  });
});

describe("cn", () => {
  it("joins conditional classes and drops falsy ones", () => {
    expect(cn("a", false && "b", null, undefined, { c: true, d: false }, ["e"])).toBe("a c e");
  });

  it("lets a later utility of the same group win", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("knows the custom type scale, so a size and a colour both survive", () => {
    // Without the extended theme tailwind-merge reads text-caption as a colour and drops text-ink.
    expect(cn("text-caption text-ink")).toBe("text-caption text-ink");
    expect(cn("text-body", "text-title")).toBe("text-title");
  });

  it("knows the custom radius and shadow scales", () => {
    expect(cn("rounded-sm", "rounded-pill")).toBe("rounded-pill");
    expect(cn("shadow-xs", "shadow-overlay")).toBe("shadow-overlay");
  });
});

describe("isAppPath", () => {
  it("matches every signed-in area and its sub-pages", () => {
    for (const p of ["/app", "/admin", "/admin/users/1", "/super", "/learn", "/learn/phishing-email/intro", "/paths/x", "/league", "/progress", "/profile", "/lab/inbox-triage", "/security/sandbox", "/sessions", "/help/tickets/3", "/policies", "/print/certificate/x"]) {
      expect(isAppPath(p), p).toBe(true);
    }
  });

  it("does not match public pages that only share a prefix", () => {
    for (const p of ["/", "/az", "/en/pricing", "/administrator", "/learning", "/paths-overview", "/legal/privacy", "/t/abc", "/q/abc", "/sign-in"]) {
      expect(isAppPath(p), p).toBe(false);
    }
  });
});

describe("policy texts", () => {
  const version = {
    title: "Acceptable use",
    summary: "Short version",
    bodyMd: "# Rules",
    translations: {
      en: { title: "Acceptable use", summary: "Short version", bodyMd: "# Rules", base: true },
      ru: { title: "Допустимое использование", bodyMd: "# Правила" },
      az: { title: "", summary: "Qısa", bodyMd: "# Qaydalar" },
    },
  };

  it("finds the base language from the copy marked base, else the organisation default", () => {
    expect(policyBaseLocale(version.translations, "az")).toBe("en");
    expect(policyBaseLocale({ ru: { title: "x", bodyMd: "y" } }, "az")).toBe("az");
    expect(policyBaseLocale(null, "ru")).toBe("ru");
    expect(policyBaseLocale(undefined, "ru")).toBe("ru");
  });

  it("shows the reader's own language when the version has it", () => {
    expect(policyTextFor(version, "ru", "az")).toEqual({ title: "Допустимое использование", summary: null, bodyMd: "# Правила", lang: "ru" });
  });

  it("keeps the base title for a translation without one, and the base summary only for the base copy", () => {
    expect(policyTextFor(version, "az", "az")).toEqual({ title: "Acceptable use", summary: "Qısa", bodyMd: "# Qaydalar", lang: "az" });
    expect(policyTextFor({ ...version, translations: { en: { title: "T", bodyMd: "B", base: true } } }, "en", "az").summary).toBe("Short version");
  });

  it("falls back to the base text in the base language", () => {
    expect(policyTextFor(version, "de", "az")).toEqual({ title: "Acceptable use", summary: "Short version", bodyMd: "# Rules", lang: "en" });
    expect(policyTextFor({ ...version, translations: null }, "de", "ru").lang).toBe("ru");
  });
});

describe("haptics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const storage = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it("is off where the device cannot vibrate", () => {
    vi.stubGlobal("navigator", {});
    expect(hapticsSupported()).toBe(false);
    expect(hapticsEnabled()).toBe(false);
    expect(() => vibrate()).not.toThrow();
  });

  it("is on by default, remembers the choice per device and vibrates only when on", () => {
    const vibrateFn = vi.fn();
    const local = storage();
    vi.stubGlobal("navigator", { vibrate: vibrateFn });
    vi.stubGlobal("window", { localStorage: local });
    expect(hapticsSupported()).toBe(true);
    expect(hapticsEnabled()).toBe(true);
    vibrate([20, 40]);
    expect(vibrateFn).toHaveBeenLastCalledWith([20, 40]);

    setHapticsEnabled(false);
    expect(local.data.get("cy-haptics")).toBe("0");
    expect(hapticsEnabled()).toBe(false);
    vibrate();
    expect(vibrateFn).toHaveBeenCalledTimes(1);

    setHapticsEnabled(true);
    vibrate();
    expect(vibrateFn).toHaveBeenLastCalledWith(40);
  });

  it("survives storage that throws (private mode) and a vibrate() that throws", () => {
    const throwing = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("navigator", { vibrate: throwing });
    vi.stubGlobal("window", { localStorage: { getItem: throwing, setItem: throwing } });
    expect(hapticsEnabled()).toBe(true);
    expect(() => setHapticsEnabled(false)).not.toThrow();
    expect(() => vibrate()).not.toThrow();
  });
});
