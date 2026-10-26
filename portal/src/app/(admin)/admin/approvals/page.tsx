import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BookOpen, ShieldCheck, Users } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { MaterialDecision } from "@/components/secops/intake";
import { pick } from "@/i18n/config";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("approvals") };
}

const TABS = ["pending", "second", "decided"] as const;

export default async function ApprovalsPage({ searchParams }: PageProps<"/admin/approvals">) {
  const v = await requirePermission("approvals.decide");
  if (!hasFeature(v, "approvals")) notFound();
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as "pending") ? (sp.tab as (typeof TABS)[number]) : "pending";
  const locale = await getLocale();
  const [tr, tn, format] = await Promise.all([getTranslations("secops.approvals"), getTranslations("admin.nav"), getFormatter()]);
  const all = await db().select().from(t.materials).where(eq(t.materials.tenantId, v.tenant.id)).orderBy(desc(t.materials.createdAt));
  const list = all.filter((m) => (tab === "pending" ? m.status === "pending" : tab === "second" ? m.status === "second_approval" : m.status === "approved" || m.status === "rejected"));
  const ids = list.map((m) => m.id);
  const moduleIds = [...new Set(list.map((m) => m.moduleId).filter((x): x is string => !!x))];
  const [decisions, modules] = await Promise.all([
    ids.length ? db().select().from(t.materialDecisions).where(inArray(t.materialDecisions.materialId, ids)).orderBy(asc(t.materialDecisions.at)) : Promise.resolve([]),
    moduleIds.length ? db().select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title }).from(t.modules).where(inArray(t.modules.id, moduleIds)) : Promise.resolve([]),
  ]);
  const people = await peopleById(v.tenant.id, [...decisions.map((d) => d.actorId), ...list.flatMap((m) => m.targetUserIds.slice(0, 6))]);
  const modById = new Map(modules.map((m) => [m.id, m]));

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("approvals")} subtitle={tr("subtitle")} icon={<ShieldCheck />} />
      <TabsNav
        items={TABS.map((k) => ({
          href: `?tab=${k}`,
          label: tr(`tabs.${k}`),
          active: tab === k,
          count: all.filter((m) => (k === "pending" ? m.status === "pending" : k === "second" ? m.status === "second_approval" : m.status === "approved" || m.status === "rejected")).length,
        }))}
      />
      {list.length ? (
        <ul className="grid gap-4">
          {list.map((m) => {
            const mod = m.moduleId ? modById.get(m.moduleId) : null;
            const hist = decisions.filter((d) => d.materialId === m.id);
            const firstApprover = hist.find((d) => d.decision === "approve");
            const names = m.targetUserIds.slice(0, 6).map((id) => people.get(id)?.name).filter(Boolean);
            return (
              <li key={m.id}>
                <Card>
                  <CardBody className="grid gap-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <Pill tone={m.origin === "ai" ? "violet" : m.origin === "template" ? "cyan" : "brand"}>{tr(`origin.${m.origin}`)}</Pill>
                      {m.sourceRef ? <Pill>{m.sourceRef}</Pill> : null}
                      {m.requiresTwo ? <Pill tone="warn">{tr("requiresTwo")}</Pill> : null}
                      <span className="ml-auto text-tab text-ink-subtle">{format.dateTime(m.createdAt, { dateStyle: "medium" })}</span>
                    </div>
                    <div>
                      <h2 className="text-title-sm font-semibold">{m.title}</h2>
                      <p className="mt-2 text-body-sm whitespace-pre-line text-ink-muted">{m.body}</p>
                    </div>
                    <dl className="grid gap-3 text-caption sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 size-4 text-ink-subtle" />
                        <div>
                          <dt className="font-semibold">{tr("module")}</dt>
                          <dd className="text-ink-muted">
                            {mod ? (
                              <Link href={`/learn/${mod.slug}`} className="text-brand-600 hover:underline">
                                {pick(mod.title, locale)}
                              </Link>
                            ) : (
                              tr("noModule")
                            )}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Users className="mt-0.5 size-4 text-ink-subtle" />
                        <div>
                          <dt className="font-semibold">{tr("targets")}</dt>
                          <dd className="text-ink-muted">
                            {names.join(", ")}
                            {m.targetUserIds.length > names.length ? ` +${m.targetUserIds.length - names.length}` : ""}
                            {!m.targetUserIds.length ? "—" : ""}
                          </dd>
                        </div>
                      </div>
                    </dl>
                    {m.status === "second_approval" && firstApprover ? <p className="text-caption font-semibold text-warn-700">{tr("firstBy", { name: people.get(firstApprover.actorId)?.name ?? "—" })}</p> : null}
                    {hist.length && tab === "decided" ? (
                      <div>
                        <p className="mb-1.5 text-caption font-semibold text-ink-muted">{tr("history")}</p>
                        <ul className="grid gap-1 text-caption">
                          {hist.map((d) => (
                            <li key={d.id} className="flex flex-wrap gap-2">
                              <Pill tone={d.decision === "approve" ? "safe" : d.decision === "reject" ? "risk" : "neutral"}>{tr(`decision.${d.decision}`)}</Pill>
                              <span>{people.get(d.actorId)?.name ?? "—"}</span>
                              <span className="text-ink-subtle">{format.dateTime(d.at, { dateStyle: "medium", timeStyle: "short" })}</span>
                              {d.reason ? <span className="w-full text-ink-muted">{tr("reasonQuoted", { reason: d.reason })}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {m.status === "pending" || m.status === "second_approval" ? (
                      <MaterialDecision id={m.id} status={m.status} title={m.title} body={m.body} />
                    ) : (
                      <Pill tone={m.status === "approved" ? "safe" : "risk"} className="w-fit">
                        {tr(`status.${m.status}`)}
                      </Pill>
                    )}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<ShieldCheck />} title={tr("empty")} />
      )}
    </div>
  );
}
