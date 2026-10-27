import { desc } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Download, Globe2, Inbox } from "lucide-react";
import { requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { Card, CardBody } from "@/components/ui/card";
import { ButtonAnchor } from "@/components/ui/button";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { DemoRowActions } from "@/components/admin/platform-client";

export async function generateMetadata() {
  const tr = await getTranslations("admin.platform.tabs");
  return { title: tr("demo") };
}

const STATUSES = ["all", "new", "contacted", "won", "lost"] as const;

export default async function DemoRequestsPage({ searchParams }: PageProps<"/super/demo">) {
  await requirePermission("platform.manage");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as "all") ? (sp.status as (typeof STATUSES)[number]) : "all";
  const locale = await getLocale();
  const [tr, td, format] = await Promise.all([getTranslations("admin.platform"), getTranslations("admin.platform.demo"), getFormatter()]);
  const all = await db().select().from(t.demoRequests).orderBy(desc(t.demoRequests.createdAt));
  const list = all.filter((d) => status === "all" || d.status === status);
  const regions = new Intl.DisplayNames([locale, "en"], { type: "region" });
  const languages = new Intl.DisplayNames([locale, "en"], { type: "language" });
  const n = (x: number) => format.number(x);
  const ranges: Record<string, string> = { lt100: `< ${n(100)}`, "100to500": `${n(100)}–${n(500)}`, "500to2000": `${n(500)}–${n(2000)}`, gt2000: `> ${n(2000)}` };

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tr("title")}
        subtitle={tr("subtitle")}
        icon={<Globe2 />}
        actions={
          <ButtonAnchor href="/api/super/demo-requests" variant="secondary" icon={<Download />}>
            {td("export")}
          </ButtonAnchor>
        }
      />
      <TabsNav
        items={[
          { href: "/super", label: tr("tabs.tenants"), active: false },
          { href: "/super/demo", label: tr("tabs.demo"), active: true, count: all.length },
        ]}
      />
      <TabsNav items={STATUSES.map((s) => ({ href: `?status=${s}`, label: td(`status.${s}`), active: status === s, count: s === "all" ? all.length : all.filter((d) => d.status === s).length }))} />
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((d) => (
            <li key={d.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold">{d.organisation}</p>
                    <p className="mt-1 text-caption text-ink-muted">
                      {d.name} ·{" "}
                      <a href={`mailto:${d.email}`} className="text-brand-600 hover:underline">
                        <bdi>{d.email}</bdi>
                      </a>
                    </p>
                    <p className="mt-1 text-tab text-ink-subtle">
                      {td("country")}: {regions.of(d.country) ?? d.country} · {td("employees")}: {ranges[d.employees] ?? d.employees} · {td("language")}: {languages.of(d.locale) ?? d.locale} ·{td("received", { date: format.dateTime(d.createdAt, { dateStyle: "medium", timeStyle: "short" }) })} · {td("consent", { version: d.consentVersion })}
                    </p>
                    {d.message ? <p className="mt-2 rounded-md bg-sunken px-3 py-2 text-caption whitespace-pre-line">{d.message}</p> : null}
                  </div>
                  <DemoRowActions id={d.id} status={d.status} />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Inbox />} title={td("empty")} />
      )}
    </div>
  );
}
