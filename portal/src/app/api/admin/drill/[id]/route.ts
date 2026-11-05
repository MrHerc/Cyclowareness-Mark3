import { getLocale } from "next-intl/server";
import { apiViewer } from "@/server/auth/api";
import { db } from "@/server/db";
import { isUuid } from "@/lib/ids";
import { advanceDrill, drillView } from "@/server/services/drill";

/**
 * The live drill dashboard polls this once a second: it applies the events that are due
 * (src/server/services/drill.ts) and answers with the state to draw.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/drill/[id]">) {
  const v = await apiViewer("campaigns.write", request);
  if (v instanceof Response) return v;
  const { id } = await params;
  if (!v.tenant.features.has("live_drill") || !isUuid(id)) return new Response("Not found", { status: 404 });
  const run = await advanceDrill(db(), v.tenant.id, id);
  const view = run ? await drillView(db(), run, await getLocale()) : null;
  if (!view) return new Response("Not found", { status: 404 });
  return Response.json(view, { headers: { "cache-control": "no-store" } });
}
