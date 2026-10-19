import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, isSiteLocale, negotiate } from "./config";
import { loadMessages } from "./messages";

/**
 * Locale resolution: the public site sets `x-site-locale` from its URL (see proxy.ts);
 * everywhere else the `locale` cookie wins (it mirrors the profile language), then the browser.
 */
export default getRequestConfig(async () => {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const site = h.get("x-site-locale");
  const cookie = c.get(LOCALE_COOKIE)?.value;
  const locale = isSiteLocale(site) ? site : isLocale(cookie) ? cookie : negotiate(h.get("accept-language"), LOCALES, DEFAULT_LOCALE);
  return {
    locale,
    messages: await loadMessages(isLocale(locale) ? locale : "en"),
    timeZone: "Asia/Baku",
    now: new Date(),
  };
});
