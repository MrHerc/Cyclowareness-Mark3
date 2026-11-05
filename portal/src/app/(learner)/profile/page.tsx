import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { desc, eq, isNotNull } from "drizzle-orm";
import { Award, ChevronRight, FileText, LogOut } from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { getPolicies } from "@/server/queries/learner";
import { twoFactorRequired } from "@/server/auth/permissions";
import { signOutAction } from "@/server/actions/auth";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ButtonLink, buttonClass, textLinkClass } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/layout";
import { LanguageSwitcher } from "@/components/language-switcher";
import { pick } from "@/i18n/config";
import { ChangePassword, DataSection, OtherDevices, Preferences, PhotoEditor, ProblemButton, TourReset, TwoFactor } from "./profile-client";

export async function generateMetadata() {
  const tr = await getTranslations("learner.profile");
  return { title: tr("title") };
}

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const sp = await searchParams;
  const v = await requireViewer();
  const locale = await getLocale();
  const [tr, tc, th, format] = await Promise.all([getTranslations("learner.profile"), getTranslations("common"), getTranslations("learner.home"), getFormatter()]);
  const [policies, certs, dept, problems, [credentials]] = await Promise.all([
    getPolicies(v, locale),
    db()
      .select({ token: t.certificates.publicToken, issuedAt: t.certificates.issuedAt, moduleTitle: t.modules.title, pathTitle: t.learningPaths.title })
      .from(t.certificates)
      .leftJoin(t.modules, eq(t.modules.id, t.certificates.moduleId))
      .leftJoin(t.learningPaths, eq(t.learningPaths.id, t.certificates.pathId))
      .where(eq(t.certificates.userId, v.user.id))
      .orderBy(desc(t.certificates.issuedAt)),
    v.user.departmentId ? db().select({ name: t.departments.name }).from(t.departments).where(eq(t.departments.id, v.user.departmentId)) : Promise.resolve([]),
    db().select().from(t.problemReports).where(eq(t.problemReports.userId, v.user.id)).orderBy(desc(t.problemReports.createdAt)).limit(5),
    // Only people who sign in with a password here can change it (not SSO or phone-only accounts).
    db().select({ hasPassword: isNotNull(t.users.passwordHash) }).from(t.users).where(eq(t.users.id, v.user.id)),
  ]);
  const toSign = policies.filter((p) => !p.signedAt);
  const signed = policies.filter((p) => p.signedAt);
  const required = twoFactorRequired(v.user.role, v.tenant.settings.identity.requireAdmin2fa);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="sr-only">{tr("title")}</h1>
      {sp.required ? (
        <Notice tone="warn" title={tr("twoStep")}>
          {tr("requiredNotice")}
        </Notice>
      ) : null}

      <header>
        <PhotoEditor name={v.user.name} src={v.user.avatarUrl} />
      </header>

      <div>
        <h2 className="mb-2.5 flex items-center gap-2 text-body font-bold text-ink">{tr("certificates")}</h2>
        <Card>
          <CardBody>
            {certs.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {certs.map((c) => (
                  <li key={c.token}>
                    <Link href={`/c/${c.token}`} className="flex items-center gap-3 rounded-lg border border-line p-3.5 hover:bg-sunken">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-reward-500 text-(--accent-on)">
                        <Award className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-semibold">{pick(c.moduleTitle ?? c.pathTitle, locale)}</span>
                        <span className="text-tab text-ink-subtle">{format.dateTime(c.issuedAt, { dateStyle: "medium" })}</span>
                      </span>
                      <ChevronRight className="size-4 text-ink-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Award />} title={tr("noCertificates")} body={tr("noCertificatesBody")} action={<ButtonLink href="/learn">{tr("browse")}</ButtonLink>} />
            )}
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="mb-2.5 flex items-center gap-2 text-body font-bold text-ink">
          {tr("policies")}
          {toSign.length ? <Pill tone="brand">{tr("toSign", { count: toSign.length })}</Pill> : null}
        </h2>
        <div className="grid gap-4">
          {policies.length === 0 ? <p className="text-body-sm text-ink-muted">{tr("noPolicies")}</p> : null}
          {toSign.length ? (
            <div>
              <p className="mb-2 text-caption font-semibold text-ink-muted">{tr("toSignTitle")}</p>
              <ul className="grid gap-2">
                {toSign.map((p) => (
                  <li key={p.versionId}>
                    <Link href={`/policies/${p.policyId}?from=%2Fprofile`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-xs hover:bg-sunken">
                      <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600">
                        <FileText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-semibold">{p.title}</span>
                        <span className="text-tab text-ink-subtle">{th("version", { version: p.version })}</span>
                      </span>
                      <span className="text-caption font-semibold text-brand-600">{th("sign")}</span>
                      <ChevronRight className="size-4 text-ink-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {signed.length ? (
            <div>
              <p className="mb-2 text-caption font-semibold text-ink-muted">{tr("signed")}</p>
              <ul className="grid gap-2">
                {signed.map((p) => (
                  <li key={p.versionId}>
                    <Link href={`/policies/${p.policyId}?from=%2Fprofile`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-xs hover:bg-sunken">
                      <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-safe-50 text-safe-600">
                        <FileText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">{p.title}</span>
                      <span className="text-tab text-ink-subtle">{tr("signedOn", { date: format.dateTime(p.signedAt!, { dateStyle: "medium" }) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="sr-only">{tr("account")}</h2>
        <Card>
          <CardBody className="pb-2 sm:pb-3">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-ink-muted">{tc("email")}</dt>
                <dd className="text-body-sm font-semibold break-all">
                  <bdi>{v.user.email}</bdi>
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-muted">{tr("organization")}</dt>
                <dd className="text-body-sm font-semibold">{v.tenant.name}</dd>
              </div>
              {dept[0] ? (
                <div>
                  <dt className="text-caption text-ink-muted">{tr("department")}</dt>
                  <dd className="text-body-sm font-semibold">{dept[0].name}</dd>
                </div>
              ) : null}
              <div>
                <dt className="mb-1 text-caption text-ink-muted">{tr("language")}</dt>
                <dd>
                  <LanguageSwitcher locales={v.tenant.settings.locales} />
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-line pt-2">
              <TourReset />
            </div>
          </CardBody>
        </Card>
      </div>

      <div id="security">
        <h2 className="mb-2 text-caption text-ink-muted">{tr("security")}</h2>
        <Card>
          <CardBody className="grid gap-5">
            <TwoFactor enabled={v.user.totpEnabled} required={required} />
            {credentials?.hasPassword ? (
              <div className="border-t border-line pt-5">
                <ChangePassword email={v.user.email} name={v.user.name} />
              </div>
            ) : null}
            <div className="border-t border-line pt-5">
              <OtherDevices />
            </div>
          </CardBody>
        </Card>
      </div>

      <div>
        <h2 className="mb-2.5 flex items-center gap-2 text-body font-bold text-ink">{tr("data")}</h2>
        <Card>
          <CardBody>
            <DataSection pendingSince={v.user.deletionRequestedAt ? format.dateTime(v.user.deletionRequestedAt, { dateStyle: "medium" }) : null} />
          </CardBody>
        </Card>
      </div>

      <Preferences soundOn={v.user.soundOn} motion={v.user.motion} timerPref={v.user.timerPref} />

      <div>
        <h2 className="mb-2 text-caption text-ink-muted">{tr("help")}</h2>
        <Card>
          <CardBody className="pt-2 sm:pt-3">
            <ProblemButton />
            <div className="mt-2 border-t border-line pt-4">
              <p className="mb-2 text-body-sm font-semibold text-ink">{tr("myProblems")}</p>
              {problems.length ? (
                <ul className="grid gap-2">
                  {problems.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg bg-sunken px-3.5 py-2.5">
                      <span className="text-caption">{p.message}</span>
                      <Pill tone={p.status === "resolved" ? "safe" : p.status === "new" ? "brand" : "neutral"}>{tr(`problemStatus.${p.status}`)}</Pill>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-ink-muted">{tr("noProblems")}</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <form action={signOutAction} className="flex flex-col items-center gap-4 pb-4">
        <button type="submit" className={buttonClass("secondary", "lg", "w-full")}>
          <LogOut />
          {tr("signOut")}
        </button>
        <p className="flex gap-3 text-caption text-ink-subtle">
          <Link href="/legal/terms" className={textLinkClass("hover:text-ink")}>
            {tc("footer.terms")}
          </Link>
          ·
          <Link href="/legal/privacy" className={textLinkClass("hover:text-ink")}>
            {tc("footer.privacy")}
          </Link>
        </p>
      </form>
    </div>
  );
}
