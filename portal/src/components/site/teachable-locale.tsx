import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { isLocale, langAttrs } from "@/i18n/config";
import { loadMessages } from "@/i18n/messages";
import { AzNumbersGate } from "@/components/az-numbers-gate";

/**
 * The teachable moment speaks the recipient's profile language, the language of the simulated
 * message and of its red flags (`trackingView` in server/tracking.ts), not the browser's: someone
 * with an Azerbaijani profile who opens the message on a phone set to English still reads one
 * language. A view without a supported `locale` keeps the request's language.
 */
export async function TeachableLocale({ view, children }: { view: object; children: ReactNode }) {
  const locale = "locale" in view && isLocale(view.locale) ? view.locale : null;
  if (!locale || locale === (await getLocale())) return children;
  const messages = await loadMessages(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={{ site: messages.site, common: messages.common }}>
      <AzNumbersGate>
        <div {...langAttrs(locale)}>{children}</div>
      </AzNumbersGate>
    </NextIntlClientProvider>
  );
}
