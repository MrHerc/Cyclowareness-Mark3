import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Lightbulb, Monitor, Plus, Star } from "lucide-react";
import { allowed, requireViewer } from "@/server/auth/viewer";
import { overviewData, setupState } from "@/server/queries/admin";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink, textLinkClass } from "@/components/ui/button";
import { AreaChart, StackBar } from "@/components/ui/charts";
import { PageHeader, SortHeader } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/avatar";
import { ModuleIcon } from "@/components/learner/module-icon";
import { CountUp, DepartmentFilter, RemindButton, SetupGuide } from "@/components/admin/overview-client";
import { QuickActions, type QuickActionKey } from "@/components/admin/quick-actions";
import { riskBand } from "@/lib/domain/risk";
import { daysLeftInMonth } from "@/lib/domain/league";
import type { Category } from "@/lib/domain/catalog";
import { cn } from "@/lib/cn";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("overview") };
}

/** Trend line under a KPI: arrow shows the direction, colour shows whether that is good. */
function Delta({ text, delta, upIsGood }: { text: string; delta: number; upIsGood: boolean }) {
  if (delta === 0) return <span className="text-ink-subtle">{text}</span>;
  const good = delta > 0 === upIsGood;
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold", good ? "text-safe-700" : "text-risk-600")}>
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}

type SortDir = "asc" | "desc";
const DEPT_SORTS = ["name", "learners", "completion", "reportRate", "risk"] as const;
const MODULE_SORTS = ["title", "completedBy", "awaiting", "rating", "score"] as const;

/** Copy sorted by one column: strings by locale, numbers numerically, nulls always last. */
function sortRows<T>(rows: T[], key: keyof T | null, dir: SortDir, locale: string): T[] {
  if (!key) return rows;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
    if (y === null || y === undefined) return -1;
    return sign * (typeof x === "string" && typeof y === "string" ? x.localeCompare(y, locale) : Number(x) - Number(y));
  });
}

export default async function AdminOverview({ searchParams }: PageProps<"/admin">) {
  const v = await requireViewer();
  if (!allowed(v, "overview.read")) redirect(allowed(v, "leadership.read") ? "/admin/leadership" : "/admin/reports");
  const sp = await searchParams;
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("admin.overview"), getTranslations("common"), getAppFormatter()]);
  const d = await overviewData(v, locale, typeof sp.d === "string" ? sp.d : null);
  const setup = await setupState(v);
  const k = d.kpis;
  const riskBandNow = riskBand(k.avgRisk);
  const totalPeople = d.bands.low + d.bands.medium + d.bands.high;
  const pct = (n: number) => (totalPeople ? Math.round((n / totalPeople) * 100) : 0);
  const awaitingTotal = d.moduleRows.reduce((s, m) => s + m.awaiting, 0);
  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : null);
  const dirParam = (key: string, fallback: SortDir): SortDir => (param(key) === "asc" || param(key) === "desc" ? (param(key) as SortDir) : fallback);
  const deptKey = DEPT_SORTS.find((x) => x === param("ds")) ?? null;
  const deptDir = dirParam("dd", deptKey === "name" ? "asc" : "desc");
  const moduleKey = MODULE_SORTS.find((x) => x === param("ms")) ?? "completedBy";
  const moduleDir = dirParam("md", moduleKey === "title" ? "asc" : "desc");
  const deptRows = sortRows(d.deptRows, deptKey, deptDir, locale);
  const moduleRows = sortRows(d.moduleRows, moduleKey, moduleDir, locale);
  /** Keeps the department filter and the other table's sort; the active column flips direction. */
  const sortHref = (table: "d" | "m", key: string) => {
    const next = new URLSearchParams();
    for (const k of ["d", "ds", "dd", "ms", "md"]) {
      const val = param(k);
      if (val) next.set(k, val);
    }
    const [activeKey, activeDir] = table === "d" ? [deptKey, deptDir] : [moduleKey, moduleDir];
    next.set(`${table}s`, key);
    next.set(`${table}d`, activeKey === key ? (activeDir === "asc" ? "desc" : "asc") : key === "name" || key === "title" ? "asc" : "desc");
    return `?${next.toString()}`;
  };
  const dayLabel = (day: string) => format.dateTime(new Date(`${day}T12:00:00`), { month: "short", day: "numeric" });
  const insights = [
    d.bands.high ? tr("insight.highRisk", { count: d.bands.high }) : null,
    k.reportRate < 50 && k.reportRate > 0 ? tr("insight.lowReport", { value: k.reportRate }) : null,
    awaitingTotal ? tr("insight.awaiting", { count: awaitingTotal }) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title={tr("title")}
        subtitle={d.scoped ? d.departments.find((x) => x.id === sp.d)?.name : tr("subtitle")}
        actions={<DepartmentFilter departments={d.departments.map((x) => ({ id: x.id, name: x.name }))} label={tr("showFor")} />}
      />

      <QuickActions
        title={tr("quickActions")}
        actions={(
          [
            ["addPerson", allowed(v, "people.write")],
            ["assign", allowed(v, "assignments.write")],
            ["aiTraining", allowed(v, "studio.write")],
            ["campaign", allowed(v, "campaigns.write")],
            ["reports", allowed(v, "reports.read") && v.tenant.features.has("reports")],
          ] as [QuickActionKey, boolean][]
        )
          .filter(([, ok]) => ok)
          .map(([key]) => ({ key, label: tr(`quick.${key}`) }))}
      />

      {!v.tenant.settings.setupHidden && allowed(v, "settings.write") ? (
        <div data-tour="admin-setup">
          <SetupGuide steps={setup} skipped={v.tenant.settings.setupSkipped ?? []} canEdit />
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-xs sm:grid-cols-2 xl:grid-cols-5">
        <div className="bg-surface p-5">
          <p className="text-caption font-semibold text-ink-muted">{tr("avgRisk")}</p>
          <p className="mt-2 text-numeral font-bold tabular-nums">
            <CountUp value={k.avgRisk} />
          </p>
          <Pill tone={riskBandNow === "low" ? "safe" : riskBandNow === "medium" ? "warn" : "risk"} className="mt-2">
            {tc(`risk.${riskBandNow}`)}
          </Pill>
          {k.avgRiskDelta !== null ? (
            <p className="mt-2 text-tab">
              <Delta text={k.avgRiskDelta < 0 ? tr("down", { value: Math.abs(k.avgRiskDelta) }) : k.avgRiskDelta > 0 ? tr("up", { value: k.avgRiskDelta }) : tr("flat")} delta={k.avgRiskDelta} upIsGood={false} />
            </p>
          ) : null}
        </div>
        <div className="bg-surface p-5">
          <p className="text-caption font-semibold text-ink-muted">{tr("completion")}</p>
          <p className="mt-2 text-numeral font-bold tabular-nums">
            <CountUp value={k.completion} suffix="%" />
          </p>
          {k.completionFrom !== null ? (
            <p className="mt-2 text-tab">
              <Delta text={k.completion === k.completionFrom ? tr("flat") : k.completion > k.completionFrom ? tr("upFrom", { value: k.completionFrom }) : tr("downFrom", { value: k.completionFrom })} delta={k.completion - k.completionFrom} upIsGood />
            </p>
          ) : null}
        </div>
        <div className="bg-surface p-5">
          <p className="text-caption font-semibold text-ink-muted">{tr("learners")}</p>
          <p className="mt-2 text-numeral font-bold tabular-nums">
            <CountUp value={k.learners} />
          </p>
        </div>
        <div className="bg-surface p-5">
          <p className="text-caption font-semibold text-ink-muted">{tr("active7")}</p>
          <p className="mt-2 text-numeral font-bold tabular-nums">
            <CountUp value={k.active7} />
          </p>
          <p className="mt-2 text-tab text-ink-subtle">{tr("activeShare", { value: k.learners ? Math.round((k.active7 / k.learners) * 100) : 0 })}</p>
        </div>
        <div className="bg-surface p-5 sm:col-span-2 xl:col-span-1">
          <p className="text-caption font-semibold text-ink-muted">{tr("reportRate")}</p>
          <p className="mt-2 text-numeral font-bold tabular-nums">
            <CountUp value={k.reportRate} suffix="%" />
          </p>
          {k.reportFrom !== null ? (
            <p className="mt-2 text-tab">
              <Delta text={k.reportRate === k.reportFrom ? tr("flat") : k.reportRate > k.reportFrom ? tr("upFrom", { value: k.reportFrom }) : tr("downFrom", { value: k.reportFrom })} delta={k.reportRate - k.reportFrom} upIsGood />
            </p>
          ) : null}
        </div>
      </section>

      {insights.length ? (
        <Card className="border-brand-100 bg-brand-50/60 p-5">
          <p className="flex items-center gap-2 text-body-sm font-bold text-brand-700">
            <Lightbulb className="size-5" />
            {tr("insights")}
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-1.5">
            {insights.map((i) => (
              <li key={i} className="text-body-sm text-ink">
                • {i}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {!d.scoped && d.charts.length > 1 ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title={tr("riskChart")} description={tr("riskChartSub")} />
            <CardBody>
              <AreaChart points={d.charts.map((c) => ({ label: dayLabel(c.day), value: c.avgRisk }))} guides={[34, 66]} yTicks={[0, 34, 66, 100]} riskStrip caption={tr("riskChart")} headers={[tc("chart.date"), tc("chart.value")]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tr("completionChart")} description={tr("completionChartSub")} />
            <CardBody>
              <AreaChart points={d.charts.map((c) => ({ label: dayLabel(c.day), value: c.completion }))} yTicks={[0, 50, 100]} suffix="%" caption={tr("completionChart")} headers={[tc("chart.date"), tc("chart.value")]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tr("reportChart")} description={tr("reportChartSub")} />
            <CardBody>
              <AreaChart points={d.charts.map((c) => ({ label: dayLabel(c.day), value: c.reportRate }))} yTicks={[0, 50, 100]} suffix="%" caption={tr("reportChart")} headers={[tc("chart.date"), tc("chart.value")]} />
            </CardBody>
          </Card>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={tr("leagueTitle")}
            description={tc("time.daysLeft", { count: daysLeftInMonth(new Date()) })}
            action={
              <ButtonLink href="/admin/league" size="sm" variant="secondary" icon={<Monitor />}>
                {tr("showOnScreen")}
              </ButtonLink>
            }
          />
          <CardBody>
            <ol className="grid grid-cols-1 gap-2.5">
              {d.league.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-caption font-bold", r.place === 1 ? "bg-reward-500 text-(--accent-on)" : "bg-sunken text-ink-muted")}>{r.place}</span>
                  <span className="w-36 shrink-0 truncate text-body-sm font-semibold sm:w-48">{r.name}</span>
                  <ProgressBar decorative value={r.points} tone={r.place === 1 ? "reward" : "brand"} size="sm" />
                  <span className="w-8 shrink-0 text-end text-body-sm font-bold tabular-nums">{r.points}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader title={tr("byRisk")} />
            <CardBody className="grid grid-cols-1 gap-3">
              <StackBar
                parts={[
                  { value: d.bands.low, className: "bg-safe-500", label: tc("risk.low") },
                  { value: d.bands.medium, className: "bg-warn-500", label: tc("risk.medium") },
                  { value: d.bands.high, className: "bg-risk-500", label: tc("risk.high") },
                ]}
              />
              <div className="grid grid-cols-3 gap-2 text-caption">
                {(["low", "medium", "high"] as const).map((b) => (
                  <Link key={b} href={`/admin/users?risk=${b}`} className="rounded-md px-2 py-1.5 hover:bg-sunken">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <span className={cn("size-2 rounded-full", b === "low" ? "bg-safe-500" : b === "medium" ? "bg-warn-500" : "bg-risk-500")} />
                      {tc(`risk.${b}`)}
                    </span>
                    <span className="font-bold tabular-nums">
                      {d.bands[b]} <span className="font-normal text-ink-subtle">{pct(d.bands[b])}%</span>
                    </span>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={tr("highestRisk")}
              action={
                <Link href="/admin/users?risk=high" className={textLinkClass("inline-flex items-center gap-1 text-caption font-semibold text-brand-600 hover:underline")}>
                  {tr("allPeople")}
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
            <CardBody className="pt-3">
              <ul className="grid grid-cols-1 gap-1">
                {d.highest.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/users/${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
                      <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-semibold">{p.name}</span>
                        <span className="block truncate text-tab text-ink-subtle">
                          {p.departmentName ?? "—"}, {p.lastActiveAt ? tr("activeAgo", { when: format.relativeTime(p.lastActiveAt) }) : tr("neverActive")}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-body-sm font-bold tabular-nums">
                        <span className={cn("size-2 rounded-full", riskBand(p.riskScore) === "high" ? "bg-risk-500" : riskBand(p.riskScore) === "medium" ? "bg-warn-500" : "bg-safe-500")} />
                        {p.riskScore}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader title={tr("departmentsTable")} />
        <CardBody className="pt-3">
          <ScrollRegion label={tr("departmentsTable")}>
            <table className="w-full min-w-[36rem] text-start text-body-sm">
              <thead className="text-tab font-semibold text-ink-subtle">
                <tr className="border-b border-line">
                  <SortHeader label={tr("col.name")} active={deptKey === "name"} dir={deptDir} href={sortHref("d", "name")} className="py-2.5 pe-3 font-semibold" />
                  <SortHeader label={tr("col.learners")} active={deptKey === "learners"} dir={deptDir} href={sortHref("d", "learners")} className="px-3 py-2.5 font-semibold" />
                  <SortHeader label={tr("col.completion")} active={deptKey === "completion"} dir={deptDir} href={sortHref("d", "completion")} className="px-3 py-2.5 font-semibold" />
                  <SortHeader label={tr("col.reporting")} active={deptKey === "reportRate"} dir={deptDir} href={sortHref("d", "reportRate")} className="px-3 py-2.5 font-semibold" />
                  <SortHeader label={tr("col.risk")} active={deptKey === "risk"} dir={deptDir} href={sortHref("d", "risk")} className="py-2.5 ps-3 text-end font-semibold" />
                </tr>
              </thead>
              <tbody>
                {deptRows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-3 pe-3 font-semibold">{r.name}</td>
                    <td className="px-3 py-3 tabular-nums">{r.learners}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar decorative value={r.completion} size="sm" className="w-24" />
                        <span className="tabular-nums">{r.completion}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{r.reportRate}%</td>
                    <td className="py-3 ps-3 text-end">
                      <Pill tone={riskBand(r.risk) === "low" ? "safe" : riskBand(r.risk) === "medium" ? "warn" : "risk"}>{r.risk}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={tr("modulesTable")}
          action={
            allowed(v, "assignments.write") ? (
              <ButtonLink href="/admin/assignments" size="sm" variant="secondary" icon={<Plus />}>
                {tr("assignModule")}
              </ButtonLink>
            ) : null
          }
        />
        <CardBody className="pt-3">
          <ScrollRegion label={tr("modulesTable")}>
            <table className="w-full min-w-[44rem] text-start text-body-sm">
              <thead className="text-tab text-ink-subtle">
                <tr className="border-b border-line">
                  <SortHeader label={tr("col.module")} active={moduleKey === "title"} dir={moduleDir} href={sortHref("m", "title")} className="py-2.5 pe-3 font-semibold" />
                  <SortHeader label={tr("col.completed")} active={moduleKey === "completedBy"} dir={moduleDir} href={sortHref("m", "completedBy")} className="px-3 py-2.5 font-semibold" />
                  <SortHeader label={tr("col.awaiting")} active={moduleKey === "awaiting"} dir={moduleDir} href={sortHref("m", "awaiting")} className="px-3 py-2.5 font-semibold" />
                  <SortHeader label={tr("col.rating")} active={moduleKey === "rating"} dir={moduleDir} href={sortHref("m", "rating")} className="px-3 py-2.5 font-semibold" />
                  <SortHeader label={tr("col.score")} active={moduleKey === "score"} dir={moduleDir} href={sortHref("m", "score")} className="py-2.5 ps-3 text-end font-semibold" />
                </tr>
              </thead>
              <tbody>
                {moduleRows.map((m) => (
                  <tr key={m.moduleId} className="border-b border-line last:border-0">
                    <td className="py-3 pe-3">
                      <span className="flex items-center gap-3">
                        <ModuleIcon slug={m.slug} category={m.category as Category} size="sm" />
                        <span className="font-semibold">{m.title}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-16 shrink-0 tabular-nums">{tr("ofTotal", { done: m.completedBy, total: m.assignedTo })}</span>
                        <ProgressBar decorative value={m.assignedTo ? (m.completedBy / m.assignedTo) * 100 : 0} size="sm" className="w-20" />
                      </div>
                    </td>
                    <td className="px-3 py-3">{m.awaiting ? <RemindButton moduleId={m.moduleId} moduleTitle={m.title} count={m.awaiting} /> : <span className="text-ink-subtle">—</span>}</td>
                    <td className="px-3 py-3">
                      {m.rating ? (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Star className="size-4 fill-laurel-500 text-laurel-600" />
                          {format.number(m.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>
                    <td className="py-3 ps-3 text-end tabular-nums">{m.score !== null ? `${m.score}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </CardBody>
      </Card>
    </div>
  );
}
