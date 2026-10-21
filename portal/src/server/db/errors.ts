/**
 * PostgreSQL error inspection that works for node-postgres and PGlite errors, also when drizzle
 * wraps them (DrizzleQueryError keeps the driver error as `cause`).
 */
type PgLike = { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };

function driverError(error: unknown): PgLike | null {
  let e = error as PgLike | undefined;
  for (let depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return e;
    e = e.cause as PgLike | undefined;
  }
  return null;
}

/** SQLSTATE 23503: a foreign key refused the change (a row still references it). With `constraint`, only that key counts. */
export function isForeignKeyViolation(error: unknown, constraint?: string): boolean {
  const e = driverError(error);
  if (!e || e.code !== "23503") return false;
  if (!constraint) return true;
  return e.constraint === constraint || String(e.message ?? "").includes(`"${constraint}"`);
}

/** SQLSTATE 23505: a unique index refused the row. With `constraint`, only that index counts. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = driverError(error);
  if (!e || e.code !== "23505") return false;
  if (!constraint) return true;
  return e.constraint === constraint || String(e.message ?? "").includes(`"${constraint}"`);
}
