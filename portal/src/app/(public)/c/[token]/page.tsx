import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { db, t } from "@/server/db";
import { getViewer } from "@/server/auth/viewer";
import { appUrl } from "@/server/env";
import { DEFAULT_CERTIFICATE_TEXT, withDefaults } from "@/lib/tenant-defaults";
import { pick } from "@/i18n/config";
import { brandStyle } from "@/lib/color";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function CertificatePage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  if (!/^[a-z2-7]{10,40}$/.test(token)) notFound();
  const [row] = await db()
    .select({ cert: t.certificates, user: { id: t.users.id, name: t.users.name, status: t.users.status }, tenant: t.tenants, moduleTitle: t.modules.title, pathTitle: t.learningPaths.title })
    .from(t.certificates)
    .innerJoin(t.users, eq(t.users.id, t.certificates.userId))
    .innerJoin(t.tenants, eq(t.tenants.id, t.certificates.tenantId))
    .leftJoin(t.modules, eq(t.modules.id, t.certificates.moduleId))
    .leftJoin(t.learningPaths, eq(t.learningPaths.id, t.certificates.pathId))
    .where(eq(t.certificates.publicToken, token));
  if (!row || row.user.status === "deleted") notFound();
  const settings = withDefaults(row.tenant.settings);
  const viewer = await getViewer();
  const own = viewer?.user.id === row.user.id || (viewer?.tenant.id === row.tenant.id && viewer.user.role !== "learner");
  if (!settings.certificate.publicLink && !own) notFound();

  const locale = await getLocale();
  const [tr, format] = await Promise.all([getTranslations("learner.certificate"), getFormatter()]);
  const c = settings.certificate;
  const title = c.title || tr("title");
  const subject = pick(row.moduleTitle ?? row.pathTitle, locale);
  const date = format.dateTime(row.cert.issuedAt, { dateStyle: "long" });
  const template = (c.text && c.text.trim()) || pick(DEFAULT_CERTIFICATE_TEXT, locale);
  const text = template.replaceAll("{name}", row.user.name).replaceAll("{module}", subject).replaceAll("{date}", date);
  const verifyUrl = `${appUrl()}/c/${token}`;

  return (
    <div className="min-h-dvh bg-canvas px-4 py-10 print:bg-white print:p-0" style={brandStyle(row.tenant.branding.primary, row.tenant.branding.accent) as React.CSSProperties}>
      <div className="mx-auto max-w-4xl">
        <article className="relative flex overflow-hidden rounded-2xl border border-line bg-surface shadow-overlay print:rounded-none print:border-0 print:shadow-none">
          <div aria-hidden className="flex w-4 shrink-0 flex-col sm:w-6">
            <div className="flex-[3] bg-brand-600" />
            <div className="flex-1 bg-reward-500" />
          </div>
          <div className="relative flex-1 p-8 sm:p-14">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-3">
                {row.tenant.branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.tenant.branding.logoUrl} alt="" className="h-12 w-auto max-w-56 object-contain" />
                ) : null}
                <span className="text-body-sm font-semibold text-ink-muted">{row.tenant.name}</span>
              </div>
              <span className="grid size-20 shrink-0 place-items-center rounded-full bg-reward-500 text-(--accent-on) shadow-raised ring-8 ring-reward-100">
                <ShieldCheck className="size-10" />
              </span>
            </div>
            <p className="mt-8 text-caption font-bold tracking-[0.3em] text-brand-600 uppercase">{title}</p>
            <h1 className="mt-3 font-display text-[clamp(2.25rem,1.5rem+3vw,4rem)] leading-none font-bold tracking-tight text-balance">{row.user.name}</h1>
            <span aria-hidden className="mt-5 block h-1.5 w-20 rounded-pill bg-reward-500" />
            <p className="mt-6 max-w-2xl text-lead text-ink-muted">{text}</p>
            <p className="mt-6 inline-flex rounded-pill bg-brand-50 px-4 py-2 text-body-sm font-semibold text-brand-700">
              {row.moduleTitle ? tr("module") : tr("path")}: {subject}
            </p>
            <dl className="mt-10 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
              <div>
                <dt className="text-tab-sm font-bold tracking-wide text-ink-subtle uppercase">{tr("issued")}</dt>
                <dd className="mt-1 text-body-sm font-semibold">{date}</dd>
              </div>
              <div>
                <dt className="text-tab-sm font-bold tracking-wide text-ink-subtle uppercase">{tr("serial")}</dt>
                <dd className="mt-1 font-mono text-body-sm font-semibold">{row.cert.serial}</dd>
              </div>
              <div>
                <dt className="text-tab-sm font-bold tracking-wide text-ink-subtle uppercase">{tr("verify")}</dt>
                <dd className="mt-1 font-mono text-tab break-all text-ink-muted">{verifyUrl.replace(/^https?:\/\//, "")}</dd>
              </div>
            </dl>
            {c.signerName ? (
              <div className="mt-8">
                <p className="font-display text-title-sm font-semibold italic">{c.signerName}</p>
                <p className="text-caption text-ink-muted">{c.signerTitle}</p>
              </div>
            ) : null}
          </div>
        </article>
        <div className="mt-6 flex justify-center print:hidden">
          <PrintButton label={tr("print")} />
        </div>
      </div>
    </div>
  );
}
