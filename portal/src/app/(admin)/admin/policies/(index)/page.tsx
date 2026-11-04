import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { ChevronRight, FileText } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { NewPolicy } from "@/components/admin/policy-client";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("policies") };
}

export default async function PoliciesPage({ searchParams }: PageProps<"/admin/policies">) {
  const v = await requirePermission("policies.read");
  const sp = await searchParams;
  const tab = sp.tab === "archived" || sp.tab === "all" ? sp.tab : "active";
  const [tr, tc, format] = await Promise.all([getTranslations("admin.policies"), getTranslations("common"), getFormatter()]);
  const [policies, versions, people] = await Promise.all([
    db().select().from(t.policies).where(eq(t.policies.tenantId, v.tenant.id)).orderBy(desc(t.policies.createdAt)),
    db()
      .select({ id: t.policyVersions.id, policyId: t.policyVersions.policyId, version: t.policyVersions.version, publishedAt: t.policyVersions.publishedAt, signed: count(t.policySignoffs.id) })
      .from(t.policyVersions)
      .innerJoin(t.policies, eq(t.policies.id, t.policyVersions.policyId))
      .leftJoin(t.policySignoffs, eq(t.policySignoffs.versionId, t.policyVersions.id))
      .where(eq(t.policies.tenantId, v.tenant.id))
      .groupBy(t.policyVersions.id)
      .orderBy(desc(t.policyVersions.version)),
    db().select({ n: count() }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin"))),
  ]);
  const latest = new Map<string, (typeof versions)[number]>();
  for (const ver of versions) if (!latest.has(ver.policyId)) latest.set(ver.policyId, ver);
  const total = Number(people[0].n);
  const list = policies.filter((p) => (tab === "all" ? true : tab === "archived" ? !!p.archivedAt : !p.archivedAt));
  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={tr("count", { count: policies.filter((p) => !p.archivedAt).length })} actions={allowed(v, "policies.write") ? <NewPolicy /> : null} />
      <TabsNav
        items={(["active", "archived", "all"] as const).map((k) => ({
          href: `?tab=${k}`,
          label: tr(k),
          active: tab === k,
          count: policies.filter((p) => (k === "all" ? true : k === "archived" ? !!p.archivedAt : !p.archivedAt)).length,
        }))}
      />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((p) => {
            const ver = latest.get(p.id);
            const signed = Number(ver?.signed ?? 0);
            return (
              <li key={p.id}>
                <Link href={`/admin/policies/${p.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-raised">
                  <span className="grid size-11 place-items-center rounded-md bg-brand-50 text-brand-600">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold">{p.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-tab text-ink-muted">
                      {ver ? <Pill tone="brand">{tr("version", { version: ver.version })}</Pill> : null}
                      {ver?.publishedAt ? tr("published", { date: format.dateTime(ver.publishedAt, { dateStyle: "medium" }) }) : tr("notPublished")}
                    </div>
                  </div>
                  {ver ? (
                    <div className="flex w-60 items-center gap-2">
                      <span className="shrink-0 text-tab text-ink-muted">{tr("signedOf", { signed, total })}</span>
                      <ProgressBar decorative value={total ? (signed / total) * 100 : 0} size="sm" />
                      <span className="text-tab font-bold">{tc("units.percent", { value: format.number(total ? Math.round((signed / total) * 100) : 0) })}</span>
                    </div>
                  ) : null}
                  <ChevronRight className="size-5 text-ink-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<FileText />} title={tr("empty")} />
        </Card>
      )}
    </div>
  );
}
