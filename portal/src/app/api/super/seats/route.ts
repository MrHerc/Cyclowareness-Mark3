import { asc } from "drizzle-orm";
import { apiViewer } from "@/server/auth/api";
import { db, t } from "@/server/db";
import { peopleCounts } from "@/server/queries/platform-metrics";
import { audit } from "@/server/services/audit";
import { toCsv } from "@/lib/csv";
import { todayIn } from "@/lib/time";

/** Seats per organisation this month, as CSV, for invoicing pilots by hand (platform operators only). */
export async function GET(request: Request) {
  const v = await apiViewer("platform.manage", request);
  if (v instanceof Response) return v;
  const [tenants, counts] = await Promise.all([db().select({ id: t.tenants.id, slug: t.tenants.slug, plan: t.tenants.plan }).from(t.tenants).orderBy(asc(t.tenants.slug)), peopleCounts()]);
  const today = todayIn(v.tenant.settings.timeZone);
  const month = today.slice(0, 7);
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "seats.exported", meta: { count: tenants.length, month } });
  const csv = toCsv(
    ["organisation", "plan", "active_people", "invited_people", "month"],
    tenants.map((x) => [x.slug, x.plan, counts.get(x.id)?.active ?? 0, counts.get(x.id)?.invited ?? 0, month]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="seats-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
