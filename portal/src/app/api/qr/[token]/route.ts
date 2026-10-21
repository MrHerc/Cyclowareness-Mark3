import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { appUrl } from "@/server/env";

/** QR image for "scan this code" simulation emails; it points at the QR trap /q/{token}. */
export async function GET(_: Request, { params }: RouteContext<"/api/qr/[token]">) {
  const { token } = await params;
  if (!/^[a-z2-7]{10,40}$/.test(token)) return new Response("Not found", { status: 404 });
  const [row] = await db().select({ id: t.campaignRecipients.id }).from(t.campaignRecipients).where(eq(t.campaignRecipients.token, token));
  if (!row) return new Response("Not found", { status: 404 });
  const png = await QRCode.toBuffer(`${appUrl()}/q/${token}`, { type: "png", width: 360, margin: 1 });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
}
