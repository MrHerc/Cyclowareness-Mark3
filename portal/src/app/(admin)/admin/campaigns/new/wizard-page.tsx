import { getLocale, getTranslations } from "next-intl/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db, t } from "@/server/db";
import type { Viewer } from "@/server/auth/viewer";
import { requestNow } from "@/lib/time";
import { getDepartments } from "@/server/queries/admin";
import { departmentClosure } from "@/server/services/assignments";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { TemplatePreview } from "@/components/admin/template-preview";
import { TEMPLATES, TEMPLATE_BY_KEY, templateText, type CampaignTemplate } from "@/lib/campaigns/templates";
import { CampaignWizard, type WizardPreviews, type WizardTemplate } from "./wizard";

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
  // The templates' ten-language texts stay on the server: the wizard gets their names and previews in this locale.
  const locale = await getLocale();
  const qrTrap = v.tenant.features.has("qr_trap");
  const summary = (x: CampaignTemplate): WizardTemplate => ({ key: x.key, name: templateText(x.name, locale), channel: x.channel, difficulty: x.difficulty });
  // QR traps only on a plan with the qr_trap feature (the server refuses them otherwise).
  // Voice templates stay defined but are not offered: no telephony adapter places calls (launchBlocker refuses them).
  const offered = TEMPLATES.filter((x) => x.channel !== "voice" && (qrTrap || !x.qr));
  const tpl = campaign ? TEMPLATE_BY_KEY.get(campaign.templateKey) : undefined;
  const previews: WizardPreviews = {};
  for (const x of tpl && !offered.includes(tpl) ? [...offered, tpl] : offered) {
    previews[x.key] = { compact: <TemplatePreview tpl={x} locale={locale} compact />, full: <TemplatePreview tpl={x} locale={locale} /> };
  }
  const initial = campaign
    ? {
        id: campaign.id,
        name: campaign.name,
        templateKey: campaign.templateKey,
        // A draft's template stays reviewable even when it is no longer offered (a plan without qr_trap now).
        template: tpl ? summary(tpl) : null,
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
          <CampaignWizard smsVoice={v.tenant.features.has("sms_voice")} templates={offered.map(summary)} previews={previews} departments={departments.map((d) => ({ id: d.id, name: d.name, people: reach(d.id) }))} initial={initial} />
        </CardBody>
      </Card>
    </div>
  );
}
