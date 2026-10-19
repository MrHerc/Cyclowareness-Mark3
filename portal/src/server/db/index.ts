import "server-only";
import { createDb, type DB, type DbHandle } from "./client";

declare global {
  var __dbHandle: DbHandle | undefined;
}

/** One connection (pool or embedded instance) per server process, reused across hot reloads. */
export function db(): DB {
  globalThis.__dbHandle ??= createDb();
  return globalThis.__dbHandle.db;
}

export function dbDriver(): DbHandle["driver"] {
  globalThis.__dbHandle ??= createDb();
  return globalThis.__dbHandle.driver;
}

export type { DB };
export * as t from "./schema";
