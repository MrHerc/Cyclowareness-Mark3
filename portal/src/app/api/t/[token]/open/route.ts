import { db } from "@/server/db";
import { recordOpen } from "@/server/services/campaigns";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Open-tracking pixel for simulation emails. */
export async function GET(_: Request, { params }: RouteContext<"/api/t/[token]/open">) {
  const { token } = await params;
  if (/^[a-z2-7]{10,40}$/.test(token)) await recordOpen(db(), token);
  return new Response(new Uint8Array(GIF), { headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" } });
}
