import { getFormatter, getTranslations } from "next-intl/server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { CheckCircle2, Circle, Download } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed } from "@/server/auth/viewer";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, TabsNav } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PolicyHeaderActions, VersionEditor } from "@/components/admin/policy-client";
import { policyForPage } from "./policy";

export default async function PolicyAdminPage({ params, searchParams }: PageProps<"/admin/policies/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { v, policy } = await policyForPage(id);
  const [tr, tc, format] = await Promise.all([getTranslations("admin.policies"), getTranslations("common"), getFormatter()]);
  const tab = sp.tab === "signoffs" ? "signoffs" : "versions";
  const versions = await db().select().from(t.policyVersions).where(eq(t.policyVersions.policyId, id)).orderBy(desc(t.policyVersions.version));
  const current = versions[0] ?? null;
  // The sign-offs tab can show any version (from its card); it defaults to the current one.
  const shown = versions.find((x) => x.id === sp.version) ?? current;
  // What learners open from "View": the newest published version.
  const readable = versions.find((x) => x.publishedAt) ?? null;
  const [people, counts, signoffs] = await Promise.all([
    db().select({ id: t.users.id, name: t.users.name, email: t.users.email, avatarUrl: t.users.avatarUrl }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"))),
    versions.length
      ? db()
          .select({ versionId: t.policySignoffs.versionId, n: count() })
          .from(t.policySignoffs)
          .where(inArray(t.policySignoffs.versionId, versions.map((x) => x.id)))
          .groupBy(t.policySignoffs.versionId)
      : Promise.resolve([]),
    shown ? db().select().from(t.policySignoffs).where(eq(t.policySignoffs.versionId, shown.id)) : Promise.resolve([]),
  ]);
  const signedByVersion = new Map(counts.map((c) => [c.versionId, Number(c.n)]));
  const signedBy = new Map(signoffs.map((s) => [s.userId, s]));
  const canWrite = allowed(v, "policies.write");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader
        title={policy.title}
        subtitle={tr("created", { date: format.dateTime(policy.createdAt, { dateStyle: "medium" }) })}
        back={{ href: "/admin/policies", label: tr("allPolicies") }}
        actions={canWrite ? <PolicyHeaderActions policyId={policy.id} archived={!!policy.archivedAt} versionId={current?.id ?? null} /> : null}
      />
      <TabsNav
        items={[
          { href: "?tab=versions", label: tr("versions"), active: tab === "versions", count: versions.length },
          { href: "?tab=signoffs", label: tr("signoffs"), active: tab === "signoffs", count: signoffs.length },
        ]}
      />
      {tab === "versions" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {canWrite ? (
            <Card>
              <CardHeader title={tr("newVersion", { version: (current?.version ?? 0) + 1 })} />
              <CardBody>
                <VersionEditor
                  policyId={policy.id}
                  nextVersion={(current?.version ?? 0) + 1}
                  initial={{ title: current?.title ?? policy.title, summary: current?.summary ?? "", bodyMd: current?.bodyMd ?? `# ${policy.title}\n\n## 1. \n`, enTitle: current?.translations?.en?.title ?? "", enBody: current?.translations?.en?.bodyMd ?? "" }}
                />
              </CardBody>
            </Card>
          ) : null}
          <Card className="self-start">
            <CardHeader title={tr("publishedVersions")} />
            <CardBody className="grid gap-3">
              {versions.map((ver, i) => {
                const signed = signedByVersion.get(ver.id) ?? 0;
                const pct = people.length ? Math.round((signed / people.length) * 100) : 0;
                return (
                  <div key={ver.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="brand">{tr("version", { version: ver.version })}</Pill>
                      {i === 0 ? <Pill tone="safe">{tr("current")}</Pill> : null}
                      {ver.bodyMd.trim() ? <Pill>{tr("text")}</Pill> : null}
                      <span className="text-tab text-ink-subtle">{ver.publishedAt ? format.dateTime(ver.publishedAt, { dateStyle: "medium" }) : tr("notPublished")}</span>
                    </div>
                    <p className="mt-2 text-body-sm font-semibold">{ver.title}</p>
                    {ver.summary ? <p className="mt-1 text-caption text-ink-muted">{ver.summary}</p> : null}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="shrink-0 text-tab text-ink-muted">{tr("signedOf", { signed, total: people.length })}</span>
                      <ProgressBar decorative value={pct} size="sm" />
                      <span className="shrink-0 text-tab font-bold tabular-nums">{pct}%</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {ver.id === readable?.id ? (
                        <ButtonLink size="sm" variant="ghost" href={`/policies/${policy.id}?from=/admin/policies/${policy.id}`}>
                          {tc("view")}
                        </ButtonLink>
                      ) : null}
                      <ButtonLink size="sm" variant="ghost" href={`?tab=signoffs&version=${ver.id}`}>
                        {tr("signoffs")}
                      </ButtonLink>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader
            title={tr("signoffs")}
            description={shown ? `${shown.id !== current?.id ? `${tr("version", { version: shown.version })} · ` : ""}${tr("signedOf", { signed: signoffs.length, total: people.length })}` : undefined}
            action={
              current ? (
                <ButtonAnchor href={`/api/admin/policies/${policy.id}/signoffs`} size="sm" variant="secondary" icon={<Download />}>
                  {tr("downloadSignoffs")}
                </ButtonAnchor>
              ) : null
            }
          />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line">
              {people
                .sort((a, b) => Number(signedBy.has(b.id)) - Number(signedBy.has(a.id)) || a.name.localeCompare(b.name))
                .map((p) => {
                  const s = signedBy.get(p.id);
                  return (
                    <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                      <Avatar name={p.name} src={p.avatarUrl} size="sm" className="row-span-2 sm:row-span-1" />
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm font-semibold" title={p.name}>{p.name}</span>
                        <span className="block truncate text-tab text-ink-subtle" title={p.email}>{p.email}</span>
                      </span>
                      {s ? (
                        <span className="col-start-2 inline-flex items-center gap-1.5 whitespace-nowrap text-caption text-safe-700 sm:col-start-3">
                          <CheckCircle2 className="size-4" />
                          {format.dateTime(s.signedAt, { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      ) : (
                        <span className="col-start-2 inline-flex items-center gap-1.5 whitespace-nowrap text-caption text-ink-subtle sm:col-start-3">
                          <Circle className="size-4" />
                          {tr("notSigned")}
                        </span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
