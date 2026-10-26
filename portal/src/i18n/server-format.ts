import "server-only";
import { getFormatter, getLocale, getNow } from "next-intl/server";
import { formatAzRelative, relativeUnit } from "../lib/az-format";

type Formatter = Awaited<ReturnType<typeof getFormatter>>;

/**
 * next-intl's server formatter, except Azerbaijani relative times: CLDR words them "5 gün öncə" /
 * "2 gün ərzində", the app says "5 gün əvvəl" / "2 gün sonra" like the client (`useClientFormat`).
 * Use it in server components that print a relative time.
 */
export async function getAppFormatter(): Promise<Formatter> {
  const [format, locale, requestNow] = await Promise.all([getFormatter(), getLocale(), getNow()]);
  if (locale !== "az") return format;
  const relativeTime: Formatter["relativeTime"] = (date, nowOrOptions) => {
    const now = nowOrOptions instanceof Date || typeof nowOrOptions === "number" ? nowOrOptions : (nowOrOptions?.now ?? requestNow);
    return formatAzRelative(...relativeUnit((new Date(date).getTime() - new Date(now).getTime()) / 1000));
  };
  return { ...format, relativeTime };
}
