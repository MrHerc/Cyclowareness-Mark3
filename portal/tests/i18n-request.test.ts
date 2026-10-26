import { describe, expect, it, vi } from "vitest";

const cookie = { value: "az" as string | undefined };
const header = { accept: null as string | null, country: null as string | null };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookie.value ? { value: cookie.value } : undefined) }),
  headers: async () => {
    const h = new Headers();
    if (header.accept) h.set("accept-language", header.accept);
    if (header.country) h.set("cf-ipcountry", header.country);
    return h;
  },
}));
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));
const session = { value: null as null | { user: { locale: string }; tenant: { settings: { locales: string[]; defaultLocale: string } } } };
vi.mock("../src/server/auth/viewer", () => ({ getSession: async () => session.value }));

type Config = (params: { locale?: string }) => Promise<{ locale: string; messages: { common: { cancel: string } } }>;
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

  it("gives a signed-out visitor outside Azerbaijan English for a language the app does not have", async () => {
    cookie.value = undefined;
    header.accept = "de-DE,de;q=0.9";
    expect((await (await config())({})).locale).toBe("en");
    header.country = "AZ";
    expect((await (await config())({})).locale).toBe("az");
    header.country = null;
    header.accept = "tr-TR,tr;q=0.9";
    expect((await (await config())({})).locale).toBe("az");
    header.accept = "uk-UA";
    expect((await (await config())({})).locale).toBe("ru");
    header.accept = null;
    expect((await (await config())({})).locale).toBe("az");
  });
});
