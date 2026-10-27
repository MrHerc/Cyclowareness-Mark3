"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";

/**
 * One polite line when this browser has no voice for `lang` and the lesson has no recorded clips: the text stays
 * silent; Edge has natural voices in every lesson language.
 * The status region stays mounted (empty and visually hidden) so screen readers announce the line when `show` turns on.
 */
export function VoiceNotice({ lang, show, className }: { lang: string; show: boolean; className?: string }) {
  const t = useTranslations("player");
  return (
    <p role="status" className={show ? cn("flex items-start gap-2 text-caption font-semibold text-ink-muted", className) : "sr-only"}>
      {show ? (
        <>
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("voiceMissing", { language: t(`voiceLanguage.${isLocale(lang) ? lang : "en"}`) })}</span>
        </>
      ) : null}
    </p>
  );
}
