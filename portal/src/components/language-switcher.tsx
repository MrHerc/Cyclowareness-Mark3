"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { setLocaleAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{t("language")}</span>
      <Globe aria-hidden className="pointer-events-none absolute left-3 size-4 text-ink-muted" />
      <select
        value={locale}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setLocaleAction(e.target.value);
            router.refresh();
          })
        }
        className="h-9 cursor-pointer appearance-none rounded-pill border border-line bg-surface pr-4 pl-9 text-caption font-semibold text-ink hover:bg-sunken"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]} · {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
