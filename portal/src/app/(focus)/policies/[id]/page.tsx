import { isUuid } from "@/lib/ids";
import { safePath } from "@/lib/safe-path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { CheckCircle2, X } from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { Pill } from "@/components/ui/pill";
import { Notice } from "@/components/ui/layout";
import { Markdown, headingsOf } from "@/lib/markdown";
import { numericDate } from "@/lib/time";
import { policyTextFor } from "@/lib/policy-text";
import { langAttrs, type Locale } from "@/i18n/config";
import { SignForm } from "./sign-form";

async function load(id: string, tenantId: string) {
  if (!isUuid(id)) return null;
  const [policy] = await db()
    .select()
    .from(t.policies)
    .where(and(eq(t.policies.id, id), eq(t.policies.tenantId, tenantId), isNull(t.policies.archivedAt)));
  if (!policy) return null;
  const [version] = await db()
    .select()
    .from(t.policyVersions)
    .where(and(eq(t.policyVersions.policyId, id), isNotNull(t.policyVersions.publishedAt)))
    .orderBy(desc(t.policyVersions.version))
    .limit(1);
  return version ? { policy, version } : null;
}

export async function generateMetadata({ params }: PageProps<"/policies/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  const data = await load(id, v.tenant.id);
  const locale = await getLocale();
  // The tab title follows the text the page shows: the translation when there is one.
  return { title: data ? policyTextFor(data.version, locale, v.tenant.settings.defaultLocale).title : "" };
}

export default async function PolicyReader({ params, searchParams }: PageProps<"/policies/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await requireViewer();
  const data = await load(id, v.tenant.id);
  if (!data) notFound();
  const locale = await getLocale();
  const [tr, tp, tc, format] = await Promise.all([getTranslations("learner.policy"), getTranslations("player.policy"), getTranslations("common"), getFormatter()]);
  const { version } = data;
  // The reader's language when the version has it, else the base text in the language it was written in.
  const { title, bodyMd: body, summary, lang: shownLanguage } = policyTextFor(version, locale, v.tenant.settings.defaultLocale);
  // The policy text in another language than the page (no translation yet) carries its own `lang`.
  const textLang = shownLanguage !== locale ? shownLanguage : undefined;
  const textAttrs = textLang ? langAttrs(textLang) : {};
  const toc = headingsOf(body);
  // Where the close button goes back to; "/" from older notifications is the public site, so it becomes /app.
  const from = safePath(sp.from);
  const [signed] = await db()
    .select({ at: t.policySignoffs.signedAt })
    .from(t.policySignoffs)
    .where(and(eq(t.policySignoffs.userId, v.user.id), eq(t.policySignoffs.versionId, version.id)));
  const [user] = await db().select({ hash: t.users.passwordHash }).from(t.users).where(eq(t.users.id, v.user.id));

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 pt-(--safe-top) backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link href={from} aria-label={tc("close")} className="grid size-10 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink">
            <X className="size-5" />
          </Link>
          <p {...textAttrs} className="truncate text-body-sm font-semibold">
            {title}
          </p>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="protected mx-auto w-full max-w-(--container-reading)">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">{tr("version", { version: version.version })}</Pill>
            {version.publishedAt ? <span className="text-caption text-ink-muted">{tr("published", { date: numericDate(version.publishedAt, v.tenant.settings.timeZone) })}</span> : null}
          </div>
          <h1 {...textAttrs} className="mt-4 text-headline font-bold text-balance">
            {title}
          </h1>
          {summary ? (
            <p {...textAttrs} className="mt-3 text-lead text-ink-muted">
              {summary}
            </p>
          ) : null}
          {textLang ? (
            <Notice tone="info" className="mt-5">
              {tp("otherLanguage", { language: tp(`language.${shownLanguage as Locale}`) })}
            </Notice>
          ) : null}
          <div {...textAttrs} className="mt-8">
            <Markdown source={body} skipTitle />
          </div>

          <section className="mt-12 rounded-2xl border border-line bg-surface p-6 shadow-raised" aria-labelledby="signature">
            <h2 id="signature" className="text-title font-bold">
              {tr("signature")}
            </h2>
            {signed ? (
              <p className="mt-4 flex items-center gap-2 text-body-sm font-semibold text-safe-700">
                <CheckCircle2 className="size-5" />
                {tp("signed", { version: version.version, date: format.dateTime(signed.at, { dateStyle: "medium", timeStyle: "short" }) })}
              </p>
            ) : (
              <div className="mt-4">
                <SignForm versionId={version.id} needsPassword={!!user?.hash} />
              </div>
            )}
          </section>
        </article>
        {toc.length > 2 ? (
          <nav aria-label={tr("contents")} className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-2 text-caption font-semibold text-ink-muted">{tr("contents")}</p>
              <ol {...textAttrs} className="grid gap-1 text-caption">
                {toc
                  .filter((h) => h.level === 2)
                  .map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="flex items-center rounded-md px-2 py-1 text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:min-h-11">
                        {h.text}
                      </a>
                    </li>
                  ))}
              </ol>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
