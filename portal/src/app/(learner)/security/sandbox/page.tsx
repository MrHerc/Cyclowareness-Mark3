import { getTranslations } from "next-intl/server";
import { getAppFormatter } from "@/i18n/server-format";
import { and, desc, eq } from "drizzle-orm";
import { FlaskConical, Info } from "lucide-react";
import { db, t } from "@/server/db";
import { requireFeature } from "@/server/auth/viewer";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/layout";
import { SandboxPanel, VerdictBadge } from "@/components/sandbox/sandbox-panel";
import { defang } from "@/lib/defang";

export async function generateMetadata() {
  const tr = await getTranslations("security.sandbox");
  return { title: tr("title") };
}

export default async function LearnerSandboxPage() {
  const v = await requireFeature("sandbox");
  const [tr, tn, format] = await Promise.all([getTranslations("security.sandbox"), getTranslations("security"), getAppFormatter()]);
  const recent = await db()
    .select()
    .from(t.sandboxAnalyses)
    .where(and(eq(t.sandboxAnalyses.submittedBy, v.user.id), eq(t.sandboxAnalyses.tenantId, v.tenant.id)))
    .orderBy(desc(t.sandboxAnalyses.createdAt))
    .limit(8);
  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} icon={<FlaskConical />} back={{ href: "/security", label: tn("title") }} />
      <Notice tone="warn" icon={<Info />} title={tr("mode")}>
        {tr("modeBody")}
      </Notice>
      <SandboxPanel />
      {recent.length ? (
        <Card>
          <CardHeader title={tr("recent")} />
          <CardBody>
            <ul className="divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-mono text-tab text-ink-subtle">SB-{a.number}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-caption">{a.kind === "url" ? defang(a.objectName) : a.objectName}</span>
                  <VerdictBadge verdict={a.verdict} />
                  <span className="text-tab tabular-nums">{a.score}/100</span>
                  <span className="text-tab text-ink-subtle">{format.relativeTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
