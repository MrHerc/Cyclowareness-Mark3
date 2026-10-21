import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

/**
 * Local development database (embedded Postgres). Production sets DATABASE_URL.
 * The segments are spread so the build's output file tracer cannot resolve the folder statically
 * and copy the developer database into .next/standalone (outputFileTracingExcludes does not
 * match on Windows); the value at run time is the same.
 */
const PGLITE_SEGMENTS = [".data", "pg"];
export const PGLITE_DIR = path.join(process.cwd(), ...PGLITE_SEGMENTS);

export type DbHandle = {
  db: DB;
  driver: "pg" | "pglite";
  /** The node-postgres pool (pg driver only), for work that needs one dedicated connection. */
  pool?: pg.Pool;
  close: () => Promise<void>;
};

/**
 * Pool size. Also validated by src/server/env.ts for the server; checked here as well because the
 * scripts (seed, content sync, worker) open the database without the server's env module.
 */
function poolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX;
  if (!raw) return 10;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2 || n > 100) throw new Error("DATABASE_POOL_MAX must be an integer between 2 and 100.");
  return n;
}

export function createDb(): DbHandle {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: poolMax(), connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 });
    // An idle client whose backend went away (restart, failover, network) is reported here; without
    // a listener the EventEmitter would throw and take the whole process down. The pool replaces it.
    pool.on("error", (error) => console.error("[db] idle client error", error));
    // A checked-out client (a transaction, the job runner's lock connection) has no pool listener;
    // its 'error' would be thrown as well. The failed query rejects normally, and pg-pool discards
    // the broken client when it is released.
    pool.on("connect", (client) => client.on("error", (error) => console.error("[db] client error", error)));
    return { db: drizzlePg(pool, { schema }), driver: "pg", pool, close: () => pool.end() };
  }
  // A production server without DATABASE_URL must not quietly open (or create) a local database file.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !building && process.env.ALLOW_EMBEDDED_DB !== "1") {
    throw new Error("DATABASE_URL is not set. Production needs PostgreSQL (set ALLOW_EMBEDDED_DB=1 only for a single-process demo).");
  }
  fs.mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  // The PGlite and node-postgres drivers expose the same query builder surface.
  return { db: drizzlePglite(client, { schema }) as unknown as DB, driver: "pglite", close: () => client.close() };
}
