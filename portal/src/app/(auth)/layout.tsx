import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { VENDOR } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { textLinkClass } from "@/components/ui/button";
import { BrandPanel } from "./brand-panel";

/**
 * Sign-in pages: the brand panel beside the form from lg, a band above it on phones (the card overlaps the
 * band's lower edge). One language switcher sits top right over both layouts.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="relative flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <LanguageSwitcher className="absolute top-[calc(var(--safe-top)+1.25rem)] right-5 z-20 shadow-xs sm:right-8 lg:top-8 lg:right-10" />

      <div className="relative flex flex-1 flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_28rem_at_85%_-10%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent),radial-gradient(36rem_22rem_at_0%_110%,color-mix(in_oklab,var(--accent)_8%,transparent),transparent)] max-lg:hidden" />
        <main id="main" className="relative z-10 -mt-10 flex flex-1 justify-center px-4 pb-8 sm:px-8 lg:mt-0 lg:items-center lg:px-12 lg:py-24">
          <div className="w-full max-w-[27rem] animate-reveal">{children}</div>
        </main>
        <footer className="relative grid justify-items-center gap-3 px-4 pb-[calc(var(--safe-bottom)+1.25rem)] text-caption text-ink-subtle">
          {/* On phones the vendor's wordmark moves here from the brand panel. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/safarov-industries-wordmark-sm.png" alt={VENDOR} width={480} height={50} className="h-3.5 w-auto opacity-80 lg:hidden" />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/legal/terms" className={textLinkClass("whitespace-nowrap hover:text-ink")}>
              {t("footer.terms")}
            </Link>
            <span aria-hidden className="max-sm:hidden">
              ·
            </span>
            <Link href="/legal/privacy" className={textLinkClass("whitespace-nowrap hover:text-ink")}>
              {t("footer.privacy")}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
