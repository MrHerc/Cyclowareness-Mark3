import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, t } from "../db";
import { getDepartments } from "./admin";
import { trainingModules } from "./secops";

/** Pickers for the incident and material forms: lessons, departments and active people. */
export async function formOptions(tenantId: string, locale: string) {
  const [modules, departments, people] = await Promise.all([
    trainingModules(tenantId, locale),
    getDepartments(tenantId),
    db()
      .select({ id: t.users.id, name: t.users.name, email: t.users.email, department: t.departments.name })
      .from(t.users)
      .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
      .where(and(eq(t.users.tenantId, tenantId), eq(t.users.status, "active"), ne(t.users.role, "super_admin")))
      .orderBy(asc(t.users.name)),
  ]);
  return {
    modules: modules.map((m) => ({ id: m.id, label: m.title })),
    departments: departments.map((d) => ({ id: d.id, label: d.name })),
    people,
  };
}
