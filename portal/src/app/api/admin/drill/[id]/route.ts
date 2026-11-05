import { getLocale } from "next-intl/server";
import { apiViewer } from "@/server/auth/api";
import { db } from "@/server/db";
import { sameOrigin } from "@/server/request";
import { isUuid } from "@/lib/ids";
import { advanceDrill, drillById, drillView } from "@/server/services/drill";

type Context = RouteContext<"/api/admin/drill/[id]">;

/**
 * The live drill dashboard polls this once a second: it applies the events that are due
 * (src/server/services/drill.ts) and answers with the state to draw. A POST, because it changes data.
 */
export async function POST(request: Request, ctx: Context) {
  return answer(request, ctx, true);
}

/** The same state without applying anything. */
export async function GET(request: Request, ctx: Context) {
  return answer(request, ctx, false);
}

async function answer(request: Request, { params }: Context, advance: boolean) {
  const v = await apiViewer("campaigns.write", request);
  if (v instanceof Response) return v;
  if (advance && !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  if (!v.tenant.features.has("live_drill") || !isUuid(id)) return new Response("Not found", { status: 404 });
  const run = advance ? await advanceDrill(db(), v.tenant.id, id) : await drillById(db(), v.tenant.id, id);
  const view = run ? await drillView(db(), run, await getLocale()) : null;
  if (!view) return new Response("Not found", { status: 404 });
  return Response.json(view, { headers: { "cache-control": "no-store" } });
}
