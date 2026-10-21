/**
 * Background worker for deployments where the web servers run with JOBS_ENABLED=0.
 * Runs the same advisory-locked tick as the in-process runner, so several workers (or a worker
 * next to servers that still run jobs) never overlap.
 *
 *   npm run jobs            every minute until SIGTERM / SIGINT
 *   npm run jobs -- --once  a single tick (for cron); exit code 1 when it failed
 *
 * The server modules are guarded by "server-only", hence the react-server condition in the
 * npm script. Needs the same environment as the server (DATABASE_URL, APP_SECRET, APP_URL, ...).
 * DATABASE_URL is required: the embedded development database can be open in one process only,
 * so next to `next dev` a worker would lose writes (keep JOBS_ENABLED=1 there instead).
 * On SIGTERM / SIGINT a tick in progress finishes before the pool is closed; give the process
 * time for that (compose `stop_grace_period`).
 */
import { runLockedTick, startJobLoop } from "../src/server/jobs-runner";
import { dbHandle } from "../src/server/db";

async function shutdown(code: number) {
  try {
    await dbHandle().close();
  } finally {
    process.exit(code);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[jobs] DATABASE_URL is not set: the worker needs the server's PostgreSQL. The embedded database is single-process; keep JOBS_ENABLED=1 with it.");
    process.exit(1);
  }
  if (process.argv.includes("--once")) {
    const ran = await runLockedTick();
    console.log(ran ? "[jobs] tick done" : "[jobs] another process holds the job lock; skipped");
    await shutdown(0);
    return;
  }
  const stop = startJobLoop();
  console.log("[jobs] worker started (first tick in 15 s, then every 60 s)");
  // The loop's timers are unref'd; this keeps the process alive until a signal arrives.
  const keepAlive = setInterval(() => {}, 1 << 30);
  const onSignal = async (signal: string) => {
    console.log(`[jobs] ${signal}: stopping after the tick in progress`);
    // The pool rejects every query once it is closed, so the running tick must finish first: a
    // message sent but not yet marked "sent" would otherwise go out again on the next tick.
    await stop();
    clearInterval(keepAlive);
    await shutdown(0);
  };
  process.once("SIGTERM", () => void onSignal("SIGTERM"));
  process.once("SIGINT", () => void onSignal("SIGINT"));
}

main().catch(async (error) => {
  console.error("[jobs] failed", error);
  await shutdown(1);
});
