/**
 * Next.js instrumentation hook, run once when a server process starts and before it takes
 * requests. The runtime check is a build-time constant, so the edge compilation never bundles the
 * Node-only modules (pg, net, tls, dgram).
 *
 * Production: an invalid environment (missing APP_SECRET, malformed APP_URL, ...) or a failed
 * start-up import ends the process with exit code 1, so the container restarts or the deployment
 * fails visibly, instead of a server that stays up and answers every request with 500.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const production = process.env.NODE_ENV === "production";
    try {
      await import("./server/env");
    } catch (error) {
      console.error(`[startup] ${error instanceof Error ? error.message : String(error)}`);
      if (production) process.exit(1);
      throw error;
    }
    if (production) {
      try {
        const { bootstrap } = await import("./server/bootstrap");
        await bootstrap();
      } catch (error) {
        console.error("[startup] start-up import failed", error);
        process.exit(1);
      }
    }
    const { startJobs } = await import("./server/jobs-runner");
    startJobs();
  }
}
