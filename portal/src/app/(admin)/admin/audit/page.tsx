import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { AUDIT_ACTIONS } from "@/server/services/audit";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/field";
import { AutoSubmit } from "@/components/admin/auto-submit";

const PAGE = 50;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("audit") };
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const v = await requirePermission("audit.read");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const action = (AUDIT_ACTIONS as readonly string[]).includes(str("action")) ? str("action") : "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(str("from")) ? str("from") : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(str("to")) ? str("to") : "";
  const page = Math.max(1, Number(str("page")) || 1);
  const [tr, ta, tc, format] = await Promise.all([getTranslations("admin.audit"), getTranslations("admin.auditActions"), getTranslations("common"), getFormatter()]);
  const rows = await db()
    .select({ a: t.auditLog, name: t.users.name, avatar: t.users.avatarUrl })
    .from(t.auditLog)
    .leftJoin(t.users, eq(t.users.id, t.auditLog.actorId))
    .where(
      and(
        eq(t.auditLog.tenantId, v.tenant.id),
        action ? eq(t.auditLog.action, action) : undefined,
        from ? gte(t.auditLog.at, new Date(`${from}T00:00:00`)) : undefined,
        to ? lte(t.auditLog.at, new Date(`${to}T23:59:59`)) : undefined,
      ),
    )
    .orderBy(desc(t.auditLog.at))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE);
  const hasNext = rows.length > PAGE;
  const qs = (p: number) => `?${new URLSearchParams({ ...(action ? { action } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page: String(p) }).toString()}`;
  const label = (a: string) => ta(a.replace(".", "_") as "auth_sign_in");

  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={tr("subtitle")} />
      <form>
        <AutoSubmit className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-caption font-semibold">
            {tr("action")}
            <Select name="action" defaultValue={action} className="w-72">
              <option value="">{tr("anyAction")}</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {label(a)}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-caption font-semibold">
            {tc("from")}
            <Input type="date" name="from" defaultValue={from} className="w-44" />
          </label>
          <label className="grid gap-1 text-caption font-semibold">
            {tc("to")}
            <Input type="date" name="to" defaultValue={to} className="w-44" />
          </label>
        </AutoSubmit>
        {/* Keeps Enter working without JavaScript; the filters otherwise apply on change. */}
        <button type="submit" className="sr-only" tabIndex={-1}>
          {tc("apply")}
        </button>
      </form>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          <table className="w-full min-w-[52rem] text-left text-body-sm">
            <thead className="text-tab text-ink-subtle">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{tr("col.time")}</th>
                <th className="px-4 py-3 font-semibold">{tr("col.who")}</th>
                <th className="px-4 py-3 font-semibold">{tr("col.action")}</th>
                <th className="px-4 py-3 font-semibold">{tr("col.change")}</th>
                <th className="px-4 py-3 font-semibold">{tr("col.ip")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE).map(({ a, name, avatar }) => (
                <tr key={a.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{format.dateTime(a.at, { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={name ?? tr("system")} src={avatar} size="xs" />
                      {name ?? tr("system")}
                    </span>
                  </td>
                  <td className="px-4 py-3">{label(a.action)}</td>
                  <td className="px-4 py-3 font-mono text-tab text-ink-muted">{a.action}</td>
                  <td className="px-4 py-3 font-mono text-tab text-ink-muted">{a.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ScrollText />} title={tr("empty")} />
        </Card>
      )}
      <nav className="flex justify-center gap-3 text-caption">
        {page > 1 ? (
          <Link href={qs(page - 1)} className="rounded-pill border border-line px-4 py-2 font-semibold hover:bg-sunken">
            {tc("previousPage")}
          </Link>
        ) : null}
        {hasNext ? (
          <Link href={qs(page + 1)} className="rounded-pill border border-line px-4 py-2 font-semibold hover:bg-sunken">
            {tc("nextPage")}
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
