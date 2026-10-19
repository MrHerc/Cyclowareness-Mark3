import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

/** Local development database (embedded Postgres). Production sets DATABASE_URL. */
export const PGLITE_DIR = path.join(process.cwd(), ".data", "pg");

export type DbHandle = {
  db: DB;
  driver: "pg" | "pglite";
  close: () => Promise<void>;
};

export function createDb(): DbHandle {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
    return { db: drizzlePg(pool, { schema }), driver: "pg", close: () => pool.end() };
  }
  fs.mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  // The PGlite and node-postgres drivers expose the same query builder surface.
  return { db: drizzlePglite(client, { schema }) as unknown as DB, driver: "pglite", close: () => client.close() };
}
