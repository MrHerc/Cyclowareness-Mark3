import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, count, eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { getDepartments } from "@/server/queries/admin";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { TEMPLATE_BY_KEY } from "@/lib/campaigns/templates";
import { CampaignWizard } from "./wizard";

const editIdOf = (sp: { edit?: string | string[] }) => (typeof sp.edit === "string" && /^[0-9a-f-]{36}$/.test(sp.edit) ? sp.edit : null);

export async function generateMetadata({ searchParams }: PageProps<"/admin/campaigns/new">) {
  const tr = await getTranslations("admin.campaigns");
  return { title: editIdOf(await searchParams) ? tr("edit") : tr("new") };
}

/** `?edit=<id>` reopens a draft or scheduled campaign of this tenant in the wizard; saving then updates it. */
export default async function NewCampaignPage({ searchParams }: PageProps<"/admin/campaigns/new">) {
  const v = await requirePermission("campaigns.write");
  const editId = editIdOf(await searchParams);
  const tr = await getTranslations("admin.campaigns");
  const [departments, counts, editing] = await Promise.all([
    getDepartments(v.tenant.id),
    db().select({ departmentId: t.users.departmentId, n: count() }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"))).groupBy(t.users.departmentId),
    editId ? db().select().from(t.campaigns).where(and(eq(t.campaigns.id, editId), eq(t.campaigns.tenantId, v.tenant.id))) : Promise.resolve([]),
  ]);
  const campaign = editing[0] ?? null;
  if (editId && !campaign) notFound();
  if (campaign && campaign.status !== "draft" && campaign.status !== "scheduled") redirect(`/admin/campaigns/${campaign.id}`);
  const tpl = campaign ? TEMPLATE_BY_KEY.get(campaign.templateKey) : undefined;
  const initial = campaign
    ? {
        id: campaign.id,
        name: campaign.name,
        templateKey: campaign.templateKey,
        channel: tpl?.channel ?? (campaign.channel === "qr" ? ("email" as const) : campaign.channel),
        audience: campaign.audience,
        departmentId: campaign.departmentId,
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      }
    : undefined;
  const cm = new Map(counts.map((c) => [c.departmentId, Number(c.n)]));
  return (
    <div className="grid gap-5">
      <PageHeader title={campaign ? tr("edit") : tr("new")} back={{ href: "/admin/campaigns", label: tr("allCampaigns") }} />
      <Card>
        <CardBody>
          <CampaignWizard smsVoice={v.tenant.features.has("sms_voice")} departments={departments.map((d) => ({ id: d.id, name: d.name, people: cm.get(d.id) ?? 0 }))} initial={initial} />
        </CardBody>
      </Card>
    </div>
  );
}
