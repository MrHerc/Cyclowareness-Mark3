import { getLocale } from "next-intl/server";
import { db } from "@/server/db";
import { allowed, getViewer } from "@/server/auth/viewer";
import { buildReport } from "@/server/reports/build";
import { toXlsx } from "@/server/reports/xlsx";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/rate-limit";
import { REPORT_KINDS, type ReportKind } from "@/server/db/schema";
import { toCsv } from "@/lib/csv";

/** Report download: /api/admin/reports/{kind}?format=csv|xlsx&from&to&d */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/reports/[kind]">) {
  const { kind } = await params;
  const v = await getViewer();
  if (!v || !allowed(v, "reports.read")) return new Response("Forbidden", { status: 403 });
  if (!(REPORT_KINDS as readonly string[]).includes(kind)) return new Response("Not found", { status: 404 });
  if (kind === "secops" && !allowed(v, "secops.read")) return new Response("Forbidden", { status: 403 });
  if (!rateLimit(`report:${v.user.id}`, 60, 60 * 60_000).ok) return new Response("Too many requests", { status: 429 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const filters = { from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined, departmentId: url.searchParams.get("d") ?? undefined };
  const report = await buildReport(v, kind as ReportKind, filters, await getLocale());
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "report.downloaded", meta: { kind, format, ...filters } });
  const stamp = new Date().toISOString().slice(0, 10);
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
