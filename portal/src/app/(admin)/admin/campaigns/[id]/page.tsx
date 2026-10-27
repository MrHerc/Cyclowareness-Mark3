import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, Check, Minus } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed } from "@/server/auth/viewer";
import { campaignAudience, campaignStats } from "@/server/services/campaigns";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Funnel } from "@/components/ui/charts";
import { Notice, PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { CampaignActions } from "@/components/admin/campaign-actions";
import { TemplatePreview } from "@/components/admin/template-preview";
import { TEMPLATE_BY_KEY, templateText } from "@/lib/campaigns/templates";
import { campaignForPage } from "./campaign";

export async function generateMetadata({ params }: PageProps<"/admin/campaigns/[id]">) {
  const { c } = await campaignForPage((await params).id);
  return { title: c.name };
}

export default async function CampaignPage({ params }: PageProps<"/admin/campaigns/[id]">) {
  const { v, c } = await campaignForPage((await params).id);
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
  // A campaign that has not started yet shows why its last launch (scheduled or manual) was refused,
  // until it is edited (rescheduled, audience changed) after that.
  const [last] =
    c.status === "draft" || c.status === "scheduled"
      ? await db()
          .select({ action: t.auditLog.action, at: t.auditLog.at, meta: t.auditLog.meta })
          .from(t.auditLog)
          .where(and(eq(t.auditLog.tenantId, v.tenant.id), inArray(t.auditLog.action, ["campaign.launch_blocked", "campaign.changed"]), eq(t.auditLog.targetId, c.id)))
          .orderBy(desc(t.auditLog.at))
          .limit(1)
      : [];
  const blocked = last?.action === "campaign.launch_blocked" ? last : undefined;
  const blockedReason = blocked && ["mail", "sms", "voice", "empty", "plan"].includes(String(blocked.meta?.reason)) ? (String(blocked.meta?.reason) as "mail") : null;
  const s = stats.get(c.id) ?? { sent: 0, opened: 0, clicked: 0, submitted: 0, reported: 0 };
  const pct = (n: number) => (s.sent ? Math.round((n / s.sent) * 100) : 0);
  const mark = (d: Date | null, tone: "risk" | "safe" | "brand") =>
    d ? (
      <>
        <Check aria-hidden className={tone === "risk" ? "mx-auto size-4 text-risk-600" : tone === "safe" ? "mx-auto size-4 text-safe-600" : "mx-auto size-4 text-brand-600"} />
        <span className="sr-only">{tc("yes")}</span>
      </>
    ) : (
      <>
        <Minus aria-hidden className="mx-auto size-4 text-ink-disabled" />
        <span className="sr-only">{tc("no")}</span>
      </>
    );

  return (
    <div className="grid gap-5">
      <PageHeader
        title={c.name}
        back={{ href: "/admin/campaigns", label: tr("allCampaigns") }}
        actions={allowed(v, "campaigns.write") ? <CampaignActions id={c.id} status={c.status} audience={audience.length} channel={c.channel} /> : null}
      />
      {blocked && blockedReason ? (
        <Notice tone="warn" icon={<AlertTriangle />} title={tr("lastLaunchBlocked", { date: format.dateTime(blocked.at, { dateStyle: "medium", timeStyle: "short" }) })}>
          {tr("lastLaunchBlockedBody", { reason: tr(`blocked.${blockedReason}`) })}
        </Notice>
      ) : null}
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
                  {c.launchedAt ? format.dateTime(c.launchedAt, { dateStyle: "medium", timeStyle: "short" }) : c.status === "scheduled" && c.scheduledAt ? format.dateTime(c.scheduledAt, { dateStyle: "medium", timeStyle: "short" }) : tr("draftSaved")}
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
        <Card className="min-w-0">
          <CardHeader title={tr("recipients")} />
          <CardBody className="pt-3">
            <ScrollRegion label={tr("recipients")}>
              <table className="w-full min-w-[40rem] text-body-sm">
                <thead className="text-tab text-ink-subtle">
                  <tr className="border-b border-line">
                    <th className="py-2.5 pe-3 text-start font-semibold">{tr("col.person")}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">{tr("col.department")}</th>
                    <th className="px-3 py-2.5 font-semibold">{tr("col.opened")}</th>
                    <th className="px-3 py-2.5 font-semibold">{tr("col.clicked")}</th>
                    <th className="px-3 py-2.5 font-semibold">{tr("col.reported")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map(({ r, name, avatar, department }) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pe-3">
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
            </ScrollRegion>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
