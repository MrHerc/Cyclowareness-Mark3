import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Activity } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { computeTenantRisk } from "@/server/services/risk";
import { getDepartments, listPeople } from "@/server/queries/admin";
import { departmentClosure } from "@/server/services/assignments";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { StackBar } from "@/components/ui/charts";
import { EmptyState, Notice, PageHeader, TabsNav } from "@/components/ui/layout";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { riskBand } from "@/lib/domain/risk";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("risk") };
}

const BANDS = ["all", "high", "medium", "low"] as const;
const PARTS = [
  { key: "training", className: "bg-brand-500" },
  { key: "overdue", className: "bg-warn-500" },
  { key: "simulations", className: "bg-risk-500" },
  { key: "openRisks", className: "bg-[#6d28d9]" },
  { key: "knowledge", className: "bg-[#0b6a80]" },
] as const;

export default async function RiskProfilesPage({ searchParams }: PageProps<"/admin/risk">) {
  const v = await requirePermission("people.read");
  if (!hasFeature(v, "risk_profiles")) notFound();
  const sp = await searchParams;
  const band = BANDS.includes(sp.band as "all") ? (sp.band as (typeof BANDS)[number]) : "all";
  const [tr, tn, tc] = await Promise.all([getTranslations("secops.risk"), getTranslations("admin.nav"), getTranslations("common")]);
  const people = (await listPeople(v)).filter((p) => p.status === "active" && p.role !== "super_admin");
  const allDepartments = await getDepartments(v.tenant.id);
  // A department filter covers its sub-departments, as on /admin/users and in reports. Offer the
  // departments that hold any visible person directly or below them; anything else is no filter.
  const closure = departmentClosure(allDepartments);
  const visibleDepts = new Set(people.map((p) => p.departmentId));
  const departments = allDepartments.filter((d) => [...(closure.get(d.id) ?? [])].some((id) => visibleDepts.has(id)));
  const dept = typeof sp.d === "string" && departments.some((d) => d.id === sp.d) ? sp.d : "";
  const inDept = dept ? closure.get(dept)! : null;
  // The distribution, average and band counts describe the selected department; the band only narrows the list.
  const inScope = inDept ? people.filter((p) => p.departmentId && inDept.has(p.departmentId)) : people;
  const ids = inScope.map((p) => p.id);
  const [evidence, open] = await Promise.all([
    computeTenantRisk(db(), v.tenant.id, new Date(), ids),
    ids.length
      ? db()
          .select({ userId: t.behaviorRisks.userId })
          .from(t.behaviorRisks)
          .where(and(eq(t.behaviorRisks.tenantId, v.tenant.id), eq(t.behaviorRisks.status, "open"), inArray(t.behaviorRisks.userId, ids)))
      : Promise.resolve([]),
  ]);
  const openBy = new Map<string, number>();
  for (const o of open) openBy.set(o.userId, (openBy.get(o.userId) ?? 0) + 1);
  const rows = inScope
    .map((p) => ({ ...p, b: evidence.get(p.id) ?? { score: p.riskScore, parts: { training: 0, overdue: 0, simulations: 0, openRisks: 0, knowledge: 0 } } }))
    .sort((a, b) => b.b.score - a.b.score);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const r of rows) counts[riskBand(r.b.score)]++;
  const list = rows.filter((r) => band === "all" || riskBand(r.b.score) === band);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.b.score, 0) / rows.length) : 0;

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("risk")} subtitle={tr("subtitle")} icon={<Activity />} />
      <Card>
        <CardBody className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-body-sm font-semibold">{tr("distribution")}</p>
            <p className="text-caption text-ink-muted">{tr("average", { score: avg })}</p>
          </div>
          <StackBar
            className="h-4"
            parts={[
              { value: counts.high, className: "bg-risk-500", label: tr("bands.high") },
              { value: counts.medium, className: "bg-warn-500", label: tr("bands.medium") },
              { value: counts.low, className: "bg-safe-500", label: tr("bands.low") },
            ]}
          />
          <div className="flex flex-wrap gap-4 text-caption">
            {(["high", "medium", "low"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={k === "high" ? "size-2.5 rounded-full bg-risk-500" : k === "medium" ? "size-2.5 rounded-full bg-warn-500" : "size-2.5 rounded-full bg-safe-500"} />
                {tr(`bands.${k}`)} <b className="tabular-nums">{counts[k]}</b>
              </span>
            ))}
          </div>
        </CardBody>
      </Card>
      <Notice tone="info">{tr("explain")}</Notice>
      <div className="flex flex-wrap items-center gap-3">
        <TabsNav items={BANDS.map((b) => ({ href: `?band=${b}${dept ? `&d=${dept}` : ""}`, label: tr(`bands.${b}`), active: band === b, count: b === "all" ? rows.length : counts[b] }))} />
        <form className="ms-auto">
          <input type="hidden" name="band" value={band} />
          <select name="d" defaultValue={dept} aria-label={tc("department")} className="h-10 rounded-pill border border-line-control bg-surface px-4 text-caption font-semibold">
            <option value="">{tc("allDepartments")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="submit" className="ms-2 h-10 rounded-pill bg-ink px-4 text-caption font-semibold text-white">
            {tc("apply")}
          </button>
        </form>
      </div>
      {list.length ? (
        <Card>
          <ScrollRegion label={tn("risk")}>
            <table className="w-full min-w-[48rem] text-start text-caption">
              <thead className="text-tab text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-semibold">{tr("person")}</th>
                  <th className="px-3 py-3 font-semibold">{tr("score")}</th>
                  <th className="px-3 py-3 font-semibold">{tr("why")}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tr("openRisks")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => {
                  const b = riskBand(r.b.score);
                  return (
                    <tr key={r.id} className="hover:bg-sunken/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/users/${r.id}`} className="flex items-center gap-3">
                          <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                          <span className="min-w-0">
                            <b className="block truncate hover:text-brand-700">{r.name}</b>
                            <span className="block truncate text-tab text-ink-subtle">{r.departmentName ?? tc("noDepartment")}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone={b === "high" ? "risk" : b === "medium" ? "warn" : "safe"} className="tabular-nums">
                          {r.b.score}
                        </Pill>
                      </td>
                      <td className="w-[40%] px-3 py-3">
                        <StackBar parts={PARTS.map((p) => ({ value: r.b.parts[p.key], className: p.className, label: tr(`parts.${p.key}`) }))} />
                        <p className="mt-1.5 text-tab text-ink-subtle">
                          {PARTS.filter((p) => r.b.parts[p.key] > 0)
                            .sort((x, y) => r.b.parts[y.key] - r.b.parts[x.key])
                            .slice(0, 3)
                            .map((p) => `${tr(`parts.${p.key}`)} +${r.b.parts[p.key]}`)
                            .join(" · ")}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-end font-semibold tabular-nums">{openBy.get(r.id) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollRegion>
        </Card>
      ) : (
        <EmptyState icon={<Activity />} title={tr("empty")} />
      )}
    </div>
  );
}
