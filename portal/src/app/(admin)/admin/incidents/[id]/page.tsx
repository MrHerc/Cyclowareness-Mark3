import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { FlaskConical, GraduationCap, Inbox, Lock, Siren } from "lucide-react";
import { allowed } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { moduleScores } from "@/server/services/secops";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Pill } from "@/components/ui/pill";
import { PageHeader } from "@/components/ui/layout";
import { ProgressBar } from "@/components/ui/progress";
import { CopyText, IncidentControls, IncidentTrainingEditor } from "@/components/secops/incident";
import { formOptions } from "@/server/queries/secops-options";
import { defang } from "@/lib/defang";
import { pick } from "@/i18n/config";
import { bakuDayPlus } from "@/lib/time";
import { incidentForPage } from "./incident";

const SEV_TONE = { low: "neutral", medium: "warn", high: "risk", critical: "risk" } as const;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("incidents") };
}

export default async function IncidentPage({ params }: PageProps<"/admin/incidents/[id]">) {
  const { v, inc } = await incidentForPage((await params).id);
  const locale = await getLocale();
  const [tr, ts, tn, tc, format] = await Promise.all([getTranslations("secops.incidents"), getTranslations("secops"), getTranslations("admin.nav"), getTranslations("common"), getFormatter()]);
  const [mod, sandbox, report, progress, risks, scores] = await Promise.all([
    inc.trainingModuleId ? db().select({ id: t.modules.id, slug: t.modules.slug, title: t.modules.title }).from(t.modules).where(eq(t.modules.id, inc.trainingModuleId)) : Promise.resolve([]),
    inc.sandboxId ? db().select({ id: t.sandboxAnalyses.id, number: t.sandboxAnalyses.number }).from(t.sandboxAnalyses).where(eq(t.sandboxAnalyses.id, inc.sandboxId)) : Promise.resolve([]),
    inc.reportId ? db().select({ id: t.threatReports.id, number: t.threatReports.number }).from(t.threatReports).where(eq(t.threatReports.id, inc.reportId)) : Promise.resolve([]),
    inc.trainingModuleId && inc.targetUserIds.length
      ? db().select().from(t.moduleProgress).where(and(eq(t.moduleProgress.moduleId, inc.trainingModuleId), inArray(t.moduleProgress.userId, inc.targetUserIds)))
      : Promise.resolve([]),
    db().select({ userId: t.behaviorRisks.userId, status: t.behaviorRisks.status, moduleId: t.behaviorRisks.moduleId }).from(t.behaviorRisks).where(and(eq(t.behaviorRisks.tenantId, v.tenant.id), eq(t.behaviorRisks.sourceRef, `IR-${inc.number}`))),
    inc.trainingModuleId ? moduleScores(db(), inc.trainingModuleId, inc.targetUserIds) : Promise.resolve(new Map<string, number>()),
  ]);
  const people = await peopleById(v.tenant.id, [...inc.targetUserIds, inc.createdBy]);
  const progressBy = new Map(progress.map((p) => [p.userId, p]));
  const riskBy = new Map(risks.map((r) => [r.userId, r.status]));
  // People who already got this lesson from the incident (open or closed risk); the rest can still be assigned.
  const covered = new Set(risks.filter((r) => r.moduleId === inc.trainingModuleId).map((r) => r.userId));
  // Finished counts only above the pass mark; below it the lesson shows as "below pass mark".
  const passed = (uid: string) => progressBy.get(uid)?.status === "completed" && (!inc.minScore || (scores.get(uid) ?? 0) >= inc.minScore);
  const completed = inc.targetUserIds.filter(passed).length;
  const canWrite = allowed(v, "secops.write");
  const options = canWrite ? await formOptions(v.tenant.id, locale) : null;
  const iocText = inc.iocs.map((i) => (i.type === "sha256" || i.type === "filename" ? i.value : defang(i.value))).join("\n");

  return (
    <div className="grid gap-5">
      <PageHeader
        back={{ href: "/admin/incidents", label: tn("incidents") }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="font-mono text-title text-ink-subtle">IR-{inc.number}</span>
            {inc.title}
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Pill tone={SEV_TONE[inc.severity]}>{tc(`severity.${inc.severity}`)}</Pill>
            <Pill tone={inc.status === "resolved" ? "safe" : inc.status === "investigating" ? "brand" : "warn"}>{tr(`statuses.${inc.status}`)}</Pill>
            {inc.live && inc.status !== "resolved" ? <Pill tone="risk">{tr("live")}</Pill> : null}
            {inc.confidential ? (
              <Pill tone="ink">
                <Lock className="size-3.5" />
                {tr("confidential")}
              </Pill>
            ) : null}
            <span>{tr("openedBy", { name: people.get(inc.createdBy ?? "")?.name ?? ts("unknownPerson"), date: format.dateTime(inc.createdAt, { dateStyle: "medium" }) })}</span>
            {inc.resolvedAt ? <span>· {tr("resolvedOn", { date: format.dateTime(inc.resolvedAt, { dateStyle: "medium" }) })}</span> : null}
          </span>
        }
        icon={<Siren />}
        actions={canWrite ? <IncidentControls id={inc.id} status={inc.status} live={inc.live} canAssign={!!inc.trainingModuleId && inc.targetUserIds.some((u) => !covered.has(u))} /> : null}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          {inc.description ? (
            <Card>
              <CardHeader title={tr("description")} />
              <CardBody className="pt-3">
                <p className="text-body-sm whitespace-pre-line">{inc.description}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title={tr("trainingProgress")}
              icon={<GraduationCap />}
              description={
                mod[0]
                  ? [
                      pick(mod[0].title, locale),
                      inc.minScore ? tr("minScoreValue", { score: inc.minScore }) : null,
                      inc.dueDate ? tr("dueValue", { date: format.dateTime(new Date(`${inc.dueDate}T12:00:00`), { dateStyle: "medium" }) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : tr("noModule")
              }
              action={
                <span className="flex flex-wrap items-center gap-2">
                  {inc.autoTrainingAt ? <Pill tone="safe">{tr("assignedOn", { date: format.dateTime(inc.autoTrainingAt, { dateStyle: "medium" }) })}</Pill> : null}
                  {options && inc.status !== "resolved" ? (
                    <IncidentTrainingEditor
                      id={inc.id}
                      initial={{ moduleId: inc.trainingModuleId, minScore: inc.minScore, dueDate: inc.dueDate, userIds: inc.targetUserIds }}
                      modules={options.modules}
                      departments={options.departments}
                      people={options.people}
                      defaultDue={bakuDayPlus(7)}
                    />
                  ) : null}
                </span>
              }
            />
            <CardBody className="grid gap-4 pt-4">
              {inc.trainingModuleId && inc.targetUserIds.length ? (
                <>
                  <div className="flex items-center gap-3">
                    <ProgressBar tone="safe" value={(completed / inc.targetUserIds.length) * 100} label={tr("trainingProgress")} />
                    <span className="shrink-0 text-caption font-semibold tabular-nums">
                      {completed} / {inc.targetUserIds.length}
                    </span>
                  </div>
                  {!inc.autoTrainingAt ? <p className="text-caption text-ink-muted">{tr("notAssigned")}</p> : null}
                  <ScrollRegion label={tr("trainingProgress")}>
                    <table className="w-full min-w-[34rem] text-start text-caption">
                      <thead className="text-tab text-ink-subtle">
                        <tr className="border-b border-line">
                          <th className="py-2 font-semibold">{tr("person")}</th>
                          <th className="py-2 font-semibold">{tr("progress")}</th>
                          <th className="py-2 text-end font-semibold">{tr("score")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {inc.targetUserIds.map((uid) => {
                          const p = people.get(uid);
                          const pr = progressBy.get(uid);
                          const score = scores.get(uid);
                          const status = pr?.status ?? "not_started";
                          return (
                            <tr key={uid}>
                              <td className="py-2.5">
                                {p ? (
                                  <Link href={`/admin/users/${uid}`} className="font-semibold hover:text-brand-700">
                                    {p.name}
                                  </Link>
                                ) : (
                                  ts("unknownPerson")
                                )}
                                {p?.departmentName ? <span className="block text-tab text-ink-subtle">{p.departmentName}</span> : null}
                              </td>
                              <td className="py-2.5">
                                {status === "completed" && !passed(uid) ? (
                                  <Pill tone="warn">{tr("belowMark")}</Pill>
                                ) : (
                                  <Pill tone={status === "completed" ? "safe" : status === "not_started" ? (riskBy.get(uid) === "open" ? "warn" : "neutral") : "brand"}>{tr(`progressStatus.${status}`)}</Pill>
                                )}
                              </td>
                              <td className="py-2.5 text-end tabular-nums">
                                {score === undefined ? (
                                  "—"
                                ) : (
                                  <span className={inc.minScore && score < inc.minScore ? "font-semibold text-risk-600" : "font-semibold text-safe-700"} title={inc.minScore ? (score < inc.minScore ? tr("belowMark") : tr("passed")) : undefined}>
                                    {score}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollRegion>
                </>
              ) : (
                <p className="text-caption text-ink-muted">{tr("notAssigned")}</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader title={tr("indicators")} action={inc.iocs.length ? <CopyText text={iocText} label={tr("copyIocs")} /> : null} />
            <CardBody className="pt-3">
              {inc.iocs.length ? (
                <ul className="grid gap-1.5">
                  {inc.iocs.map((i, k) => (
                    <li key={k} className="flex gap-2 font-mono text-tab">
                      <span className="w-24 shrink-0 text-ink-subtle">{ts(`iocTypes.${i.type}`)}</span>
                      <span dir="ltr" className="min-w-0 break-all">{i.type === "sha256" || i.type === "filename" ? i.value : defang(i.value)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-ink-muted">{tr("noIocs")}</p>
              )}
              {inc.mitre.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {inc.mitre.map((m) => (
                    <a key={m} href={`https://attack.mitre.org/techniques/${m.replace(".", "/")}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-pill bg-ink px-2.5 py-1 font-mono text-tab-sm font-semibold text-white hover:bg-ink/85 pointer-coarse:min-h-11 pointer-coarse:px-3.5">
                      {m}
                    </a>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
          {sandbox[0] || report[0] ? (
            <Card>
              <CardHeader title={tr("linked")} />
              <CardBody className="grid gap-1 pt-3">
                {sandbox[0] ? (
                  <Link href={`/admin/sandbox/${sandbox[0].id}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-body-sm font-semibold hover:bg-sunken">
                    <FlaskConical className="size-4 text-brand-600" />
                    {tr("sandboxLink", { number: sandbox[0].number })}
                  </Link>
                ) : null}
                {report[0] ? (
                  <Link href={`/admin/threats?status=all&focus=${report[0].id}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-body-sm font-semibold hover:bg-sunken">
                    <Inbox className="size-4 text-brand-600" />
                    {tr("reportLink", { number: report[0].number })}
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
