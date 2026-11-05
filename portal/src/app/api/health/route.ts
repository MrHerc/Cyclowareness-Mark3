import { count, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import * as t from "@/server/db/schema";
import { env } from "@/server/env";
import { allowed, getViewer, twoFactorGap } from "@/server/auth/viewer";
import { clientIpFrom } from "@/server/request";

/**
 * Liveness and readiness for the container healthcheck and load balancers: 200 when the server can
 * run a query, 503 otherwise. The JSON body adds what an uptime monitor alerts on: when the job runner
 * last finished a tick (stale after 5 minutes) and how much mail and webhook delivery is waiting. A
 * stopped job runner does not turn the answer into 503, so the healthcheck never restarts a server
 * for it. The signed-in platform operator also sees the client address the server derives, to check
 * TRUST_PROXY (docs/OPERATIONS.md).
 */
export const dynamic = "force-dynamic";

const HEADERS = { "cache-control": "no-store" };
const STALE_MS = 5 * 60_000;

async function status(request: Request) {
  await db().execute(sql`select 1`);
  const [tick] = await db().select({ ranAt: t.jobTicks.ranAt }).from(t.jobTicks).where(eq(t.jobTicks.job, "tick"));
  const [mail] = await db().select({ n: count() }).from(t.outbox).where(eq(t.outbox.status, "queued"));
  const [webhooks] = await db().select({ n: count() }).from(t.webhookDeliveries).where(eq(t.webhookDeliveries.status, "queued"));
  const body: Record<string, unknown> = {
    db: "ok",
    jobs: { lastTickAt: tick?.ranAt.toISOString() ?? null, stale: !tick || Date.now() - tick.ranAt.getTime() > STALE_MS },
    backlog: { mail: mail.n, webhooks: webhooks.n },
  };
  // A session lookup that fails must not fail the healthcheck.
  const v = await getViewer().catch(() => null);
  if (v && allowed(v, "platform.manage") && !twoFactorGap(v)) {
    body.client = { address: clientIpFrom(request.headers, env.TRUST_PROXY, env.CLIENT_IP_HEADER), forwardedFor: request.headers.get("x-forwarded-for"), realIp: request.headers.get("x-real-ip"), trustProxy: env.TRUST_PROXY };
  }
  return body;
}

export async function GET(request: Request) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const body = await Promise.race([
      status(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 3_000);
      }),
    ]);
    return Response.json(body, { status: 200, headers: HEADERS });
  } catch {
    return Response.json({ db: "unavailable" }, { status: 503, headers: HEADERS });
  } finally {
    clearTimeout(timer);
  }
}
