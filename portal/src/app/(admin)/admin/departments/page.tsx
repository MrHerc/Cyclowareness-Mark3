import { getLocale, getTranslations } from "next-intl/server";
import { and, count, eq, ne } from "drizzle-orm";
import { db, t } from "@/server/db";
import { requirePermission } from "@/server/auth/viewer";
import { getDepartments } from "@/server/queries/admin";
import { PageHeader } from "@/components/ui/layout";
import { DepartmentsTree } from "@/components/admin/departments-client";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("departments") };
}

export default async function DepartmentsPage() {
  const v = await requirePermission("departments.write");
  const [tr, locale] = await Promise.all([getTranslations("admin.departments"), getLocale()]);
  const [departments, counts, people] = await Promise.all([
    getDepartments(v.tenant.id),
    db()
      .select({ departmentId: t.users.departmentId, n: count() })
      .from(t.users)
      .where(and(eq(t.users.tenantId, v.tenant.id), ne(t.users.status, "deleted")))
      .groupBy(t.users.departmentId),
    db()
      .select({ id: t.users.id, name: t.users.name })
      .from(t.users)
      .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active"))),
  ]);
  const countMap = new Map(counts.map((c) => [c.departmentId, Number(c.n)]));
  const nameMap = new Map(people.map((p) => [p.id, p.name]));
  return (
    <div className="grid gap-5">
      <PageHeader title={tr("title")} subtitle={tr("count", { count: departments.length })} />
      <DepartmentsTree
        people={people.sort((a, b) => a.name.localeCompare(b.name, locale))}
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          parentId: d.parentId,
          headUserId: d.headUserId,
          headName: d.headUserId ? (nameMap.get(d.headUserId) ?? null) : null,
          people: countMap.get(d.id) ?? 0,
        }))}
      />
    </div>
  );
}
