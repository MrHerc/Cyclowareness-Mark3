import { and, eq, ne } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db, t } from "@/server/db";
import { allowed, getViewer } from "@/server/auth/viewer";
import { issueAccountLink } from "@/server/auth/links";
import { listPeople } from "@/server/queries/admin";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/rate-limit";
import { toCsv } from "@/lib/csv";

/** People list export and bulk invite links, as CSV. */
export async function GET(_: Request, { params }: RouteContext<"/api/admin/people/[kind]">) {
  const { kind } = await params;
  const v = await getViewer();
  if (!v) return new Response("Unauthorized", { status: 401 });
  if (!rateLimit(`people-export:${v.user.id}`, 20, 60 * 60_000).ok) return new Response("Too many requests", { status: 429 });
  const date = new Date().toISOString().slice(0, 10);

  if (kind === "export") {
    if (!allowed(v, "people.read")) return new Response("Forbidden", { status: 403 });
    const tc = await getTranslations("common");
    const people = await listPeople(v);
    const csv = toCsv(
      ["name", "email", "department", "job_title", "role", "status", "risk_score", "xp", "last_active", "joined"],
      people.map((p) => [p.name, p.email, p.departmentName ?? "", p.jobTitle ?? "", tc(`roles.${p.role}`), tc(`userStatus.${p.status}`), p.riskScore, p.xp, p.lastActiveAt?.toISOString() ?? "", p.createdAt.toISOString()]),
    );
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "people.exported", meta: { count: people.length } });
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="people-${date}.csv"`, "cache-control": "no-store" } });
  }

  if (kind === "invite-links") {
    if (!allowed(v, "people.write")) return new Response("Forbidden", { status: 403 });
    const invited = await db()
      .select({ id: t.users.id, name: t.users.name, email: t.users.email })
      .from(t.users)
      .where(and(eq(t.users.tenantId, v.tenant.id), eq(t.users.status, "invited"), ne(t.users.role, "super_admin")));
    const rows: string[][] = [];
    for (const u of invited) rows.push([u.name, u.email, await issueAccountLink(u.id, "invite")]);
    await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "person.invite_links_bulk", meta: { count: rows.length } });
    return new Response(toCsv(["name", "email", "invite_link"], rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="invite-links-${date}.csv"`, "cache-control": "no-store" },
    });
  }

  if (kind === "template") {
    return new Response(toCsv(["name", "email", "department", "job_title", "role", "manager_email", "phone"], [["Aysel Məmmədova", "aysel@example.az", "Maliyyə", "Mühasib", "learner", "", "+994501234567"]]), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="people-template.csv"` },
    });
  }
  return new Response("Not found", { status: 404 });
}
