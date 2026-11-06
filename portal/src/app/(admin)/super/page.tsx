import { and, asc, eq, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { Globe2 } from "lucide-react";
import { requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleCounts } from "@/server/queries/platform-metrics";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { PageHeader, TabsNav } from "@/components/ui/layout";
import { NewTenant, TenantControls } from "@/components/admin/platform-client";
import { ALL_FEATURES, featuresFor } from "@/lib/tenant-defaults";

export async function generateMetadata() {
  const tr = await getTranslations("admin.platform");
  return { title: tr("title") };
}

export default async function OperatorTenantsPage() {
  const v = await requirePermission("platform.manage");
  const [tr, format] = await Promise.all([getTranslations("admin.platform"), getFormatter()]);
  const [tenants, counts, admins] = await Promise.all([
    db().select().from(t.tenants).orderBy(asc(t.tenants.name)),
    peopleCounts(),
    db()
      .select({ id: t.users.id, tenantId: t.users.tenantId, name: t.users.name, email: t.users.email })
      .from(t.users)
      .where(and(eq(t.users.role, "tenant_admin"), inArray(t.users.status, ["active", "invited"])))
      .orderBy(asc(t.users.name)),
  ]);
  const allFeatures = [...ALL_FEATURES] as string[];

  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} icon={<Globe2 />} actions={<NewTenant />} />
      <TabsNav
        items={[
          { href: "/super", label: tr("tabs.tenants"), active: true, count: tenants.length },
          { href: "/super/metrics", label: tr("tabs.metrics"), active: false },
          { href: "/super/demo", label: tr("tabs.demo"), active: false },
        ]}
      />
      <ul className="grid gap-3">
        {tenants.map((x) => {
          const overrides = x.features ?? {};
          const effective = featuresFor(x.plan, overrides);
          return (
            <li key={x.id}>
              <Card>
                <CardBody className="grid gap-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-semibold">
                        {x.name} {x.id === v.tenant.id ? <Pill className="ms-1">{tr("you")}</Pill> : null}
                      </p>
                      <p className="mt-1 text-caption text-ink-muted">
                        <span className="font-mono">{x.slug}</span>
                        {x.domain ? ` · ${x.domain}` : ""} · {tr("people", { count: counts.get(x.id)?.active ?? 0 })} · {tr("created", { date: format.dateTime(x.createdAt, { dateStyle: "medium" }) })}
                      </p>
                    </div>
                    <Pill tone="brand">{tr(`plans.${x.plan}`)}</Pill>
                    {Object.keys(overrides).length ? <Pill tone="warn">{tr("overridesCount", { count: Object.keys(overrides).length })}</Pill> : null}
                  </div>
                  <p className="text-tab text-ink-subtle">
                    {tr("features")}: {effective.size} / {allFeatures.length}
                  </p>
                  <TenantControls
                    tenantId={x.id}
                    name={x.name}
                    domain={x.domain}
                    domainVerifiedAt={x.domainVerifiedAt?.toISOString() ?? null}
                    plan={x.plan}
                    overrides={overrides}
                    planFeatures={[...featuresFor(x.plan)]}
                    allFeatures={allFeatures}
                    admins={admins.filter((a) => a.tenantId === x.id).map((a) => ({ id: a.id, name: a.name, email: a.email }))}
                  />
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
