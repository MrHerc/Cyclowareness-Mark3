import { eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download, FlaskConical, Siren } from "lucide-react";
import { allowed, hasFeature } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { AnalysisResult } from "@/components/sandbox/sandbox-panel";
import { analysisForPage } from "./analysis";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("sandbox") };
}

export default async function SandboxAnalysisPage({ params }: PageProps<"/admin/sandbox/[id]">) {
  const { v, a } = await analysisForPage((await params).id);
  const [tr, tn, format] = await Promise.all([getTranslations("secops.sandbox"), getTranslations("admin.nav"), getFormatter()]);
  const [incident] = a.incidentId ? await db().select({ id: t.incidents.id, number: t.incidents.number }).from(t.incidents).where(eq(t.incidents.id, a.incidentId)) : [];
  const people = await peopleById(v.tenant.id, [a.submittedBy]);
  const who = a.submittedBy ? people.get(a.submittedBy) : null;

  return (
    <div className="grid gap-5">
      <PageHeader
        back={{ href: "/admin/sandbox", label: tn("sandbox") }}
        title={`SB-${a.number}`}
        subtitle={[who ? `${tr("submittedBy")}: ${who.name}` : null, format.dateTime(a.createdAt, { dateStyle: "medium", timeStyle: "short" }), a.sizeBytes ? tr("size", { kb: Math.max(1, Math.round(a.sizeBytes / 1024)) }) : null].filter(Boolean).join(" · ")}
        icon={<FlaskConical />}
        actions={
          <>
            <ButtonAnchor href={`/api/sandbox/${a.id}/stix`} variant="secondary" icon={<Download />}>
              {tr("stix")}
            </ButtonAnchor>
            {incident ? (
              <ButtonLink href={`/admin/incidents/${incident.id}`} variant="secondary" icon={<Siren />}>
                {tr("incidentLinked", { number: incident.number })}
              </ButtonLink>
            ) : allowed(v, "secops.write") && hasFeature(v, "incidents") && a.verdict !== "clean" ? (
              <ButtonLink href={`/admin/incidents?sandbox=${a.id}`} icon={<Siren />}>
                {tr("createIncident")}
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <AnalysisResult a={a} />
      {a.sha256 ? (
        <p className="text-caption text-ink-muted">
          {tr("sha")}: <code className="font-mono break-all">{a.sha256}</code>
        </p>
      ) : null}
    </div>
  );
}
