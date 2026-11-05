import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handle = { db: unknown; driver: "pg" | "pglite"; pool?: unknown };
let handle: Handle = { db: {}, driver: "pglite" };
vi.mock("../src/server/db", () => ({ dbHandle: () => handle, db: () => handle.db }));
const env = { JOBS_ENABLED: "1" };
vi.mock("../src/server/env", () => ({ env }));
const runJobs = vi.fn(async (): Promise<Record<string, number>> => ({}));
vi.mock("../src/server/jobs", () => ({ runJobs: (...args: unknown[]) => runJobs(...(args as [])) }));
const logFailure = vi.fn();
vi.mock("../src/server/db/errors", () => ({ logFailure: (...args: unknown[]) => logFailure(...args) }));

const { runLockedTick, startJobLoop, startJobs } = await import("../src/server/jobs-runner");

function fakePool(o: { locked: boolean; unlockFails?: boolean }) {
  const queries: string[] = [];
  const release = vi.fn();
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: o.locked }] };
      if (sql.includes("pg_advisory_unlock") && o.unlockFails) throw new Error("connection lost");
      return { rows: [] };
    }),
    release,
  };
  return { pool: { connect: vi.fn(async () => client) }, queries, release };
}

beforeEach(() => {
  runJobs.mockReset().mockResolvedValue({});
  logFailure.mockReset();
  handle = { db: { name: "db" }, driver: "pglite" };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runLockedTick", () => {
  it("runs the jobs directly on the embedded database (one process)", async () => {
    expect(await runLockedTick()).toBe(true);
    expect(runJobs).toHaveBeenCalledWith(handle.db);
  });

  it("runs under the advisory lock with PostgreSQL and unlocks on the same connection", async () => {
    const { pool, queries, release } = fakePool({ locked: true });
    handle = { db: { name: "pg" }, driver: "pg", pool };
    expect(await runLockedTick()).toBe(true);
    expect(runJobs).toHaveBeenCalledTimes(1);
    expect(queries).toEqual(["select pg_try_advisory_lock($1) as locked", "select pg_advisory_unlock($1)"]);
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("skips the tick when another process holds the lock", async () => {
    const { pool, queries, release } = fakePool({ locked: false });
    handle = { db: {}, driver: "pg", pool };
    expect(await runLockedTick()).toBe(false);
    expect(runJobs).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("unlocks and releases the connection even when the jobs throw", async () => {
    const { pool, queries, release } = fakePool({ locked: true });
    handle = { db: {}, driver: "pg", pool };
    runJobs.mockRejectedValueOnce(new Error("boom"));
    await expect(runLockedTick()).rejects.toThrow("boom");
    expect(queries.at(-1)).toBe("select pg_advisory_unlock($1)");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("discards a connection that cannot unlock, which ends the lock with its session", async () => {
    const { pool, release } = fakePool({ locked: true, unlockFails: true });
    handle = { db: {}, driver: "pg", pool };
    expect(await runLockedTick()).toBe(true);
    expect(release.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe("startJobLoop", () => {
  it("waits 15 s for the first tick, then ticks every minute", async () => {
    vi.useFakeTimers();
    const stop = startJobLoop();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(runJobs).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(runJobs).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runJobs).toHaveBeenCalledTimes(2);
    await stop();
  });

  it("never starts a tick while the previous one is still running", async () => {
    vi.useFakeTimers();
    let finish = () => {};
    runJobs.mockImplementation(() => new Promise((resolve) => (finish = () => resolve({}))));
    const stop = startJobLoop();
    await vi.advanceTimersByTimeAsync(15_000 + 3 * 60_000);
    expect(runJobs).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runJobs).toHaveBeenCalledTimes(2);
    finish();
    await stop();
  });

  it("logs a failed tick and keeps going", async () => {
    vi.useFakeTimers();
    runJobs.mockRejectedValueOnce(new Error("database down"));
    const stop = startJobLoop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(logFailure).toHaveBeenCalledWith("[jobs] tick failed", expect.any(Error));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runJobs).toHaveBeenCalledTimes(2);
    await stop();
  });

  it("stops scheduling at once and resolves only after the tick in progress", async () => {
    vi.useFakeTimers();
    let finish = () => {};
    runJobs.mockImplementation(() => new Promise((resolve) => (finish = () => resolve({}))));
    const stop = startJobLoop();
    await vi.advanceTimersByTimeAsync(15_000);
    let stopped = false;
    const stopping = stop().then(() => (stopped = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    finish();
    await stopping;
    expect(stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(runJobs).toHaveBeenCalledTimes(1);
  });
});

describe("startJobs", () => {
  afterEach(() => {
    globalThis.__jobsStarted = undefined;
    env.JOBS_ENABLED = "1";
  });

  it("starts one loop per process, and none with JOBS_ENABLED=0", async () => {
    vi.useFakeTimers();
    env.JOBS_ENABLED = "0";
    startJobs();
    expect(globalThis.__jobsStarted).toBeUndefined();
    env.JOBS_ENABLED = "1";
    startJobs();
    startJobs();
    expect(globalThis.__jobsStarted).toBe(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(runJobs).toHaveBeenCalledTimes(1);
  });
});
