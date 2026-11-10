import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, FlaskConical, Zap } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { drillHistory, drillTemplates } from "@/server/services/drill";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { DrillSetup } from "@/components/admin/drill/drill-setup";
import { templateText } from "@/lib/campaigns/templates";
import { DRILL_SIM_MINUTES, percent } from "@/lib/drill/plan";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("drill") };
}

export default async function DrillIndexPage() {
  const v = await requirePermission("campaigns.write");
  if (!hasFeature(v, "live_drill")) notFound();
  const locale = await getLocale();
  const [tr, tc, tcmp, format] = await Promise.all([getTranslations("admin.drill"), getTranslations("common"), getTranslations("admin.campaigns"), getFormatter()]);
  const [departments, [everyone], history] = await Promise.all([
    db().select({ id: t.departments.id, name: t.departments.name, parentId: t.departments.parentId }).from(t.departments).where(eq(t.departments.tenantId, v.tenant.id)).orderBy(t.departments.name),
    db()
      .select({ n: count() })
      .from(t.users)
      .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin"), ne(t.users.id, v.user.id))),
    drillHistory(db(), v.tenant.id, locale),
  ]);
  const templates = drillTemplates(v.tenant.features).map((tpl) => ({
    key: tpl.key,
    name: templateText(tpl.name, locale),
    channel: tpl.channel as "email" | "sms",
    difficulty: tpl.difficulty,
    harvest: tpl.harvest,
    senderName: templateText(tpl.sender.name, locale),
    senderAddress: templateText(tpl.sender.address, locale),
    subject: templateText(tpl.subject, locale),
  }));
  // People per department (and its sub-departments), the viewer left out, for the audience line.
  const users = await db()
    .select({ id: t.users.id, departmentId: t.users.departmentId, phone: t.users.phone })
    .from(t.users)
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin"), ne(t.users.id, v.user.id)));
  const childrenOf = new Map<string, string[]>();
  for (const d of departments) if (d.parentId) childrenOf.set(d.parentId, [...(childrenOf.get(d.parentId) ?? []), d.id]);
  const tree = (id: string): string[] => [id, ...(childrenOf.get(id) ?? []).flatMap(tree)];
  const reach = (ids: Set<string> | null) => ({
    all: users.filter((u) => !ids || (u.departmentId && ids.has(u.departmentId))).length,
    sms: users.filter((u) => u.phone && (!ids || (u.departmentId && ids.has(u.departmentId)))).length,
  });
  const audience = {
    all: reach(null),
    departments: Object.fromEntries(departments.map((d) => [d.id, reach(new Set(tree(d.id)))])),
  };

  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} icon={<Zap />} />
      <Notice tone="brand" icon={<FlaskConical />} title={tr("syntheticTitle")}>
        {tr("synthetic")}
      </Notice>
      <DrillSetup templates={templates} departments={departments.map((d) => ({ id: d.id, name: d.name }))} audience={audience} everyone={Number(everyone?.n ?? 0)} simHours={DRILL_SIM_MINUTES / 60} />
      <Card>
        <CardHeader title={tr("historyTitle")} />
        <CardBody className="pt-3">
          {history.length ? (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id}>
                  <Link href={`/admin/drill/${h.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 hover:text-brand-700">
                    <span className="min-w-0 flex-[1_1_14rem]">
                      <span className="block truncate text-body-sm font-semibold">{h.name}</span>
                      <span className="block text-tab text-ink-subtle">
                        {format.dateTime(h.startedAt, { dateStyle: "medium", timeStyle: "short" })} · {tr("historyAudience", { count: h.audience })}
                      </span>
                    </span>
                    <span className="text-caption text-ink-muted tabular-nums">
                      {tr("historyResult", { clicked: `${format.number(h.totals.clicked)} (${tc("units.percent", { value: format.number(percent(h.totals.clicked, h.totals.delivered)) })})`, reported: format.number(h.totals.reported), trained: format.number(h.totals.trained) })}
                    </span>
                    {h.cancelled ? <Pill>{tcmp("status.cancelled")}</Pill> : <Pill tone={h.finished ? "safe" : "risk"}>{h.finished ? tr("finished") : tr("live")}</Pill>}
                    <ChevronRight aria-hidden className="size-4 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Zap />} title={tr("historyEmpty")} className="py-8" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
