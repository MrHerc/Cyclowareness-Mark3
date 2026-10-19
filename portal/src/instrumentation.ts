/**
 * Next.js instrumentation hook. The runtime check is a build-time constant, so the edge
 * compilation never bundles the Node-only job runner (pg, net, tls, dgram).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const { startJobs } = await import("./server/jobs-runner");
    startJobs();
  }
}
