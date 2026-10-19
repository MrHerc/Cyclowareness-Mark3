import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { FileText, Recycle, Siren, Users } from "lucide-react";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { LOOP_STAGES } from "@/server/db/schema";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { PageHeader } from "@/components/ui/layout";
import { StageTrack } from "@/components/secops/stage-track";
import { LoopActions } from "@/components/secops/intake";

const VERDICT_TONE = { malicious: "risk", suspicious: "warn", pending: "neutral", benign: "safe" } as const;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("loops") };
}

export default async function LoopPage({ params }: PageProps<"/admin/loops/[id]">) {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "closed_loops")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [loop] = await db().select().from(t.loops).where(and(eq(t.loops.id, id), eq(t.loops.tenantId, v.tenant.id)));
  if (!loop) notFound();
  const [tr, ts, tn, format] = await Promise.all([getTranslations("secops.loops"), getTranslations("secops"), getTranslations("admin.nav"), getFormatter()]);
  const [events, materials, incident] = await Promise.all([
    db().select().from(t.loopEvents).where(eq(t.loopEvents.loopId, loop.id)).orderBy(asc(t.loopEvents.at)),
    db()
      .select({ id: t.materials.id, title: t.materials.title, status: t.materials.status })
      .from(t.materials)
      .where(and(eq(t.materials.tenantId, v.tenant.id), or(eq(t.materials.loopId, loop.id), loop.materialId ? eq(t.materials.id, loop.materialId) : undefined))),
    loop.incidentId ? db().select({ id: t.incidents.id, number: t.incidents.number, title: t.incidents.title }).from(t.incidents).where(eq(t.incidents.id, loop.incidentId)) : Promise.resolve([]),
  ]);
  const people = await peopleById(v.tenant.id, events.map((e) => e.actorId));
  const labels = Object.fromEntries(LOOP_STAGES.map((s) => [s, ts(`stages.${s}`)])) as Record<(typeof LOOP_STAGES)[number], string>;
  const at = LOOP_STAGES.indexOf(loop.stage);
  const next = at < LOOP_STAGES.length - 1 ? LOOP_STAGES[at + 1] : null;
  const canWrite = allowed(v, "secops.write");

  return (
    <div className="grid gap-5">
      <PageHeader
        back={{ href: "/admin/loops", label: tn("loops") }}
        title={loop.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Pill tone={VERDICT_TONE[loop.verdict]}>{ts(`verdicts.${loop.verdict}`)}</Pill>
            <span>{ts(`sources.${loop.sourceType}`)}</span>
            <span>·</span>
            <span>{loop.closedAt ? tr("closedOn", { date: format.dateTime(loop.closedAt, { dateStyle: "medium" }) }) : tr("openedOn", { date: format.dateTime(loop.createdAt, { dateStyle: "medium" }) })}</span>
          </span>
        }
        icon={<Recycle />}
        actions={canWrite ? <LoopActions id={loop.id} next={next} verdict={loop.verdict} closed={!!loop.closedAt} /> : null}
      />
      <Card>
        <CardBody>
          <StageTrack stage={loop.stage} closed={!!loop.closedAt} labels={labels} size="lg" />
          {!loop.closedAt ? <p className="mt-4 text-caption text-ink-muted">{ts(`stageHelp.${loop.stage}`)}</p> : null}
        </CardBody>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={tr("timeline")} />
          <CardBody className="pt-3">
            <ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[0.45rem] before:w-px before:bg-line">
              {events.map((e) => (
                <li key={e.id} className="relative flex gap-3">
                  <span className="z-10 mt-1 size-[0.95rem] shrink-0 rounded-full border-2 border-surface bg-brand-500 ring-1 ring-brand-200" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold">{ts(`stages.${e.stage}`)}</p>
                    <p className="text-tab text-ink-subtle">
                      {e.actorId ? (people.get(e.actorId)?.name ?? ts("unknownPerson")) : tr("systemActor")} · {format.dateTime(e.at, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {e.note ? <p className="mt-1.5 rounded-md bg-sunken px-3 py-2 text-caption">{e.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title={tr("linked")} />
          <CardBody className="grid gap-2 pt-3">
            {incident[0] ? (
              <Link href={`/admin/incidents/${incident[0].id}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-body-sm font-semibold hover:bg-sunken">
                <Siren className="size-4 text-risk-600" />
                {tr("incident", { number: incident[0].number })}
              </Link>
            ) : null}
            {materials.map((m) => (
              <Link key={m.id} href={`/admin/approvals?tab=${m.status === "pending" ? "pending" : m.status === "second_approval" ? "second" : "decided"}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-body-sm font-semibold hover:bg-sunken">
                <FileText className="size-4 text-brand-600" />
                <span className="min-w-0 flex-1 truncate">{tr("material", { title: m.title })}</span>
                <Pill tone={m.status === "approved" ? "safe" : m.status === "rejected" ? "risk" : "warn"}>{ts(`approvals.status.${m.status}`)}</Pill>
              </Link>
            ))}
            {loop.trainedCount ? (
              <p className="flex items-center gap-2 px-2 py-2 text-body-sm text-ink-muted">
                <Users className="size-4" />
                {tr("trained", { count: loop.trainedCount })}
              </p>
            ) : null}
            {!incident[0] && !materials.length && !loop.trainedCount ? <p className="text-caption text-ink-muted">{tr("noLinked")}</p> : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
