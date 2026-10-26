import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { getDepartments, listPeople, scopeDepartmentIds } from "@/server/queries/admin";
import { departmentClosure } from "@/server/services/assignments";
import { ButtonAnchor } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { AddPerson, ImportPeople, PeopleFilters, PeopleTable } from "@/components/admin/people-client";
import { DeletionRequests } from "@/components/admin/deletion-requests";
import { InviteLinksButton } from "@/components/admin/invite-links-button";
import { searchFold } from "@/components/secops/search-fold";
import { riskBand } from "@/lib/domain/risk";
import { pageParam } from "@/lib/page-param";

const PAGE = 50;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("people") };
}

export default async function PeoplePage({ searchParams }: PageProps<"/admin/users">) {
  const v = await requirePermission("people.read");
  const sp = await searchParams;
  const [tr, tc, format] = await Promise.all([getTranslations("admin.people"), getTranslations("common"), getFormatter()]);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [all, departments, scope] = await Promise.all([listPeople(v, { includeDeleted: str("status") === "deleted" }), getDepartments(v.tenant.id), scopeDepartmentIds(v)]);
  const visibleDepartments = scope ? departments.filter((d) => scope.has(d.id)) : departments;
  const closure = departmentClosure(departments);
  const q = searchFold(str("q"));
  const filtered = all.filter(
    (p) =>
      (!q || searchFold(p.name).includes(q) || searchFold(p.email).includes(q)) &&
      (!str("dept") || (p.departmentId && closure.get(str("dept"))?.has(p.departmentId))) &&
      (!str("role") || p.role === str("role")) &&
      (!str("status") || p.status === str("status")) &&
      (!str("risk") || riskBand(p.riskScore) === str("risk")),
  );
  // listPeople already orders by name, ascending.
  const sortDir = str("dir") === "desc" ? "desc" : "asc";
  if (sortDir === "desc") filtered.reverse();
  const page = pageParam(str("page"));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const canWrite = allowed(v, "people.write");
  const pending = all.filter((p) => p.deletionRequestedAt && p.status !== "deleted");
  const pageHref = (n: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, val]) => typeof val === "string") as [string, string][]);
    next.set("page", String(n));
    return `?${next.toString()}`;
  };

  return (
    <div className="grid gap-5">
      <PageHeader
        title={tr("title")}
        subtitle={tr("count", { count: filtered.length })}
        actions={
          <>
            <ButtonAnchor href="/api/admin/people/export" variant="secondary" icon={<Download />}>
              {tr("export")}
            </ButtonAnchor>
            {canWrite ? (
              <>
                <InviteLinksButton label={tr("inviteLinks")} />
                <ImportPeople />
                <AddPerson departments={visibleDepartments.map((d) => ({ id: d.id, name: d.name }))} defaultLocale={v.tenant.settings.defaultLocale} locales={v.tenant.settings.locales} />
              </>
            ) : null}
          </>
        }
      />
      {canWrite && pending.length ? <DeletionRequests people={pending.map((p) => ({ id: p.id, name: p.name, email: p.email, at: p.deletionRequestedAt!.toISOString() }))} /> : null}
      <PeopleFilters departments={visibleDepartments.map((d) => ({ id: d.id, name: d.name }))} />
      <PeopleTable
        canWrite={canWrite}
        canRemind={allowed(v, "assignments.read")}
        emailReady={v.tenant.settings.email.enabled}
        sortDir={sortDir}
        departments={visibleDepartments.map((d) => ({ id: d.id, name: d.name }))}
        rows={rows.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          status: p.status,
          departmentName: p.departmentName,
          riskScore: p.riskScore,
          xp: format.number(p.xp),
          lastActiveAt: p.lastActiveAt?.toISOString() ?? null,
          awaiting: p.awaiting,
          avatarUrl: p.avatarUrl,
        }))}
      />
      {filtered.length > PAGE ? (
        <nav className="flex items-center justify-center gap-3 text-caption">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} aria-label={tc("previousPage")} className="rounded-pill border border-line px-4 py-2 font-semibold hover:bg-sunken">
              ‹
            </Link>
          ) : null}
          <span className="text-ink-muted">
            {page} / {Math.ceil(filtered.length / PAGE)}
          </span>
          {page * PAGE < filtered.length ? (
            <Link href={pageHref(page + 1)} aria-label={tc("nextPage")} className="rounded-pill border border-line px-4 py-2 font-semibold hover:bg-sunken">
              ›
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
