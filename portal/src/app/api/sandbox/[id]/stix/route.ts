import { isUuid } from "@/lib/ids";
import { and, eq } from "drizzle-orm";
import { allowed, getViewer, twoFactorGap } from "@/server/auth/viewer";
import { deniedResponse, rscProbe } from "@/server/auth/api";
import { db, t } from "@/server/db";
import { toStix } from "@/server/sandbox/analyze";

/** STIX 2.1 bundle of one sandbox analysis. Analysts get any; employees only their own. */
export async function GET(request: Request, { params }: RouteContext<"/api/sandbox/[id]/stix">) {
  const probe = rscProbe(request);
  if (probe) return probe;
  const v = await getViewer();
  if (!v) return deniedResponse(request, 401);
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [a] = await db().select().from(t.sandboxAnalyses).where(and(eq(t.sandboxAnalyses.id, id), eq(t.sandboxAnalyses.tenantId, v.tenant.id)));
  if (!a || (a.submittedBy !== v.user.id && (!allowed(v, "secops.read") || twoFactorGap(v)))) return new Response("Not found", { status: 404 });
  const bundle = toStix(a, a.createdAt, `SB-${a.number}`);
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/stix+json; charset=utf-8",
      "content-disposition": `attachment; filename="SB-${a.number}.stix.json"`,
      "cache-control": "no-store",
    },
  });
}
