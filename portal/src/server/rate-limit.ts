import "server-only";
import { sql } from "drizzle-orm";
import { db, type DB } from "./db";
import * as t from "./db/schema";

/**
 * Fixed-window limiter for abuse-prone actions (demo form, reports, sandbox, tutor). Windows are
 * aligned to multiples of windowMs. The counters live in the rate_limit_buckets table, so every
 * server instance shares them: each call is one atomic upsert (INSERT ... ON CONFLICT DO UPDATE
 * SET count = count + 1 RETURNING count), and two concurrent calls never read the same count.
 * The job runner deletes windows older than RATE_LIMIT_MAX_WINDOW_MS once a day. Sign-in lockout
 * is enforced separately (login_attempts).
 */

/** The longest window a caller may use (a day: the AI subtitles' daily cap); the daily clean-up keeps windows this recent. */
export const RATE_LIMIT_MAX_WINDOW_MS = 24 * 60 * 60_000;

export type RateLimitResult = { ok: boolean; retryAfterMs: number };

function verdict(count: number, limit: number, windowStart: number, windowMs: number, now: number): RateLimitResult {
  return count > limit ? { ok: false, retryAfterMs: windowStart + windowMs - now } : { ok: true, retryAfterMs: 0 };
}

function windowOf(windowMs: number, now: number): number {
  if (!(windowMs > 0 && windowMs <= RATE_LIMIT_MAX_WINDOW_MS)) throw new Error(`rateLimit window must be between 1 ms and ${RATE_LIMIT_MAX_WINDOW_MS} ms`);
  return Math.floor(now / windowMs) * windowMs;
}

/** One request against `key` in the given database (exported for tests that bring their own database). */
export async function rateLimitIn(database: DB, key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
  const windowStart = windowOf(windowMs, now);
  const [row] = await database
    .insert(t.rateLimitBuckets)
    .values({ key, windowStart: new Date(windowStart), count: 1 })
    .onConflictDoUpdate({ target: [t.rateLimitBuckets.key, t.rateLimitBuckets.windowStart], set: { count: sql`${t.rateLimitBuckets.count} + 1` } })
    .returning({ count: t.rateLimitBuckets.count });
  return verdict(row.count, limit, windowStart, windowMs, now);
}

/**
 * Unit tests only: under Vitest (process.env.VITEST) the counters are kept in this process's memory,
 * so tests that run actions with a stubbed database need none. A server never takes this path.
 */
const memory = new Map<string, number>();

function rateLimitInMemory(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const windowStart = windowOf(windowMs, now);
  const bucket = `${key}\u0000${windowStart}`;
  const count = (memory.get(bucket) ?? 0) + 1;
  memory.set(bucket, count);
  return verdict(count, limit, windowStart, windowMs, now);
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (process.env.VITEST) return rateLimitInMemory(key, limit, windowMs);
  return rateLimitIn(db(), key, limit, windowMs);
}
