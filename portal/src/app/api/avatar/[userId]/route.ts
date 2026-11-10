import { and, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { db, t } from "@/server/db";
import { getViewer } from "@/server/auth/viewer";

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const notFound = () => new Response("Not found", { status: 404 });

/**
 * A profile photo (stored as a data URL by setAvatarAction), for people of the viewer's own organisation only.
 * Pages link here through avatarSrc (server/avatar.ts), whose `?v=` changes with the photo.
 */
export async function GET(_: Request, { params }: RouteContext<"/api/avatar/[userId]">) {
  const { userId } = await params;
  const v = await getViewer();
  if (!v || !isUuid(userId)) return notFound();
  const [u] = await db()
    .select({ avatar: t.users.avatarUrl })
    .from(t.users)
    .where(and(eq(t.users.id, userId), eq(t.users.tenantId, v.tenant.id)));
  const m = u?.avatar ? DATA_URL.exec(u.avatar) : null;
  if (!m) return notFound();
  return new Response(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: { "content-type": m[1], "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
}
