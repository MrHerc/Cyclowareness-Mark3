import "server-only";
import { env } from "./env";
import { db, dbHandle } from "./db";
import { runJobs } from "./jobs";
import { logFailure } from "./db/errors";

/**
 * Job runner, started once per Node.js server process from src/instrumentation.ts, or by the
 * separate worker (scripts/jobs.ts) when the servers run with JOBS_ENABLED=0.
 * With Postgres, a session-level advisory lock on one dedicated connection makes sure only one
 * of several replicas or workers runs a tick at a time; the tick itself uses the pool (which is
 * why DATABASE_POOL_MAX is at least 2).
 */
const LOCK_KEY = 7_281_939;
const INTERVAL_MS = 60_000;
const FIRST_DELAY_MS = 15_000;

declare global {
  var __jobsStarted: boolean | undefined;
}

/** One tick under the cross-process lock. Returns false when another process holds it. */
export async function runLockedTick(): Promise<boolean> {
  const handle = dbHandle();
  if (handle.driver !== "pg" || !handle.pool) {
    await runJobs(db());
    return true;
  }
  const client = await handle.pool.connect();
  let locked = false;
  try {
    const res = await client.query<{ locked: boolean }>("select pg_try_advisory_lock($1) as locked", [LOCK_KEY]);
    locked = !!res.rows[0]?.locked;
    if (!locked) return false;
    await runJobs(db());
    return true;
  } finally {
    let broken: Error | undefined;
    if (locked) {
      try {
        await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
      } catch (error) {
        // A connection that cannot unlock is discarded, which ends the session and with it the lock.
        broken = error as Error;
      }
    }
    client.release(broken);
  }
}

/**
 * Interval runner: errors of a tick are logged, and a tick never overlaps the previous one.
 * The returned function stops the timers and resolves once a tick in progress has finished, so a
 * worker can shut down without cutting a delivery off between sending and recording it.
 */
export function startJobLoop(): () => Promise<void> {
  let current: Promise<void> | null = null;
  let stopped = false;
  const tick = () => {
    if (current || stopped) return;
    current = (async () => {
      try {
        await runLockedTick();
      } catch (error) {
        logFailure("[jobs] tick failed", error);
      } finally {
        current = null;
      }
    })();
  };
  const first = setTimeout(tick, FIRST_DELAY_MS);
  const every = setInterval(tick, INTERVAL_MS);
  first.unref();
  every.unref();
  return async () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(every);
    await current;
  };
}

export function startJobs(): void {
  if (env.JOBS_ENABLED !== "1" || globalThis.__jobsStarted) return;
  globalThis.__jobsStarted = true;
  startJobLoop();
}
