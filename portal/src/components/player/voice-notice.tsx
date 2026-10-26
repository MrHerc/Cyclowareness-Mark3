"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";

/** One polite line when this browser has no voice for `lang`: the text stays silent; Edge has natural az/ru voices. */
export function VoiceNotice({ lang, className }: { lang: string; className?: string }) {
  const t = useTranslations("player");
  return (
    <p role="status" className={cn("flex items-start gap-2 text-caption font-semibold text-ink-muted", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{t("voiceMissing", { language: t(`voiceLanguage.${isLocale(lang) ? lang : "en"}`) })}</span>
    </p>
  );
}
