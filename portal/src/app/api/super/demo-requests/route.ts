import { desc } from "drizzle-orm";
import { apiViewer } from "@/server/auth/api";
import { db, t } from "@/server/db";
import { audit } from "@/server/services/audit";
import { toCsv } from "@/lib/csv";
import { todayInBaku } from "@/lib/time";

/** Demo requests from the public site, as CSV (platform operators only). */
export async function GET(request: Request) {
  const v = await apiViewer("platform.manage", request);
  if (v instanceof Response) return v;
  const rows = await db().select().from(t.demoRequests).orderBy(desc(t.demoRequests.createdAt));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "demo.exported", meta: { count: rows.length } });
  const csv = toCsv(
    ["received", "status", "name", "email", "organisation", "country", "employees", "locale", "consent_version", "message"],
    rows.map((r) => [r.createdAt.toISOString(), r.status, r.name, r.email, r.organisation, r.country, r.employees, r.locale, r.consentVersion, r.message ?? ""]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="demo-requests-${todayInBaku()}.csv"`,
      "cache-control": "no-store",
    },
  });
}
