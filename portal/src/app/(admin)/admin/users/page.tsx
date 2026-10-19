import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Download, Link2 } from "lucide-react";
import { allowed, requirePermission } from "@/server/auth/viewer";
import { getDepartments, listPeople, scopeDepartmentIds } from "@/server/queries/admin";
import { departmentClosure } from "@/server/services/assignments";
import { ButtonAnchor } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { AddPerson, ImportPeople, PeopleFilters, PeopleTable } from "@/components/admin/people-client";
import { DeletionRequests } from "@/components/admin/deletion-requests";
import { riskBand } from "@/lib/domain/risk";

const PAGE = 50;

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("people") };
}

export default async function PeoplePage({ searchParams }: PageProps<"/admin/users">) {
  const v = await requirePermission("people.read");
  const sp = await searchParams;
  const tr = await getTranslations("admin.people");
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [all, departments, scope] = await Promise.all([listPeople(v, { includeDeleted: str("status") === "deleted" }), getDepartments(v.tenant.id), scopeDepartmentIds(v)]);
  const visibleDepartments = scope ? departments.filter((d) => scope.has(d.id)) : departments;
  const closure = departmentClosure(departments);
  const q = str("q").toLocaleLowerCase();
  const filtered = all.filter(
    (p) =>
      (!q || p.name.toLocaleLowerCase().includes(q) || p.email.includes(q)) &&
      (!str("dept") || (p.departmentId && closure.get(str("dept"))?.has(p.departmentId))) &&
      (!str("role") || p.role === str("role")) &&
      (!str("status") || p.status === str("status")) &&
      (!str("risk") || riskBand(p.riskScore) === str("risk")),
  );
  // listPeople already orders by name, ascending.
  const sortDir = str("dir") === "desc" ? "desc" : "asc";
  if (sortDir === "desc") filtered.reverse();
  const page = Math.max(1, Number(str("page")) || 1);
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
                <ButtonAnchor href="/api/admin/people/invite-links" variant="secondary" icon={<Link2 />}>
                  {tr("inviteLinks")}
                </ButtonAnchor>
                <ImportPeople />
                <AddPerson departments={visibleDepartments.map((d) => ({ id: d.id, name: d.name }))} />
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
          xp: p.xp,
          lastActiveAt: p.lastActiveAt?.toISOString() ?? null,
          awaiting: p.awaiting,
          avatarUrl: p.avatarUrl,
        }))}
      />
      {filtered.length > PAGE ? (
        <nav className="flex items-center justify-center gap-3 text-caption">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-pill border border-line px-4 py-2 font-semibold hover:bg-sunken">
              ‹
            </Link>
          ) : null}
          <span className="text-ink-muted">
            {page} / {Math.ceil(filtered.length / PAGE)}
          </span>
          {page * PAGE < filtered.length ? (
            <Link href={pageHref(page + 1)} className="rounded-pill border border-line px-4 py-2 font-semibold hover:bg-sunken">
              ›
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
