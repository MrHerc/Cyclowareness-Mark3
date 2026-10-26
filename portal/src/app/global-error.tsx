"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, UI_ALIAS, browserUiLocale, isLocale, type Locale } from "@/i18n/config";

/**
 * Last-resort boundary when the root layout itself fails (no fonts, no translations available).
 * Plain HTML in the visitor's interface language, read from the `locale` cookie like the server
 * does; the texts repeat common.errors.errorTitle / errorBody and common.retry.
 */
const TEXT: Record<Locale, { title: string; body: string; retry: string }> = {
  az: { title: "Nəsə alınmadı", body: "Bu səhifəni yükləmək alınmadı. Bir az sonra yenidən cəhd edin.", retry: "Yenidən cəhd et" },
  en: { title: "Something went wrong", body: "We couldn't load this page. Try again in a moment.", retry: "Try again" },
  ru: { title: "Что-то пошло не так", body: "Не удалось загрузить страницу. Попробуйте чуть позже.", retry: "Повторить" },
};

const subscribe = () => () => {};

function browserLocale(): Locale {
  const cookie = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))?.[1];
  // As the server does for a signed-out visitor (i18n/request.ts); the browser has no country to go by.
  if (isLocale(cookie)) return cookie;
  return (cookie && UI_ALIAS[cookie]) || browserUiLocale(navigator.languages.join(","), null);
}

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useSyncExternalStore(subscribe, browserLocale, (): Locale => DEFAULT_LOCALE);
  const t = TEXT[locale];
  return (
    <html lang={locale}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f6fb", color: "#16123a" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{t.title}</h1>
            <p style={{ color: "#5b5878", margin: "0 0 20px" }}>{t.body}</p>
            <button type="button" onClick={reset} style={{ height: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {t.retry}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
