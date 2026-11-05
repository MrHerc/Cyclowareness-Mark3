import { notFound } from "next/navigation";
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowDownRight, ArrowUpRight, Printer, Sparkles } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { overviewData } from "@/server/queries/admin";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { AreaChart } from "@/components/ui/charts";
import { PageHeader } from "@/components/ui/layout";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { PrintButton } from "@/components/admin/print-toolbar";
import { riskBand } from "@/lib/domain/risk";
import { dayAt, requestNow } from "@/lib/time";
import { cn } from "@/lib/cn";
import { riskTitle } from "@/lib/risk-title";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("leadership") };
}

const DAY = 86_400_000;

export default async function LeadershipPage() {
  const v = await requirePermission("leadership.read");
  if (!hasFeature(v, "leadership")) notFound();
  const locale = await getLocale();
  const [tr, tn, tc, format] = await Promise.all([getTranslations("secops.leadership"), getTranslations("admin.nav"), getTranslations("common"), getFormatter()]);
  const d = await overviewData(v, locale, null);
  const since30 = new Date(requestNow().getTime() - 30 * DAY);
  const tid = v.tenant.id;

  const [incOpened, incResolved, loopsClosed, risks, versions, activeUsers] = await Promise.all([
    db().select({ n: sql<number>`count(*)` }).from(t.incidents).where(and(eq(t.incidents.tenantId, tid), gte(t.incidents.createdAt, since30))),
    db().select({ n: sql<number>`count(*)` }).from(t.incidents).where(and(eq(t.incidents.tenantId, tid), gte(t.incidents.resolvedAt, since30))),
    db().select({ n: sql<number>`count(*)`, trained: sql<number>`coalesce(sum(${t.loops.trainedCount}), 0)` }).from(t.loops).where(and(eq(t.loops.tenantId, tid), gte(t.loops.closedAt, since30))),
    db()
      .select({ id: t.behaviorRisks.id, userId: t.behaviorRisks.userId, title: t.behaviorRisks.title, severity: t.behaviorRisks.severity, createdAt: t.behaviorRisks.createdAt })
      .from(t.behaviorRisks)
      .where(and(eq(t.behaviorRisks.tenantId, tid), eq(t.behaviorRisks.status, "open"), inArray(t.behaviorRisks.severity, ["high", "critical"])))
      .orderBy(desc(t.behaviorRisks.createdAt))
      .limit(8),
    db()
      .select({ id: t.policyVersions.id, policyId: t.policyVersions.policyId, version: t.policyVersions.version })
      .from(t.policyVersions)
      .innerJoin(t.policies, eq(t.policies.id, t.policyVersions.policyId))
      .where(and(eq(t.policies.tenantId, tid), isNull(t.policies.archivedAt), isNotNull(t.policyVersions.publishedAt))),
    db().select({ n: sql<number>`count(*)` }).from(t.users).where(and(eq(t.users.tenantId, tid), eq(t.users.status, "active"))),
  ]);
  const latest = new Map<string, { id: string; version: number }>();
  for (const pv of versions) if ((latest.get(pv.policyId)?.version ?? 0) < pv.version) latest.set(pv.policyId, pv);
  const latestIds = [...latest.values()].map((x) => x.id);
  const [signed] = latestIds.length ? await db().select({ n: sql<number>`count(*)` }).from(t.policySignoffs).where(inArray(t.policySignoffs.versionId, latestIds)) : [{ n: 0 }];
  const needed = latestIds.length * Number(activeUsers[0]?.n ?? 0);
  const policyCoverage = needed ? Math.min(100, Math.round((Number(signed?.n ?? 0) / needed) * 100)) : 0;
  const people = await peopleById(tid, risks.map((r) => r.userId));

  const k = d.kpis;
  const delta = k.avgRiskDelta ?? 0;
  const headline = delta <= -3 ? "good" : delta >= 3 ? "bad" : "watch";
  const tiles = [
    { label: tr("completion"), value: k.completion, tone: "brand" as const },
    { label: tr("reportRate"), value: k.reportRate, tone: "safe" as const },
    { label: tr("policyCoverage"), value: policyCoverage, tone: "reward" as const },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 print:gap-4">
      <PageHeader title={tn("leadership")} subtitle={tr("subtitle")} icon={<Sparkles />} actions={<PrintButton label={tr("print")} icon={<Printer />} />} />

      <div className={cn("rounded-2xl p-6 print:border print:border-line", headline === "good" ? "bg-safe-50" : headline === "bad" ? "bg-risk-50" : "bg-warn-50")}>
        <p className={cn("text-title font-semibold text-balance", headline === "good" ? "text-safe-700" : headline === "bad" ? "text-risk-700" : "text-warn-700")}>{tr(`headline.${headline}`)}</p>
        <p className="mt-1 text-caption text-ink-muted">{tr("generated", { date: format.dateTime(new Date(), { dateStyle: "long" }) })}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={tr("riskTrend")}
            description={
              <span className="inline-flex flex-wrap items-center gap-2">
                <b className="text-ink">{tr("now", { value: k.avgRisk })}</b>
                {k.avgRiskDelta === null || k.avgRiskDelta === 0 ? (
                  <span>{tr("noChange")}</span>
                ) : (
                  <span className={cn("inline-flex items-center gap-1 font-semibold", k.avgRiskDelta < 0 ? "text-safe-700" : "text-risk-600")}>
                    {k.avgRiskDelta < 0 ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                    {tr("change", { sign: k.avgRiskDelta > 0 ? "+" : "−", abs: Math.abs(k.avgRiskDelta) })}
                  </span>
                )}
              </span>
            }
          />
          <CardBody>
            <AreaChart
              riskStrip
              points={d.charts.map((c) => ({ label: format.dateTime(dayAt(c.day, v.tenant.settings.timeZone), { day: "numeric", month: "short" }), value: c.avgRisk }))}
              caption={tr("riskTrend")}
              headers={[tr("riskHeaders.date"), tr("riskHeaders.value")]}
              guides={[33, 66]}
            />
          </CardBody>
        </Card>
        <div className="grid grid-cols-1 content-start gap-4">
          {tiles.map((x) => (
            <Card key={x.label}>
              <CardBody className="grid grid-cols-1 gap-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-body-sm font-semibold">{x.label}</span>
                  <span className="text-title font-bold tabular-nums">{tc("units.percent", { value: format.number(x.value) })}</span>
                </div>
                <ProgressBar value={x.value} tone={x.tone} label={x.label} />
              </CardBody>
            </Card>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardBody className="grid gap-1">
                <span className="text-caption font-semibold text-ink-muted">{tr("incidents")}</span>
                <span className="text-title-sm font-bold tabular-nums">
                  {Number(incOpened[0]?.n ?? 0)} <span className="text-caption font-normal text-ink-muted">{tr("opened")}</span>
                </span>
                <span className="text-title-sm font-bold tabular-nums">
                  {Number(incResolved[0]?.n ?? 0)} <span className="text-caption font-normal text-ink-muted">{tr("resolved")}</span>
                </span>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="grid gap-1">
                <span className="text-caption font-semibold text-ink-muted">{tr("loops")}</span>
                <span className="text-numeral font-bold tabular-nums">{Number(loopsClosed[0]?.n ?? 0)}</span>
                <span className="text-tab text-ink-muted">
                  {tr("trained")}: <b className="text-ink tabular-nums">{Number(loopsClosed[0]?.trained ?? 0)}</b>
                </span>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr("departments")} />
          <CardBody className="pt-3">
            {/* Long department names and translated headers can need more room than a phone gives the card. */}
            <ScrollRegion label={tr("departments")}>
              <table className="w-full text-start text-caption">
                <thead className="text-tab text-ink-subtle">
                  <tr className="border-b border-line">
                    <th className="py-2 font-semibold">{tr("department")}</th>
                    <th className="py-2 text-end font-semibold">{tr("headcount")}</th>
                    <th className="py-2 text-end font-semibold">{tr("completionShort")}</th>
                    <th className="py-2 text-end font-semibold">{tr("avgRisk")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...d.deptRows]
                    .sort((a, b) => b.risk - a.risk)
                    .map((r) => {
                      const b = riskBand(r.risk);
                      return (
                        <tr key={r.id}>
                          <td className="py-2.5 font-semibold">{r.name}</td>
                          <td className="py-2.5 text-end tabular-nums">{r.learners}</td>
                          <td className="py-2.5 text-end tabular-nums">{tc("units.percent", { value: format.number(r.completion) })}</td>
                          <td className="py-2.5 text-end">
                            <Pill tone={b === "high" ? "risk" : b === "medium" ? "warn" : "safe"} className="tabular-nums">
                              {r.risk}
                            </Pill>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </ScrollRegion>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tr("topRisks")} />
          <CardBody className="pt-3">
            {risks.length ? (
              <ul className="divide-y divide-line">
                {risks.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-2.5">
                    <Pill tone="risk">{tc(`severity.${r.severity}`)}</Pill>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-caption">{riskTitle(r.title, locale)}</b>
                      <span className="block text-tab text-ink-subtle">
                        {people.get(r.userId)?.departmentName ?? tc("noDepartment")} · {format.dateTime(r.createdAt, { dateStyle: "medium" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{tr("topRisksEmpty")}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
