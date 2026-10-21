import { isUuid } from "@/lib/ids";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { apiViewer } from "@/server/auth/viewer";
import { appUrl } from "@/server/env";
import { toCsv } from "@/lib/csv";

/**
 * USB drop kit: one row per drive with the beacon file to copy onto it. The file is a tiny
 * HTML page that opens the tracked link (and the lesson) when someone double-clicks it.
 */
export async function GET(_: Request, { params }: RouteContext<"/api/admin/campaigns/[id]/usb-kit">) {
  const { id } = await params;
  const v = await apiViewer("campaigns.write");
  if (v instanceof Response) return v;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [c] = await db().select().from(t.campaigns).where(and(eq(t.campaigns.id, id), eq(t.campaigns.tenantId, v.tenant.id)));
  if (!c || c.channel !== "usb") return new Response("Not found", { status: 404 });
  const rows = await db()
    .select({ token: t.campaignRecipients.token, name: t.users.name })
    .from(t.campaignRecipients)
    .innerJoin(t.users, eq(t.users.id, t.campaignRecipients.userId))
    .where(eq(t.campaignRecipients.campaignId, c.id))
    .orderBy(asc(t.users.name));
  const base = appUrl();
  const beacon = (token: string) => `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${base}/t/${token}"><a href="${base}/t/${token}">Iclas_teqdimati</a>`;
  const csv = toCsv(
    ["drive", "label_for", "file_name", "file_contents"],
    rows.map((r, i) => [`USB-${String(i + 1).padStart(3, "0")}`, r.name, "Iclas_teqdimati.html", beacon(r.token)]),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="usb-kit-${c.id.slice(0, 8)}.csv"`, "cache-control": "no-store" } });
}
