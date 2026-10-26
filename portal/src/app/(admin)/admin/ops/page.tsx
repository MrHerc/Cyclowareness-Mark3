import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { Activity, FlaskConical, Gauge, Inbox, Radio, Recycle, ShieldCheck, Siren, Timer } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { opsOverview } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { BarChart, StackBar } from "@/components/ui/charts";
import { PageHeader, Stat } from "@/components/ui/layout";
import { cn } from "@/lib/cn";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("ops") };
}

const FEED_ICON = { report: Inbox, sandbox: FlaskConical, incident: Siren, loop: Recycle, decision: ShieldCheck } as const;

export default async function OpsCenterPage() {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "ops_center")) notFound();
  const [tr, ts, tn, tc, tv, format] = await Promise.all([
    getTranslations("secops.ops"),
    getTranslations("secops"),
    getTranslations("admin.nav"),
    getTranslations("common"),
    getTranslations("security.sandbox"),
    getAppFormatter(),
  ]);
  const d = await opsOverview(v);
  const sandboxTotal = d.sandbox.malicious + d.sandbox.suspicious + d.sandbox.clean;
  const maxStage = Math.max(1, ...d.pipeline.map((p) => p.count));

  return (
    <div className="grid gap-6">
      <PageHeader title={tn("ops")} subtitle={tr("subtitle")} icon={<Gauge />} />

      {d.live.some((i) => i.live) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-risk-100 bg-risk-50 px-5 py-3.5" role="status">
          <span className="relative grid size-3 place-items-center">
            <span className="absolute size-3 animate-ping rounded-full bg-risk-500 opacity-60 motion-reduce:hidden" />
            <span className="size-2.5 rounded-full bg-risk-600" />
          </span>
          {d.live
            .filter((i) => i.live)
            .map((i) => (
              <Link key={i.id} href={`/admin/incidents/${i.id}`} className="text-body-sm font-semibold text-risk-700 hover:underline">
                IR-{i.number} · {i.confidential ? tc(`severity.${i.severity}`) : i.title}
              </Link>
            ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Link href="/admin/threats?status=new" className="rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
          <Stat label={tr("newReports")} value={d.newReports} hint={tr("newReportsHint")} icon={<Inbox />} tone={d.newReports ? "warn" : "safe"} className="h-full hover:shadow-raised" />
        </Link>
        <Link href="/admin/incidents" className="rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
          <Stat label={tr("openIncidents")} value={d.openIncidents} hint={tr("openIncidentsHint", { count: d.highIncidents })} icon={<Siren />} tone={d.highIncidents ? "risk" : "brand"} className="h-full hover:shadow-raised" />
        </Link>
        <Link href="/admin/approvals" className="rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
          <Stat label={tr("pendingApprovals")} value={d.pendingApprovals} hint={tr("pendingApprovalsHint")} icon={<ShieldCheck />} tone={d.pendingApprovals ? "reward" : "safe"} className="h-full hover:shadow-raised" />
        </Link>
        <Link href="/admin/loops" className="rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
          <Stat label={tr("activeLoops")} value={d.openLoops} hint={tr("activeLoopsHint", { count: d.closed30 })} icon={<Recycle />} tone="violet" className="h-full hover:shadow-raised" />
        </Link>
        <Stat label={tr("timeToClose")} value={d.medianHours === null ? "—" : tr("timeToCloseValue", { hours: d.medianHours })} hint={d.medianHours === null ? tr("timeToCloseEmpty") : undefined} icon={<Timer />} tone="cyan" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader title={tr("live")} icon={<Radio />} />
            <CardBody className="pt-3">
              {d.live.length ? (
                <ul className="divide-y divide-line">
                  {d.live.map((i) => (
                    <li key={i.id}>
                      <Link href={`/admin/incidents/${i.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:text-brand-700">
                        <span className="font-mono text-tab text-ink-subtle">IR-{i.number}</span>
                        <span className="min-w-0 flex-[1_1_12rem] truncate text-body-sm font-semibold">{i.confidential ? `${tc(`severity.${i.severity}`)} · ${ts("incidents.confidential")}` : i.title}</span>
                        {i.live ? <Pill tone="risk">{ts("incidents.live")}</Pill> : null}
                        <Pill tone={i.severity === "critical" || i.severity === "high" ? "risk" : "warn"}>{tc(`severity.${i.severity}`)}</Pill>
                        <Pill>{ts(`incidents.statuses.${i.status}`)}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-ink-muted">{tr("liveEmpty")}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={tr("pipeline")} icon={<Recycle />} />
            <CardBody>
              <ol className="grid grid-cols-7 items-end gap-2" aria-label={tr("pipeline")}>
                {d.pipeline.map((p, i) => (
                  <li key={p.stage} className="flex flex-col items-center gap-2 text-center">
                    <span className="text-title-sm font-bold tabular-nums">{p.count}</span>
                    <span className="flex h-24 w-full items-end rounded-md bg-sunken">
                      <span className={cn("w-full rounded-md", p.count ? "bg-brand-500" : "")} style={{ height: `${(p.count / maxStage) * 100}%`, opacity: 0.45 + (i / 7) * 0.55 }} />
                    </span>
                    <span className="text-tab-sm leading-tight font-semibold text-ink-muted">{ts(`stages.${p.stage}`)}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title={tr("reportsChart")} />
              <CardBody>
                <BarChart
                  tone="brand"
                  points={d.reportsByDay.map((p) => ({ label: format.dateTime(new Date(`${p.day}T12:00:00`), { day: "numeric", month: "short" }), value: p.value }))}
                  caption={tr("reportsChart")}
                  headers={[tr("reportsHeaders.date"), tr("reportsHeaders.value")]}
                />
                <div className="mt-2 flex justify-between text-tab text-ink-subtle">
                  <span>{format.dateTime(new Date(`${d.reportsByDay[0].day}T12:00:00`), { day: "numeric", month: "short" })}</span>
                  <span>{format.dateTime(new Date(`${d.reportsByDay[13].day}T12:00:00`), { day: "numeric", month: "short" })}</span>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={tr("sandbox")} icon={<FlaskConical />} />
              <CardBody className="grid gap-4">
                <StackBar
                  className="h-4"
                  parts={[
                    { value: d.sandbox.malicious, className: "bg-risk-500", label: tv("verdict.malicious") },
                    { value: d.sandbox.suspicious, className: "bg-warn-500", label: tv("verdict.suspicious") },
                    { value: d.sandbox.clean, className: "bg-safe-500", label: tv("verdict.clean") },
                  ]}
                />
                <ul className="grid gap-2 text-caption">
                  {(["malicious", "suspicious", "clean"] as const).map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", k === "malicious" ? "bg-risk-500" : k === "suspicious" ? "bg-warn-500" : "bg-safe-500")} />
                      <span className="flex-1">{tv(`verdict.${k}`)}</span>
                      <b className="tabular-nums">{d.sandbox[k]}</b>
                      <span className="w-10 text-right text-ink-subtle tabular-nums">{sandboxTotal ? Math.round((d.sandbox[k] / sandboxTotal) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>

        <Card className="self-start">
          <CardHeader title={tr("feed")} icon={<Activity />} />
          <CardBody className="pt-3">
            {d.feed.length ? (
              <ol className="relative grid gap-0.5 before:absolute before:top-2 before:bottom-2 before:left-[1.05rem] before:w-px before:bg-line">
                {d.feed.map((e) => {
                  const Icon = FEED_ICON[e.kind];
                  const label =
                    e.kind === "loop"
                      ? tr("feedKinds.loop", { stage: ts(`stages.${e.extra as "analysis"}`) })
                      : e.kind === "decision"
                        ? tr("feedKinds.decision", { decision: tr(`decisions.${e.extra as "approve"}`) })
                        : tr(`feedKinds.${e.kind}`, { number: e.number ?? 0 });
                  return (
                    <li key={`${e.kind}-${e.id}`}>
                      <Link href={e.href} className="relative flex gap-3 rounded-md py-2 pr-2 hover:bg-sunken">
                        <span
                          className={cn(
                            "z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface [&_svg]:size-4",
                            { brand: "bg-brand-50 text-brand-600", risk: "bg-risk-50 text-risk-600", warn: "bg-warn-50 text-warn-700", safe: "bg-safe-50 text-safe-600", neutral: "bg-sunken text-ink-muted" }[e.tone],
                          )}
                        >
                          <Icon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-tab font-semibold text-ink-muted">
                            {label}
                            {e.kind === "sandbox" && e.extra ? ` · ${tv(`verdict.${e.extra as "clean"}`)}` : ""}
                          </span>
                          <span className="block truncate text-caption font-semibold text-ink">{e.title}</span>
                        </span>
                        <time className="shrink-0 text-tab text-ink-subtle" dateTime={e.at.toISOString()}>
                          {format.relativeTime(e.at)}
                        </time>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-body-sm text-ink-muted">{tr("feedEmpty")}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
