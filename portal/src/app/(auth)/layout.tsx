import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { textLinkClass } from "@/components/ui/button";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,color-mix(in_oklab,var(--brand)_14%,transparent),transparent),radial-gradient(40rem_24rem_at_-10%_110%,color-mix(in_oklab,var(--accent)_12%,transparent),transparent)]" />
      <header className="relative flex items-center justify-between gap-3 px-5 pt-[calc(var(--safe-top)+1.25rem)] sm:px-8">
        {/* The switcher never shrinks; the wordmark wraps away (clipped by h-8) before the page scrolls sideways. */}
        <BrandMark className="h-8 min-w-0 flex-wrap overflow-hidden" />
        <LanguageSwitcher />
      </header>
      <main id="main" className="relative grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-[26rem] animate-reveal">{children}</div>
      </main>
      <footer className="relative flex justify-center gap-4 pb-[calc(var(--safe-bottom)+1.25rem)] text-caption text-ink-subtle">
        <Link href="/legal/terms" className={textLinkClass("hover:text-ink")}>
          {t("footer.terms")}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/legal/privacy" className={textLinkClass("hover:text-ink")}>
          {t("footer.privacy")}
        </Link>
      </footer>
    </div>
  );
}
