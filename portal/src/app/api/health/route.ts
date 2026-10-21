import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/**
 * Liveness and readiness for the container healthcheck and load balancers: 200 when the server can
 * run a query, 503 otherwise. No details in the answer (it is public, outside the sign-in check).
 */
export const dynamic = "force-dynamic";

const HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db().execute(sql`select 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 3_000);
      }),
    ]);
    return new Response("ok", { status: 200, headers: HEADERS });
  } catch {
    return new Response("unavailable", { status: 503, headers: HEADERS });
  } finally {
    clearTimeout(timer);
  }
}
