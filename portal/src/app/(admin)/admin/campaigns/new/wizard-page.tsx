import { getTranslations } from "next-intl/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db, t } from "@/server/db";
import type { Viewer } from "@/server/auth/viewer";
import { requestNow } from "@/lib/time";
import { getDepartments } from "@/server/queries/admin";
import { departmentClosure } from "@/server/services/assignments";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { TEMPLATE_BY_KEY } from "@/lib/campaigns/templates";
import { CampaignWizard } from "./wizard";

/** The campaign wizard page: empty for /admin/campaigns/new, prefilled with a draft or scheduled campaign for /admin/campaigns/edit/[id]. */
export async function WizardPage({ v, campaign }: { v: Viewer; campaign: typeof t.campaigns.$inferSelect | null }) {
  const tr = await getTranslations("admin.campaigns");
  const [departments, counts] = await Promise.all([
    getDepartments(v.tenant.id),
    // Same population as campaignAudience: active members, never the platform's super admins.
    db()
      .select({ departmentId: t.users.departmentId, n: count() })
      .from(t.users)
      .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin")))
      .groupBy(t.users.departmentId),
  ]);
  const tpl = campaign ? TEMPLATE_BY_KEY.get(campaign.templateKey) : undefined;
  const initial = campaign
    ? {
        id: campaign.id,
        name: campaign.name,
        templateKey: campaign.templateKey,
        channel: tpl?.channel ?? (campaign.channel === "qr" ? ("email" as const) : campaign.channel),
        audience: campaign.audience,
        departmentId: campaign.departmentId,
        // A send time that has passed (a draft from before scheduled launches cleared it) is not offered again.
        scheduledAt: campaign.scheduledAt && campaign.scheduledAt > requestNow() ? campaign.scheduledAt.toISOString() : null,
      }
    : undefined;
  const cm = new Map(counts.map((c) => [c.departmentId, Number(c.n)]));
  // A department audience reaches the department and all of its sub-departments.
  const closure = departmentClosure(departments);
  const reach = (id: string) => [...(closure.get(id) ?? [id])].reduce((sum, d) => sum + (cm.get(d) ?? 0), 0);
  return (
    <div className="grid gap-5">
      <PageHeader title={campaign ? tr("edit") : tr("new")} back={{ href: "/admin/campaigns", label: tr("allCampaigns") }} />
      <Card>
        <CardBody>
          <CampaignWizard smsVoice={v.tenant.features.has("sms_voice")} qrTrap={v.tenant.features.has("qr_trap")} departments={departments.map((d) => ({ id: d.id, name: d.name, people: reach(d.id) }))} initial={initial} />
        </CardBody>
      </Card>
    </div>
  );
}
