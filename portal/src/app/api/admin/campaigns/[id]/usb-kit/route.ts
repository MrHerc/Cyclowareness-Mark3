import { isUuid } from "@/lib/ids";
import { and, asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db, t } from "@/server/db";
import { apiViewer } from "@/server/auth/api";
import { audit } from "@/server/services/audit";
import { appUrl } from "@/server/env";
import { toCsv } from "@/lib/csv";
import { TEMPLATE_BY_KEY, templateText } from "@/lib/campaigns/templates";

/**
 * USB drop kit: one row per drive with the beacon file to copy onto it. The file is a tiny
 * HTML page that opens the tracked link (and the lesson) when someone double-clicks it. Its name
 * is the template's bait in the organisation's language; the columns are in the admin's.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/campaigns/[id]/usb-kit">) {
  const { id } = await params;
  const v = await apiViewer("campaigns.write", request);
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
  const tr = await getTranslations("admin.campaigns.usbKitCols");
  const bait = TEMPLATE_BY_KEY.get(c.templateKey)?.attachment?.name;
  const fileName = bait ? templateText(bait, v.tenant.settings.defaultLocale) : "Iclas_teqdimati.html";
  const shown = fileName.replace(/\.html$/, "");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const base = appUrl();
  const beacon = (token: string) => `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${base}/t/${token}"><a href="${base}/t/${token}">${esc(shown)}</a>`;
  const csv = toCsv(
    [tr("drive"), tr("labelFor"), tr("fileName"), tr("fileContents")],
    rows.map((r, i) => [`USB-${String(i + 1).padStart(3, "0")}`, r.name, fileName, beacon(r.token)]),
  );
  // Each row carries a live tracking token against a named employee: recorded like every other export.
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "campaign.usb_kit_downloaded", targetType: "campaign", targetId: c.id, meta: { drives: rows.length } });
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="usb-kit-${c.id.slice(0, 8)}.csv"`, "cache-control": "no-store" } });
}
