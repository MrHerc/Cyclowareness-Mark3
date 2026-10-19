/**
 * Applies SQL migrations from ./drizzle to the configured database.
 * Local: embedded PGlite in .data/pg (stop `next dev` first). Production: DATABASE_URL.
 */
import path from "node:path";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createDb } from "../src/server/db/client";

async function main() {
  const handle = createDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (handle.driver === "pg") await migratePg(handle.db, { migrationsFolder });
  else await migratePglite(handle.db as unknown as PgliteDatabase, { migrationsFolder });
  await handle.close();
  console.log(`Migrations applied (${handle.driver}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
