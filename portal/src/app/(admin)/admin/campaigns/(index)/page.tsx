import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { Building2, CalendarDays, CheckCircle2, ChevronRight, Globe, Mail, Megaphone, MessageSquare, Pencil, Phone, Plus, Usb, Users } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { campaignStats } from "@/server/services/campaigns";
import { departmentClosure } from "@/server/services/assignments";
import { getDepartments } from "@/server/queries/admin";
import { Card, CardBody } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Funnel } from "@/components/ui/charts";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { TEMPLATE_BY_KEY, templateText } from "@/lib/campaigns/templates";

const CHANNEL_ICON = { email: Mail, sms: MessageSquare, voice: Phone, usb: Usb, qr: Mail } as const;
const STATUSES = ["all", "draft", "scheduled", "running", "completed", "cancelled"] as const;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("campaigns") };
}

export default async function CampaignsPage({ searchParams }: PageProps<"/admin/campaigns">) {
  const v = await requirePermission("campaigns.read");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : "all";
  const locale = await getLocale();
  const [tr, format] = await Promise.all([getTranslations("admin.campaigns"), getFormatter()]);
  const [campaigns, departments, users] = await Promise.all([
    db().select().from(t.campaigns).where(eq(t.campaigns.tenantId, v.tenant.id)).orderBy(desc(t.campaigns.createdAt)),
    getDepartments(v.tenant.id),
    db().select({ departmentId: t.users.departmentId }).from(t.users).where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"), ne(t.users.role, "super_admin"))),
  ]);
  const stats = await campaignStats(db(), campaigns.map((c) => c.id));
  const withResults = campaigns.filter((c) => (stats.get(c.id)?.sent ?? 0) > 0);
  const total = withResults.reduce((acc, c) => {
    const s = stats.get(c.id)!;
    return { sent: acc.sent + s.sent, opened: acc.opened + s.opened, clicked: acc.clicked + s.clicked, reported: acc.reported + s.reported };
  }, { sent: 0, opened: 0, clicked: 0, reported: 0 });
  const pct = (n: number) => (total.sent ? Math.round((n / total.sent) * 100) : 0);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const closure = departmentClosure(departments);
  const audienceSize = (c: (typeof campaigns)[number]) =>
    c.audience === "all" ? users.length : users.filter((u) => u.departmentId && c.departmentId && closure.get(c.departmentId)?.has(u.departmentId)).length;
  const list = campaigns.filter((c) => status === "all" || c.status === status);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tr("title")}
        subtitle={tr("count", { count: campaigns.length })}
        actions={
          allowed(v, "campaigns.write") ? (
            <ButtonLink href="/admin/campaigns/new" icon={<Plus />}>
              {tr("new")}
            </ButtonLink>
          ) : null
        }
      />
      {total.sent ? (
        <Card>
          <CardBody className="grid gap-6 md:grid-cols-[16rem_1fr]">
            <div>
              <p className="text-caption font-semibold text-ink-muted">{tr("reportRate")}</p>
              <p className="mt-1 text-display font-bold text-safe-700 tabular-nums">{pct(total.reported)}%</p>
              <p className="mt-2 text-caption text-ink-muted">{tr("reportedOf", { reported: total.reported, sent: total.sent })}</p>
              <p className="text-tab text-ink-subtle">{tr("acrossCampaigns", { count: withResults.length })}</p>
            </div>
            <Funnel
              steps={[
                { label: tr("sent"), value: total.sent, tone: "neutral" },
                { label: tr("opened"), value: total.opened, share: pct(total.opened), tone: "brand" },
                { label: tr("clicked"), value: total.clicked, share: pct(total.clicked), tone: "risk" },
                { label: tr("reported"), value: total.reported, share: pct(total.reported), tone: "safe" },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}
      <TabsNav items={STATUSES.map((s) => ({ href: `?status=${s}`, label: tr(`status.${s}`), active: status === s, count: s === "all" ? campaigns.length : campaigns.filter((c) => c.status === s).length }))} />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((c) => {
            const tpl = TEMPLATE_BY_KEY.get(c.templateKey);
            const s = stats.get(c.id);
            const Icon = CHANNEL_ICON[c.channel];
            return (
              <li key={c.id}>
                <Link href={`/admin/campaigns/${c.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-raised">
                  <span className="grid size-11 place-items-center rounded-md bg-brand-50 text-brand-600">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-[1_1_12rem]">
                    <p className="text-body-sm font-semibold break-words">{c.name}</p>
                    <Pill className="mt-1" tone={c.status === "completed" ? "safe" : c.status === "running" ? "brand" : c.status === "scheduled" ? "violet" : c.status === "cancelled" ? "risk" : "neutral"}>
                      {c.status === "completed" ? <CheckCircle2 /> : c.status === "draft" ? <Pencil /> : null}
                      {tr(`status.${c.status}`)}
                    </Pill>
                    <p className="mt-1.5 grid gap-0.5 text-tab text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        {c.audience === "all" ? <Globe className="size-3.5" /> : <Building2 className="size-3.5" />}
                        {c.audience === "all" ? tr("wholeOrg") : (deptName.get(c.departmentId ?? "") ?? "—")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {c.launchedAt
                          ? tr("sentOn", { date: format.dateTime(c.launchedAt, { dateStyle: "medium" }) })
                          : c.status === "scheduled" && c.scheduledAt
                            ? tr("plannedFor", { date: format.dateTime(c.scheduledAt, { dateStyle: "medium", timeStyle: "short" }) })
                            : tr("draftSaved")}
                      </span>
                    </p>
                  </div>
                  {s && s.sent ? (
                    <dl className="grid grid-cols-2 gap-3 min-[22rem]:grid-cols-4">
                      {(["sent", "opened", "clicked", "reported"] as const).map((k) => {
                        const share = Math.round((s[k] / s.sent) * 100);
                        return (
                          <div key={k} className={cn("min-w-16 rounded-md px-2 py-1", k === "reported" && "bg-safe-50")}>
                            <dt className="text-tab text-ink-subtle">{tr(k === "clicked" ? "col.clicked" : `col.${k}`)}</dt>
                            <dd>
                              <span className={k === "clicked" ? "text-body-sm font-bold text-risk-600" : k === "reported" ? "text-body-sm font-bold text-safe-700" : "text-body-sm font-bold"}>{s[k]}</span>
                              {k !== "sent" ? <span className="ml-1 text-tab text-ink-muted">{share}%</span> : null}
                              <ProgressBar decorative size="sm" value={k === "sent" ? 100 : share} tone={k === "clicked" ? "risk" : k === "reported" ? "safe" : "brand"} className="mt-1.5" />
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg bg-sunken px-4 py-2.5">
                      <Users className="size-4 text-ink-subtle" />
                      <span>
                        <span className="block text-body-sm font-bold">{tr("audienceCount", { count: audienceSize(c) })}</span>
                        {tpl ? <span className="block text-tab text-ink-muted">{templateText(tpl.name, locale)}</span> : null}
                      </span>
                    </div>
                  )}
                  <ChevronRight className="ml-auto hidden size-5 text-ink-subtle sm:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<Megaphone />} title={tr("count", { count: 0 })} />
        </Card>
      )}
    </div>
  );
}
