import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { RetryButton } from "@/components/retry-button";
import { LOCALES, LOCALE_COOKIE, langAttrs } from "@/i18n/config";

/*
 * The service worker caches this page once, at install, and serves that copy for every navigation
 * without a connection. So the copy holds the text in every interface language and the inline
 * script below shows the one in the `locale` cookie, with its direction, at the moment it is opened
 * (it needs no extra chunk, which may not be cached). The tab title stays the brand name, which reads the same in
 * every language. The script carries the request's CSP nonce, which the cached copy keeps too.
 */
const PICK = `(function(){var m=document.cookie.match(/(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)/);var l=m&&m[1];var b=document.querySelectorAll("[data-offline-locale]");var i,f=null;for(i=0;i<b.length;i++)if(b[i].getAttribute("data-offline-locale")===l)f=b[i];if(!f)return;for(i=0;i<b.length;i++)b[i].hidden=b[i]!==f;document.documentElement.lang=l;document.documentElement.dir=f.dir;})();`;

/** Shown by the service worker when a page is opened without a connection. */
export default async function OfflinePage() {
  const [locale, nonce] = await Promise.all([getLocale(), headers().then((h) => h.get("x-nonce") ?? undefined)]);
  const texts = await Promise.all(
    LOCALES.map(async (l) => {
      const [tr, tc] = await Promise.all([getTranslations({ locale: l, namespace: "site.offline" }), getTranslations({ locale: l, namespace: "common" })]);
      return { locale: l, title: tr("title"), body: tr("body"), retry: tc("retry") };
    }),
  );
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <BrandMark />
        <span className="grid size-16 place-items-center rounded-full bg-sunken text-ink-muted">
          <WifiOff className="size-7" />
        </span>
        {texts.map((x) => (
          <div key={x.locale} {...langAttrs(x.locale)} data-offline-locale={x.locale} hidden={x.locale !== locale} suppressHydrationWarning className="grid justify-items-center gap-4">
            <h1 className="text-title font-bold">{x.title}</h1>
            <p className="text-body-sm text-ink-muted">{x.body}</p>
            <RetryButton label={x.retry} />
          </div>
        ))}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: PICK }} />
      </div>
    </main>
  );
}
