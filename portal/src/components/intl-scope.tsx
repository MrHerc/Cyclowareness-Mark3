import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { CLIENT_NAMESPACES, pickMessages, type Surface } from "@/i18n/messages";
import { AzNumbersGate } from "@/components/az-numbers-gate";

/**
 * The client provider of a surface (the root layout or a route group's layout) with only the namespaces its
 * client components read, so a page does not carry the whole message catalogue (i18n/messages.ts).
 */
export async function IntlScope({ surface, children }: { surface: Surface; children: ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES[surface])}>
      <AzNumbersGate>{children}</AzNumbersGate>
    </NextIntlClientProvider>
  );
}
