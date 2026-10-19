import { eq } from "drizzle-orm";
import { db, t } from "@/server/db";

/** Uploaded tenant assets (logos). Public: logos appear on certificates and emails. */
export async function GET(_: Request, { params }: RouteContext<"/api/assets/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [a] = await db().select().from(t.assets).where(eq(t.assets.id, id));
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(a.dataBase64, "base64")), {
    headers: {
      "content-type": a.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      // SVGs are rendered as images only, never as documents with scripts.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
