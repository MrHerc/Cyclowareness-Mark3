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
import { LOCALE_NAMES, type SiteLocale } from "@/i18n/config";
import { numericDate } from "@/lib/time";
import { SignForm } from "./sign-form";

async function load(id: string, tenantId: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
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
  return { title: data?.version.title ?? "" };
}

export default async function PolicyReader({ params, searchParams }: PageProps<"/policies/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const v = await requireViewer();
  const data = await load(id, v.tenant.id);
  if (!data) notFound();
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("learner.policy"), getTranslations("common"), getFormatter()]);
  const { version } = data;
  const translated = locale !== "az" ? version.translations?.[locale] : undefined;
  // The base text is the organisation's default language (Azerbaijani for this tenant).
  const title = translated?.title ?? version.title;
  const body = translated?.bodyMd ?? version.bodyMd;
  const summary = translated?.summary ?? version.summary;
  const shownLanguage = translated ? locale : "az";
  const toc = headingsOf(body);
  const from = typeof sp.from === "string" && sp.from.startsWith("/") && !sp.from.startsWith("//") ? sp.from : "/";
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
          <p className="truncate text-body-sm font-semibold">{title}</p>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="protected mx-auto w-full max-w-(--container-reading)">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="brand">{tr("version", { version: version.version })}</Pill>
            {version.publishedAt ? <span className="text-caption text-ink-muted">{tr("published", { date: numericDate(version.publishedAt) })}</span> : null}
          </div>
          <h1 className="mt-4 text-headline font-bold text-balance">{title}</h1>
          {summary ? <p className="mt-3 text-lead text-ink-muted">{summary}</p> : null}
          {shownLanguage !== locale ? (
            <Notice tone="info" className="mt-5">
              {tr("otherLanguage", { language: LOCALE_NAMES[shownLanguage as SiteLocale] })}
            </Notice>
          ) : null}
          <div className="mt-8">
            <Markdown source={body} skipTitle />
          </div>

          <section className="mt-12 rounded-2xl border border-line bg-surface p-6 shadow-raised" aria-labelledby="signature">
            <h2 id="signature" className="text-title font-bold">
              {tr("signature")}
            </h2>
            {signed ? (
              <p className="mt-4 flex items-center gap-2 text-body-sm font-semibold text-safe-700">
                <CheckCircle2 className="size-5" />
                {tr("signed", { version: version.version, date: format.dateTime(signed.at, { dateStyle: "medium", timeStyle: "short" }) })}
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
              <ol className="grid gap-1 text-caption">
                {toc
                  .filter((h) => h.level === 2)
                  .map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="block rounded-md px-2 py-1 text-ink-muted hover:bg-sunken hover:text-ink">
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
