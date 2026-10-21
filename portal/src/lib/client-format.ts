"use client";

import { type DateTimeFormatOptions, useFormatter, useLocale, useTimeZone } from "next-intl";
import { type AzDateOptions, formatAzDate, formatAzRelative, relativeUnit } from "./az-format";

/**
 * Date, time and relative-time formatting for client components. Azerbaijani is formatted by
 * `az-format.ts` (Chromium has no `az` ICU data and would print "2026 M10 14" / "-6 h", which also
 * mismatches the server on hydration); every other locale goes through next-intl. Both use the
 * app's configured time zone. Server components keep `getFormatter` — Node has the data.
 */

export type ClientDateOptions = AzDateOptions;

/** Intl rejects `timeStyle` next to field options, so the numeric-with-time shape is spelled out for it. */
function intlOptions(o: ClientDateOptions): DateTimeFormatOptions {
  if ("day" in o && o.month === "numeric") return { day: "numeric", month: "numeric", year: "numeric", ...(o.timeStyle ? { hour: "2-digit", minute: "2-digit" } : {}) };
  return o;
}

export type ClientFormat = {
  dateTime: (date: Date | string | number, options?: ClientDateOptions) => string;
  relativeTime: (date: Date | string | number, now?: Date | number) => string;
};

/** `useFormatter()` for client components; see the note above. */
export function useClientFormat(): ClientFormat {
  const locale = useLocale();
  const timeZone = useTimeZone();
  const format = useFormatter();
  if (locale !== "az") {
    return {
      dateTime: (date, options = { dateStyle: "medium" }) => format.dateTime(new Date(date), intlOptions(options)),
      relativeTime: (date, now) => format.relativeTime(new Date(date), now),
    };
  }
  return {
    dateTime: (date, options = { dateStyle: "medium" }) => formatAzDate(new Date(date), options, timeZone),
    relativeTime: (date, now) => {
      const diff = (new Date(date).getTime() - (now === undefined ? Date.now() : new Date(now).getTime())) / 1000;
      return formatAzRelative(...relativeUnit(diff));
    },
  };
}
