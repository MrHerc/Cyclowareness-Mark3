import { getLocale } from "next-intl/server";
import { db } from "@/server/db";
import { allowed } from "@/server/auth/viewer";
import { apiViewer, deniedResponse } from "@/server/auth/api";
import { buildReport } from "@/server/reports/build";
import { toXlsx } from "@/server/reports/xlsx";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/rate-limit";
import { REPORT_KINDS, type ReportKind } from "@/server/db/schema";
import { toCsv } from "@/lib/csv";
import { parseDay } from "@/lib/day";
import { isUuid } from "@/lib/ids";
import { todayInBaku } from "@/lib/time";

/** Report download: /api/admin/reports/{kind}?format=csv|xlsx&from&to&d */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/reports/[kind]">) {
  const { kind } = await params;
  const v = await apiViewer("reports.read", request);
  if (v instanceof Response) return v;
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) return new Response("Not found", { status: 404 });
  if (kind === "secops" && !allowed(v, "secops.read")) return deniedResponse(request, 403);
  const url = new URL(request.url);
  // Filters reach the report queries and the audit entry, so only well-formed values pass; an empty
  // parameter means "no filter", anything else malformed is refused rather than silently widened.
  const param = (key: string) => url.searchParams.get(key) || undefined;
  const fromRaw = param("from");
  const toRaw = param("to");
  const departmentId = param("d");
  const from = fromRaw && parseDay(fromRaw);
  const to = toRaw && parseDay(toRaw);
  if (from === null || to === null || (from && to && from > to) || (departmentId && !isUuid(departmentId))) {
    return new Response("Bad request", { status: 400 });
  }
  if (!(await rateLimit(`report-download:${v.user.id}`, 60, 60 * 60_000)).ok) return new Response("Too many requests", { status: 429 });
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters = { from, to, departmentId };
  const report = await buildReport(v, kind as ReportKind, filters, await getLocale());
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "report.downloaded", meta: { kind, format, ...filters } });
  const stamp = todayInBaku();
  if (format === "xlsx") {
    return new Response(new Uint8Array(toXlsx(report.title, report.headers, report.rows)), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${kind}-${stamp}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }
  return new Response(toCsv(report.headers, report.rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${kind}-${stamp}.csv"`, "cache-control": "no-store" },
  });
}
