import { describe, expect, it, vi } from "vitest";

const cookie = { value: "az" as string | undefined };
const header = { accept: null as string | null, country: null as string | null, site: null as string | null };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookie.value ? { value: cookie.value } : undefined) }),
  headers: async () => {
    const h = new Headers();
    if (header.accept) h.set("accept-language", header.accept);
    if (header.country) h.set("cf-ipcountry", header.country);
    if (header.site) h.set("x-site-locale", header.site);
    return h;
  },
}));
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));
const session = { value: null as null | { user: { locale: string }; tenant: { settings: { locales: string[]; defaultLocale: string; timeZone?: string } } } };
vi.mock("../src/server/auth/viewer", () => ({ getSession: async () => session.value }));

type Config = (params: { locale?: string }) => Promise<{ locale: string; timeZone: string; messages: { common: { cancel: string } } }>;
const config = async () => (await import("../src/i18n/request")).default as unknown as Config;

describe("request config", () => {
  it("uses the interface language from the cookie", async () => {
    cookie.value = "az";
    expect((await (await config())({})).locale).toBe("az");
  });

  it("honours an explicit locale (notifications and reports for someone else)", async () => {
    cookie.value = "az";
    const ru = await (await config())({ locale: "ru" });
    expect(ru.locale).toBe("ru");
    expect(ru.messages.common.cancel).toBe("Отмена");
    const en = await (await config())({ locale: "en" });
    expect(en.messages.common.cancel).toBe("Cancel");
  });

  it("prefers the signed-in person's profile language, within the organisation's languages", async () => {
    cookie.value = "az";
    session.value = { user: { locale: "ru" }, tenant: { settings: { locales: ["az", "en", "ru"], defaultLocale: "az" } } };
    expect((await (await config())({})).locale).toBe("ru");
    session.value = { user: { locale: "ru" }, tenant: { settings: { locales: ["az", "en"], defaultLocale: "en" } } };
    expect((await (await config())({})).locale).toBe("az");
    cookie.value = undefined;
    expect((await (await config())({})).locale).toBe("en");
    session.value = null;
  });

  it("shows times in the signed-in organisation's zone, the default zone elsewhere", async () => {
    cookie.value = "az";
    session.value = { user: { locale: "ru" }, tenant: { settings: { locales: [], defaultLocale: "az", timeZone: "Europe/Berlin" } } };
    expect((await (await config())({})).timeZone).toBe("Europe/Berlin");
    expect((await (await config())({ locale: "ru" })).timeZone).toBe("Europe/Berlin");
    header.site = "en";
    expect((await (await config())({})).timeZone).toBe("Asia/Baku");
    header.site = null;
    session.value = null;
    expect((await (await config())({})).timeZone).toBe("Asia/Baku");
    expect((await (await config())({ locale: "ru" })).timeZone).toBe("Asia/Baku");
  });

  it("gives a signed-out visitor the browser's language, and outside Azerbaijan English for one the app does not have", async () => {
    cookie.value = undefined;
    header.accept = "it-IT,it;q=0.9";
    expect((await (await config())({})).locale).toBe("en");
    header.country = "AZ";
    expect((await (await config())({})).locale).toBe("az");
    header.country = null;
    for (const [accept, locale] of [
      ["tr-TR,tr;q=0.9", "tr"],
      ["uk-UA", "uk"],
      ["de-DE,de;q=0.9", "de"],
      ["ar-SA,ar;q=0.9", "ar"],
      ["kk-KZ", "ru"],
    ]) {
      header.accept = accept;
      expect((await (await config())({})).locale, accept).toBe(locale);
    }
    header.accept = null;
    expect((await (await config())({})).locale).toBe("az");
    // The first load of each language transforms its nine message files.
  }, 30_000);

  it("maps alias cookies but never reads Object.prototype for a crafted one", async () => {
    session.value = null;
    cookie.value = "kk";
    expect((await (await config())({})).locale).toBe("ru");
    cookie.value = "uk";
    expect((await (await config())({})).locale).toBe("uk");
    header.accept = "en-US";
    // A cookie left from the removed Italian site falls back like any unknown language.
    cookie.value = "it";
    expect((await (await config())({})).locale).toBe("en");
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      cookie.value = name;
      const r = await (await config())({});
      expect(r.locale, name).toBe("en");
      expect(r.messages.common.cancel, name).toBe("Cancel");
    }
    header.accept = null;
    cookie.value = undefined;
  });
});
