import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { and, asc, eq } from "drizzle-orm";
import { Check, Minus } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { campaignAudience, campaignStats } from "@/server/services/campaigns";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Funnel } from "@/components/ui/charts";
import { PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { CampaignActions } from "@/components/admin/campaign-actions";
import { TemplatePreview } from "@/components/admin/template-preview";
import { TEMPLATE_BY_KEY, templateText } from "@/lib/campaigns/templates";

export default async function CampaignPage({ params }: PageProps<"/admin/campaigns/[id]">) {
  const { id } = await params;
  const v = await requirePermission("campaigns.read");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await db().select().from(t.campaigns).where(and(eq(t.campaigns.id, id), eq(t.campaigns.tenantId, v.tenant.id)));
  if (!c) notFound();
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("admin.campaigns"), getTranslations("common"), getFormatter()]);
  const tpl = TEMPLATE_BY_KEY.get(c.templateKey);
  const [stats, audience, recipients, dept] = await Promise.all([
    campaignStats(db(), [c.id]),
    campaignAudience(db(), c),
    db()
      .select({ r: t.campaignRecipients, name: t.users.name, avatar: t.users.avatarUrl, department: t.departments.name })
      .from(t.campaignRecipients)
      .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
      .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
      .where(eq(t.campaignRecipients.campaignId, c.id))
      .orderBy(asc(t.users.name)),
    c.departmentId ? db().select({ name: t.departments.name }).from(t.departments).where(eq(t.departments.id, c.departmentId)) : Promise.resolve([]),
  ]);
  const s = stats.get(c.id) ?? { sent: 0, opened: 0, clicked: 0, submitted: 0, reported: 0 };
  const pct = (n: number) => (s.sent ? Math.round((n / s.sent) * 100) : 0);
  const mark = (d: Date | null, tone: "risk" | "safe" | "brand") =>
    d ? <Check className={tone === "risk" ? "mx-auto size-4 text-risk-600" : tone === "safe" ? "mx-auto size-4 text-safe-600" : "mx-auto size-4 text-brand-600"} /> : <Minus className="mx-auto size-4 text-ink-disabled" />;

  return (
    <div className="grid gap-5">
      <PageHeader
        title={c.name}
        back={{ href: "/admin/campaigns", label: tr("allCampaigns") }}
        actions={allowed(v, "campaigns.write") ? <CampaignActions id={c.id} status={c.status} audience={audience.length} channel={c.channel} /> : null}
      />
      <div className="flex flex-wrap gap-2">
        <Pill tone={c.status === "completed" ? "safe" : c.status === "running" ? "brand" : "neutral"}>{tr(`status.${c.status}`)}</Pill>
        <Pill>{tr(`channel.${c.channel === "qr" ? "email" : c.channel}`)}</Pill>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr("results")} description={tr("resultsSub")} />
          <CardBody className="grid gap-4 pt-3">
            <p className="text-caption text-ink-muted">
              {tr("reportRate")}: <b className="text-title text-safe-700">{pct(s.reported)}%</b>
            </p>
            <Funnel
              steps={[
                { label: tr("sent"), value: s.sent, tone: "neutral" },
                { label: tr("opened"), value: s.opened, share: pct(s.opened), tone: "brand" },
                { label: tr("clicked"), value: s.clicked, share: pct(s.clicked), tone: "risk" },
                ...(tpl?.harvest ? [{ label: tr("submitted"), value: s.submitted, share: pct(s.submitted), tone: "risk" as const }] : []),
                { label: tr("reported"), value: s.reported, share: pct(s.reported), tone: "safe" },
              ]}
            />
          </CardBody>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title={tr("audienceTiming")} />
            <CardBody className="pt-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-sm">
                <dt className="text-ink-muted">{tr("audience")}</dt>
                <dd className="font-semibold">{c.audience === "all" ? tr("wholeOrg") : (dept[0]?.name ?? "—")}</dd>
                <dt className="text-ink-muted">{tr("peopleInAudience")}</dt>
                <dd className="font-semibold">{c.launchedAt ? recipients.length : audience.length}</dd>
                <dt className="text-ink-muted">{tr("sendTime")}</dt>
                <dd className="font-semibold">
                  {c.launchedAt ? format.dateTime(c.launchedAt, { dateStyle: "medium", timeStyle: "short" }) : c.scheduledAt ? format.dateTime(c.scheduledAt, { dateStyle: "medium", timeStyle: "short" }) : tr("draftSaved")}
                </dd>
                <dt className="text-ink-muted">{tr("channelLabel")}</dt>
                <dd className="font-semibold">{tr(`channel.${c.channel === "qr" ? "email" : c.channel}`)}</dd>
              </dl>
            </CardBody>
          </Card>
          {tpl ? (
            <Card>
              <CardHeader title={tr("template")} description={`${templateText(tpl.name, locale)} · ${tr("difficulty", { level: tc(`difficulty.${tpl.difficulty}`) })}`} />
              <CardBody className="pt-3">
                <TemplatePreview tpl={tpl} locale={locale} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
      {recipients.length ? (
        <Card>
          <CardHeader title={tr("recipients")} />
          <CardBody className="overflow-x-auto pt-3">
            <table className="w-full min-w-[40rem] text-body-sm">
              <thead className="text-tab text-ink-subtle">
                <tr className="border-b border-line">
                  <th className="py-2.5 pr-3 text-left font-semibold">{tr("col.person")}</th>
                  <th className="px-3 py-2.5 text-left font-semibold">{tr("col.department")}</th>
                  <th className="px-3 py-2.5 font-semibold">{tr("col.opened")}</th>
                  <th className="px-3 py-2.5 font-semibold">{tr("col.clicked")}</th>
                  <th className="px-3 py-2.5 font-semibold">{tr("col.reported")}</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(({ r, name, avatar, department }) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <Avatar name={name} src={avatar} size="xs" />
                        {name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{department ?? "—"}</td>
                    <td className="px-3 py-2.5 text-center">{mark(r.openedAt, "brand")}</td>
                    <td className="px-3 py-2.5 text-center">{mark(r.clickedAt, "risk")}</td>
                    <td className="px-3 py-2.5 text-center">{mark(r.reportedAt, "safe")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
