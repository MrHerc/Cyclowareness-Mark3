import { DEFAULT_TIME_ZONE } from "../lib/day";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { loadMessages, type Messages } from "./messages";

/**
 * The messages of one interface language, for text written outside a request: the job runner (reminders,
 * manager alerts, scheduled reports) and the services it shares with server actions have no next-intl
 * request config. Use with next-intl's `createTranslator({ ...await messagesFor(locale, tz), namespace })`,
 * `tz` being the organisation's time zone (dates in the text are shown in it).
 * A language that is not an interface language gets the default one.
 */
export async function messagesFor(locale: string, timeZone = DEFAULT_TIME_ZONE): Promise<{ locale: Locale; messages: Messages; timeZone: string }> {
  const l = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return { locale: l, messages: await loadMessages(l), timeZone };
}
