import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BrandMark } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LOCALES, LOCALE_NAMES, isLocale, langAttrs } from "@/i18n/config";
import { Markdown, headingsOf } from "@/lib/markdown";

const DOCS = ["privacy", "terms"] as const;
type Doc = (typeof DOCS)[number];

export const dynamicParams = false;
export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

/** The binding text of each document; other languages are added as content/legal/{doc}.{locale}.md. */
async function load(doc: Doc, locale: string): Promise<{ source: string; lang: string; version: string | null; effective: string | null }> {
  const dir = path.join(process.cwd(), "content", "legal");
  for (const lang of [locale, "az"]) {
    try {
      const source = await readFile(path.join(dir, `${doc}.${lang}.md`), "utf8");
      const meta = /<!--\s*version:\s*(\d+);\s*effective:\s*(\d{4}-\d{2}-\d{2})\s*-->/.exec(source);
      return { source, lang, version: meta?.[1] ?? null, effective: meta?.[2] ?? null };
    } catch {
      /* try the next language */
    }
  }
  notFound();
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const tr = await getTranslations("site.legal");
  return { title: tr(doc === "terms" ? "terms" : "privacy"), alternates: { canonical: `/legal/${doc}` } };
}

export default async function LegalPage({ params, searchParams }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!DOCS.includes(doc as Doc)) notFound();
  const sp = await searchParams;
  const locale = await getLocale();
  // The text's language is chosen on the page (AZ / EN / RU), independently of the interface language.
  const want = typeof sp.lang === "string" && isLocale(sp.lang) ? sp.lang : locale;
  const [tr, format] = await Promise.all([getTranslations("site.legal"), getFormatter()]);
  const d = await load(doc as Doc, want);
  const toc = headingsOf(d.source).filter((h) => h.level === 2);
  const title = /^#\s+(.+)$/m.exec(d.source)?.[1] ?? tr(doc === "terms" ? "terms" : "privacy");
  // Intro paragraph (between the title and the first section) sits in the header; the sections follow the contents.
  const body = d.source.replace(/\r/g, "").replace(/^<!--[\s\S]*?-->\s*/, "");
  const firstSection = body.search(/^## /m);
  const intro = (firstSection === -1 ? body : body.slice(0, firstSection)).replace(/^#\s+.+$/m, "").trim();
  const rest = firstSection === -1 ? "" : body.slice(firstSection);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-[calc(var(--safe-top)+0.75rem)] pb-3 sm:gap-4 sm:px-8">
          {/* As on the landing header: the switcher never shrinks; the wordmark wraps away (clipped by h-8) before the page scrolls sideways. */}
          <BrandMark className="h-8 min-w-0 flex-wrap overflow-hidden" />
          <LanguageSwitcher />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <div className="grid max-w-3xl gap-4">
          {d.version && d.effective ? (
            <p className="text-caption text-ink-muted">
              {tr("version", { version: d.version, date: format.dateTime(new Date(`${d.effective}T12:00:00`), { day: "2-digit", month: "2-digit", year: "numeric" }) })}
            </p>
          ) : null}
          {/* A word longer than a phone's line (Georgian "კონფიდენციალურობის") wraps instead of widening the page. */}
          <h1 {...langAttrs(d.lang)} className="font-display text-headline font-bold wrap-break-word">
            {title}
          </h1>
          {intro ? (
            <div {...langAttrs(d.lang)}>
              <Markdown source={intro} />
            </div>
          ) : null}
          <nav aria-label={tr("language")}>
            <ul className="flex flex-wrap gap-2">
              {LOCALES.map((l) => (
                <li key={l}>
                  <a
                    href={`/legal/${doc}?lang=${l}`}
                    hrefLang={l}
                    {...langAttrs(l)}
                    aria-current={l === want ? "page" : undefined}
                    className="inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-caption ring-1 ring-line hover:bg-sunken aria-[current=page]:bg-brand-50 aria-[current=page]:font-bold pointer-coarse:min-h-11"
                  >
                    {LOCALE_NAMES[l]} <span className="text-tab text-ink-subtle">{l.toUpperCase()}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {want !== "az" ? (
            <p {...langAttrs(locale)} className="rounded-lg bg-brand-50 px-4 py-3 text-caption text-brand-700">
              {/* The az text is binding: say so on a translation, or that az is shown because there is none yet. */}
              {tr(d.lang === "az" ? "onlyAz" : "translation")}
            </p>
          ) : null}
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label={tr("contents")} className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-2 text-tab font-bold tracking-wider text-ink-subtle uppercase">{tr("contents")}</p>
            <ol {...langAttrs(d.lang)} className="grid gap-1 text-caption">
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="flex items-center rounded-md px-2 py-1.5 text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:min-h-11">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article {...langAttrs(d.lang)} className="min-w-0">
            <Markdown source={rest} />
          </article>
        </div>
      </div>
    </div>
  );
}
