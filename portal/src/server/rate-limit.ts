import "server-only";

/**
 * Fixed-window limiter for abuse-prone actions (demo form, reports, sandbox, tutor).
 * In-memory per instance; sign-in lockout is enforced separately in the database.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (buckets.size > 50_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count++;
  if (bucket.count > limit) return { ok: false, retryAfterMs: bucket.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}
