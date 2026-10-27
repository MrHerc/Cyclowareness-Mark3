"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_NAMES, langAttrs, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

/**
 * Interface language picker. The visible face is drawn by us (globe + code on phones, the full
 * name from sm up) so it never pushes a header past 320 px; the native select sits transparently
 * on top of it, so the options, keyboard handling and accessible name stay the platform's.
 * `locales`: the languages the organisation has switched on (Settings → Languages) for a signed-in
 * person; every interface language when signed out.
 */
export function LanguageSwitcher({ className, locales = LOCALES }: { className?: string; locales?: readonly string[] }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations("auth");
  const [pending, start] = useTransition();
  return (
    <label
      className={cn(
        "relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border border-line bg-surface px-3 text-caption font-semibold whitespace-nowrap text-ink hover:bg-sunken has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-brand-600 has-[select:disabled]:opacity-60 sm:pe-4 pointer-coarse:h-11",
        className,
      )}
    >
      <Globe aria-hidden className="size-4 text-ink-muted" />
      <span aria-hidden>
        <span className="sm:hidden">{locale.toUpperCase()}</span>
        <span className="hidden sm:inline">
          {LOCALE_NAMES[locale]} · {locale.toUpperCase()}
        </span>
      </span>
      <select
        aria-label={t("language")}
        value={locale}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setLocaleAction(e.target.value);
            router.refresh();
          })
        }
        className="absolute -inset-px cursor-pointer appearance-none rounded-pill opacity-0"
      >
        {LOCALES.filter((l) => l === locale || locales.includes(l)).map((l) => (
          <option key={l} value={l} {...langAttrs(l)}>
            {LOCALE_NAMES[l]} · {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
