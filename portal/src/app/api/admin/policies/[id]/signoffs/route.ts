import { and, desc, eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { allowed, getViewer } from "@/server/auth/viewer";
import { audit } from "@/server/services/audit";
import { toCsv } from "@/lib/csv";

/** Sign-off list of the current policy version, for auditors. */
export async function GET(_: Request, { params }: RouteContext<"/api/admin/policies/[id]/signoffs">) {
  const { id } = await params;
  const v = await getViewer();
  if (!v || !allowed(v, "policies.read")) return new Response("Forbidden", { status: 403 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [policy] = await db().select().from(t.policies).where(and(eq(t.policies.id, id), eq(t.policies.tenantId, v.tenant.id)));
  if (!policy) return new Response("Not found", { status: 404 });
  const [version] = await db().select().from(t.policyVersions).where(eq(t.policyVersions.policyId, id)).orderBy(desc(t.policyVersions.version)).limit(1);
  const people = await db()
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, department: t.departments.name })
    .from(t.users)
    .leftJoin(t.departments, eq(t.departments.id, t.users.departmentId))
    .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "active")));
  const signoffs = version ? await db().select().from(t.policySignoffs).where(eq(t.policySignoffs.versionId, version.id)) : [];
  const by = new Map(signoffs.map((s) => [s.userId, s]));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "policy.signoffs_downloaded", targetType: "policy", targetId: id, meta: { version: version?.version ?? null, people: people.length } });
  const csv = toCsv(
    ["name", "email", "department", "policy", "version", "signed", "signed_at", "ip"],
    people.map((p) => {
      const s = by.get(p.id);
      return [p.name, p.email, p.department ?? "", policy.title, version?.version ?? "", s ? "yes" : "no", s?.signedAt.toISOString() ?? "", s?.ip ?? ""];
    }),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="policy-signoffs-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
