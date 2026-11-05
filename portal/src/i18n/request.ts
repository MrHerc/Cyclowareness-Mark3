import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_TIME_ZONE } from "../lib/day";
import { DEFAULT_LOCALE, LOCALE_COOKIE, UI_ALIAS, browserUiLocale, isLocale, isSiteLocale, type Locale } from "./config";
import { loadMessages } from "./messages";

/**
 * React-cached: pages that load the viewer do not query twice. A database outage must not take the
 * language (and with it every page, the error pages included) down: the cookie and browser still decide.
 * Imported when needed: next-intl loads this file while its own server module is still initialising.
 */
async function currentSession() {
  const { getSession } = await import("../server/auth/viewer");
  return getSession().catch(() => null);
}

/**
 * Locale resolution: the public site sets `x-site-locale` from its URL (see proxy.ts). Everywhere else a
 * signed-in person gets their profile language (an admin or the directory sync may have changed it, and
 * emails use it too), limited to the languages their organisation has switched on; then the `locale`
 * cookie (the last choice on this browser), then the browser's languages.
 * An explicit `getTranslations({ locale })` (a notification or report in someone else's language)
 * gets that locale, not the request's. Dates and times are shown in the time zone of the signed-in
 * person's organisation; the public site and signed-out pages use the default one.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  if (isLocale(requested)) {
    const session = await currentSession();
    return { locale: requested, messages: await loadMessages(requested), timeZone: session?.tenant.settings.timeZone ?? DEFAULT_TIME_ZONE, now: new Date() };
  }
  const [h, c] = await Promise.all([headers(), cookies()]);
  const site = h.get("x-site-locale");
  if (isSiteLocale(site)) return { locale: site, messages: await loadMessages(site), timeZone: DEFAULT_TIME_ZONE, now: new Date() };
  const cookie = c.get(LOCALE_COOKIE)?.value;
  // Own keys only: a cookie such as "constructor" or "__proto__" must not read Object.prototype.
  const fromCookie = isLocale(cookie) ? cookie : cookie && Object.hasOwn(UI_ALIAS, cookie) ? UI_ALIAS[cookie] : undefined;
  const session = await currentSession();
  let locale: Locale;
  if (session) {
    const enabled = session.tenant.settings.locales.filter(isLocale);
    const fits = (l: string | undefined): l is Locale => isLocale(l) && (!enabled.length || enabled.includes(l));
    const fallback = session.tenant.settings.defaultLocale;
    locale = [session.user.locale, fromCookie].find(fits) ?? (isLocale(fallback) ? fallback : DEFAULT_LOCALE);
  } else {
    locale = fromCookie ?? browserUiLocale(h.get("accept-language"), h.get("cf-ipcountry"));
  }
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: session?.tenant.settings.timeZone ?? DEFAULT_TIME_ZONE,
    now: new Date(),
  };
});
