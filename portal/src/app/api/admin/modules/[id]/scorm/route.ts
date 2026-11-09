import { db } from "@/server/db";
import { hasFeature } from "@/server/auth/viewer";
import { apiViewer } from "@/server/auth/api";
import { audit } from "@/server/services/audit";
import { rateLimit } from "@/server/rate-limit";
import { scormData, scormFiles } from "@/server/scorm/package";
import { scormPlayer } from "@/server/scorm/player";
import { zip } from "@/server/zip";
import { isLocale } from "@/i18n/config";
import { isUuid } from "@/lib/ids";

/** SCORM 1.2 package of a library or own module: /api/admin/modules/{id}/scorm?locale=<one of the ten languages> */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/modules/[id]/scorm">) {
  const { id } = await params;
  const v = await apiViewer("studio.write", request);
  if (v instanceof Response) return v;
  if (!hasFeature(v, "studio") || !isUuid(id)) return new Response("Not found", { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale");
  if (!isLocale(locale)) return new Response("Bad request", { status: 400 });
  if (!(await rateLimit(`scorm-export:${v.user.id}`, 30, 60 * 60_000)).ok) return new Response("Too many requests", { status: 429 });
  const data = await scormData(db(), v.tenant.id, id, locale);
  if (!data?.lessons.length) return new Response("Not found", { status: 404 });
  const body = zip(scormFiles(data, await scormPlayer()));
  await audit(db(), { tenantId: v.tenant.id, actorId: v.user.id, action: "module.exported", targetType: "module", targetId: id, meta: { format: "scorm12", locale } });
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${data.module.slug.replace(/[^A-Za-z0-9_-]/g, "_")}-scorm12-${locale}.zip"`,
      "cache-control": "no-store",
    },
  });
}
