import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronDown, Globe } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { ForgetButton, LandingTour } from "@/components/site/landing-tour";
import { countryOptions, loadLanding, loadSiteData } from "@/server/landing";
import { LOCALE_NAMES, SITE_LOCALES, isLocale, isSiteLocale, type SiteLocale } from "@/i18n/config";

export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLocale(lang)) return {};
  const { copy } = await loadLanding(lang);
  return {
    title: { absolute: copy.seo.title },
    description: copy.seo.description,
    alternates: {
      canonical: `/${lang}`,
      languages: { ...Object.fromEntries(SITE_LOCALES.map((l) => [l, `/${l}`])), "x-default": "/" },
    },
    openGraph: {
      title: copy.seo.ogTitle,
      description: copy.seo.ogDescription,
      type: "website",
      locale: lang,
      url: `/${lang}`,
      siteName: "Cyclowareness",
      images: [{ url: `/og/${lang}`, width: 1200, height: 630, alt: copy.seo.ogTitle }],
    },
    twitter: { card: "summary_large_image", title: copy.seo.ogTitle, description: copy.seo.ogDescription, images: [`/og/${lang}`] },
  };
}

export default async function LandingPage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isSiteLocale(lang)) notFound();
  const [{ copy, guide, fallback }, site] = await Promise.all([loadLanding(lang as SiteLocale), loadSiteData()]);
  const legal = await getTranslations({ locale: isLocale(lang) ? lang : "en", namespace: "site.legal" });
  const hasContact = !!(site.contact.email || site.contact.phone);

  return (
    <div className="relative min-h-dvh bg-canvas pb-40">
      <a href="#hero" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-pill focus:bg-surface focus:px-4 focus:py-2 focus:shadow-raised">
        {copy.tour.chapters.hero}
      </a>
      <header className="sticky top-0 z-20 border-b border-transparent bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-[calc(var(--safe-top)+0.75rem)] pb-3 sm:px-8">
          <BrandMark href={`/${lang}`} label={copy.ui.home} />
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-pill px-3 text-caption font-semibold hover:bg-sunken [&::-webkit-details-marker]:hidden" aria-label={copy.ui.language}>
                <Globe className="size-4" />
                {lang.toUpperCase()}
                <ChevronDown className="size-3.5 text-ink-subtle" />
              </summary>
              <ul className="absolute right-0 mt-2 grid w-48 gap-0.5 rounded-xl bg-surface p-1.5 shadow-overlay ring-1 ring-line">
                {SITE_LOCALES.map((l) => (
                  <li key={l}>
                    <a href={`/${l}`} hrefLang={l} lang={l} aria-current={l === lang ? "page" : undefined} className="flex items-center justify-between rounded-md px-3 py-2 text-caption hover:bg-sunken aria-[current=page]:font-bold">
                      {LOCALE_NAMES[l]}
                      <span className="text-tab text-ink-subtle">{l.toUpperCase()}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
            <Link href="/sign-in" className="h-10 content-center rounded-pill px-4 text-caption font-semibold text-ink hover:bg-sunken">
              {copy.ui.signIn}
            </Link>
          </div>
        </div>
      </header>

      {fallback ? <p className="mx-auto max-w-6xl px-4 pt-3 text-caption text-ink-muted sm:px-8">{copy.ui.fallbackNote}</p> : null}

      <main id="main" lang={lang}>
        <LandingTour copy={copy} guide={guide} lang={lang} countries={countryOptions(lang)} privacyLabel={legal("privacy")} />

        <section aria-labelledby="faq-title" className="px-4 py-20 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-title" className="text-center font-display text-headline font-bold">
              {copy.faq.title}
            </h2>
            <div className="mt-10 grid gap-3">
              {copy.faq.items.map((f) => (
                <details key={f.id} className="group rounded-2xl bg-surface p-5 shadow-xs ring-1 ring-line open:shadow-raised">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body font-semibold [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <ChevronDown className="size-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-body-sm text-ink-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {site.partners.length ? (
          <section aria-labelledby="partners-title" className="px-4 py-16 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <h2 id="partners-title" className="text-center font-display text-headline font-bold">
                {copy.ui.partnersLabel}
              </h2>
              <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                {site.partners.map((p) => (
                  <li key={p.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- logos of any size, served from /brand/ */}
                    <img src={p.logo} alt={p.name} className="h-10 w-auto object-contain" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {site.testimonials.length ? (
          <section aria-labelledby="testimonials-title" className="px-4 py-16 sm:px-8">
            <div className="mx-auto max-w-6xl">
              <h2 id="testimonials-title" className="text-center font-display text-headline font-bold">
                {copy.ui.testimonialsLabel}
              </h2>
              <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {site.testimonials.map((q) => (
                  <figure key={`${q.author}-${q.org}`} className="rounded-2xl bg-surface p-5 shadow-xs ring-1 ring-line">
                    <blockquote className="text-body-sm text-ink">{q.quote}</blockquote>
                    <figcaption className="mt-3 text-caption text-ink-muted">
                      {q.author} · {q.org}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1">
            <BrandMark href={`/${lang}`} label={copy.ui.home} />
            <p className="text-caption text-ink-muted">{copy.ui.footer}</p>
            {hasContact || site.social.length || site.regNo ? (
              <dl className="mt-3 grid gap-1.5 text-caption">
                {hasContact ? (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-ink">{copy.ui.contactLabel}</dt>
                    <dd className="flex flex-wrap gap-x-3 text-ink-muted">
                      {site.contact.email ? (
                        <a href={`mailto:${site.contact.email}`} className="hover:text-ink">
                          {site.contact.email}
                        </a>
                      ) : null}
                      {site.contact.phone ? (
                        <a href={`tel:${site.contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-ink">
                          {site.contact.phone}
                        </a>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {site.social.length ? (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-ink">{copy.ui.socialLabel}</dt>
                    <dd className="flex flex-wrap gap-x-3 text-ink-muted">
                      {site.social.map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener" className="hover:text-ink">
                          {s.name}
                        </a>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {site.regNo ? (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-ink">{copy.ui.regNoLabel}</dt>
                    <dd className="text-ink-muted tabular-nums">{site.regNo}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-caption">
            <Link href="/legal/privacy" className="text-ink-muted hover:text-ink">
              {legal("privacy")}
            </Link>
            <Link href="/legal/terms" className="text-ink-muted hover:text-ink">
              {legal("terms")}
            </Link>
            <ForgetButton label={copy.ui.forget} done={copy.ui.forgotten} />
          </nav>
        </div>
      </footer>
    </div>
  );
}
