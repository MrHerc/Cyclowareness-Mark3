import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { ServerOff, WifiOff } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { RetryButton } from "@/components/retry-button";
import { LOCALES, LOCALE_COOKIE, langAttrs } from "@/i18n/config";
import { offlineScript } from "./script";

/*
 * The service worker caches this page once, at install, and serves that copy for every navigation it cannot fetch:
 * without a connection, or when the server does not answer. So the copy holds the text in every interface language,
 * for both cases, and the inline script (./script.ts) shows the right one at the moment it is opened and reloads the
 * page when the server is back. The tab title stays the brand name, which reads the same in every language. The
 * script carries the request's CSP nonce, which the cached copy keeps too.
 */
const SCRIPT = offlineScript(LOCALE_COOKIE);

/** Shown by the service worker when a page cannot be fetched. */
export default async function OfflinePage() {
  const [locale, nonce] = await Promise.all([getLocale(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const texts = await Promise.all(
    LOCALES.map(async (l) => {
      const [tr, tc] = await Promise.all([getTranslations({ locale: l, namespace: "site.offline" }), getTranslations({ locale: l, namespace: "common" })]);
      return { locale: l, title: tr("title"), body: tr("body"), serverTitle: tr("serverTitle"), serverBody: tr("serverBody"), retry: tc("retry") };
    }),
  );
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <BrandMark />
        <span data-offline-state="offline" suppressHydrationWarning className="grid size-16 place-items-center rounded-full bg-sunken text-ink-muted">
          <WifiOff className="size-7" />
        </span>
        <span data-offline-state="server" hidden suppressHydrationWarning className="grid size-16 place-items-center rounded-full bg-sunken text-ink-muted">
          <ServerOff className="size-7" />
        </span>
        {texts.map((x) => (
          <div key={x.locale} {...langAttrs(x.locale)} data-offline-locale={x.locale} hidden={x.locale !== locale} suppressHydrationWarning className="grid justify-items-center gap-4">
            <div data-offline-state="offline" suppressHydrationWarning className="grid justify-items-center gap-4">
              <h1 className="text-title font-bold">{x.title}</h1>
              <p className="text-body-sm text-ink-muted">{x.body}</p>
            </div>
            <div data-offline-state="server" hidden suppressHydrationWarning className="grid justify-items-center gap-4">
              <h1 className="text-title font-bold">{x.serverTitle}</h1>
              <p className="text-body-sm text-ink-muted">{x.serverBody}</p>
            </div>
            <div data-offline-retry>
              <RetryButton label={x.retry} />
            </div>
          </div>
        ))}
        {/* public/sw.js serves this page without any other script, so React never hydrates it: the retry button works through SCRIPT. */}
        <script nonce={nonce} data-offline-script="" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      </div>
    </main>
  );
}
