import { getFormatter, getTranslations } from "next-intl/server";
import { Download, Globe2 } from "lucide-react";
import { requirePermission } from "@/server/auth/viewer";
import { platformMetrics } from "@/server/queries/platform-metrics";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonAnchor } from "@/components/ui/button";
import { PageHeader, TabsNav } from "@/components/ui/layout";
import { ScrollRegion } from "@/components/ui/scroll-region";

export async function generateMetadata() {
  const tr = await getTranslations("admin.platform.tabs");
  return { title: tr("metrics") };
}

const COLUMNS = ["active", "weekly", "monthly", "lessonsStarted", "lessonsCompleted", "modulesCompleted", "sent", "opened", "clicked", "reported", "certificates"] as const;

export default async function OperatorMetricsPage() {
  await requirePermission("platform.manage");
  const [tr, tm, format, rows] = await Promise.all([getTranslations("admin.platform"), getTranslations("admin.platform.metrics"), getFormatter(), platformMetrics()]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tr("title")}
        subtitle={tr("subtitle")}
        icon={<Globe2 />}
        actions={
          <ButtonAnchor href="/api/super/seats" variant="secondary" icon={<Download />}>
            {tm("export")}
          </ButtonAnchor>
        }
      />
      <TabsNav
        items={[
          { href: "/super", label: tr("tabs.tenants"), active: false },
          { href: "/super/metrics", label: tr("tabs.metrics"), active: true },
          { href: "/super/demo", label: tr("tabs.demo"), active: false },
        ]}
      />
      <Card>
        <CardHeader title={tm("table")} description={tm("note")} />
        <CardBody className="pt-3">
          <ScrollRegion label={tm("table")}>
            <table className="w-full min-w-[64rem] text-start text-body-sm">
              <thead className="text-tab font-semibold text-ink-subtle">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2.5 pe-3 text-start font-semibold">
                    {tm("col.organisation")}
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2.5 text-end font-semibold">
                      {tm(`col.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3 pe-3 text-start font-semibold">
                      {r.name}
                      <span className="block font-mono text-tab font-normal text-ink-subtle">{r.slug}</span>
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c} className="px-3 py-3 text-end tabular-nums">
                        {format.number(r[c])}
                      </td>
                    ))}
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
