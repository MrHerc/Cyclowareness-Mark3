import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { FileText, FlaskConical, Link2 } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { SandboxPanel, VerdictBadge } from "@/components/sandbox/sandbox-panel";
import { defang } from "@/lib/defang";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("sandbox") };
}

const FILTERS = ["all", "malicious", "suspicious", "clean", "url", "file"] as const;

export default async function AnalystSandboxPage({ searchParams }: PageProps<"/admin/sandbox">) {
  const v = await requirePermission("secops.read");
  if (!hasFeature(v, "sandbox")) notFound();
  const sp = await searchParams;
  const filter = FILTERS.includes(sp.f as "all") ? (sp.f as (typeof FILTERS)[number]) : "all";
  const [tr, tn, format] = await Promise.all([getTranslations("secops.sandbox"), getTranslations("admin.nav"), getFormatter()]);
  const all = await db().select().from(t.sandboxAnalyses).where(eq(t.sandboxAnalyses.tenantId, v.tenant.id)).orderBy(desc(t.sandboxAnalyses.createdAt)).limit(300);
  const list = all.filter((a) => filter === "all" || a.verdict === filter || a.kind === filter);
  const people = await peopleById(v.tenant.id, list.map((a) => a.submittedBy));

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("sandbox")} subtitle={tr("subtitle")} icon={<FlaskConical />} />
      <SandboxPanel analyst />
      <Card>
        <CardHeader title={tr("recent")} />
        <CardBody className="grid gap-4 pt-4">
          <TabsNav items={FILTERS.map((f) => ({ href: `?f=${f}`, label: tr(`filters.${f}`), active: filter === f, count: f === "all" ? all.length : all.filter((a) => a.verdict === f || a.kind === f).length }))} />
          {list.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-caption">
                <thead className="text-tab text-ink-subtle">
                  <tr className="border-b border-line">
                    <th className="py-2 font-semibold">#</th>
                    <th className="py-2 font-semibold">{tr("object")}</th>
                    <th className="py-2 font-semibold">{tr("submittedBy")}</th>
                    <th className="py-2 font-semibold">{tr("verdict")}</th>
                    <th className="py-2 text-right font-semibold">{tr("score")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((a) => (
                    <tr key={a.id} className="hover:bg-sunken/60">
                      <td className="py-2.5 font-mono text-ink-subtle">
                        <Link href={`/admin/sandbox/${a.id}`} className="hover:text-brand-700">
                          SB-{a.number}
                        </Link>
                      </td>
                      <td className="max-w-80 py-2.5">
                        <Link href={`/admin/sandbox/${a.id}`} className="flex items-center gap-2 font-semibold hover:text-brand-700">
                          {a.kind === "url" ? <Link2 className="size-4 shrink-0 text-ink-subtle" /> : <FileText className="size-4 shrink-0 text-ink-subtle" />}
                          <span className="truncate font-mono">{a.kind === "url" ? defang(a.objectName) : a.objectName}</span>
                        </Link>
                        <span className="block text-tab text-ink-subtle">{format.dateTime(a.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                      </td>
                      <td className="py-2.5">{a.submittedBy ? (people.get(a.submittedBy)?.name ?? "—") : "—"}</td>
                      <td className="py-2.5">
                        <VerdictBadge verdict={a.verdict} />
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{a.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<FlaskConical />} title={tr("empty")} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
