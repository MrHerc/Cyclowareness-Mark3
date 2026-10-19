import "server-only";
import { sql } from "drizzle-orm";
import { env } from "./env";
import { db, dbDriver } from "./db";
import { runJobs } from "./jobs";

/**
 * Job runner, started once per Node.js server process from src/instrumentation.ts.
 * Runs the background work every minute. With Postgres, a transaction-level advisory lock
 * makes sure only one of several replicas runs a tick at a time. JOBS_ENABLED=0 turns it off
 * (for example when a separate worker container runs the jobs).
 */
const LOCK_KEY = 7_281_939;
const INTERVAL_MS = 60_000;
const FIRST_DELAY_MS = 15_000;

declare global {
  var __jobsStarted: boolean | undefined;
}

export function startJobs(): void {
  if (env.JOBS_ENABLED !== "1" || globalThis.__jobsStarted) return;
  globalThis.__jobsStarted = true;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (dbDriver() === "pg") {
        await db().transaction(async (tx) => {
          const res = await tx.execute(sql`select pg_try_advisory_xact_lock(${LOCK_KEY}) as locked`);
          const row = (Array.isArray(res) ? res[0] : (res as { rows?: { locked?: boolean }[] }).rows?.[0]) as { locked?: boolean } | undefined;
          if (!row?.locked) return;
          await runJobs(db());
        });
      } else {
        await runJobs(db());
      }
    } catch (error) {
      console.error("[jobs] tick failed", error);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, FIRST_DELAY_MS).unref();
  setInterval(tick, INTERVAL_MS).unref();
}
