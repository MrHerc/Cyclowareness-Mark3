"use client";

import { type ReactNode, use } from "react";
import { useLocale } from "next-intl";
import { azNumbersReady } from "@/i18n/az-numbers";

/**
 * Renders its children once the browser formats Azerbaijani and Georgian numbers like the server does
 * (i18n/az-numbers.ts). On an az or ka page in a browser without the data, the first render waits for the
 * polyfill chunk. There is deliberately no Suspense boundary here: Next hydrates inside a transition,
 * so React keeps the server's HTML on screen and resumes hydration when the chunk arrives (a language
 * switch through router.refresh() keeps the old page meanwhile), and server rendering, streaming and
 * status codes are untouched. Place it inside every NextIntlClientProvider whose locale can be az or ka,
 * around everything that provider renders.
 */
export function AzNumbersGate({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const ready = locale === "az" || locale === "ka" ? azNumbersReady() : null;
  if (ready) use(ready);
  return children;
}
