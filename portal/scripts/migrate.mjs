/**
 * Production migrations: applies ./drizzle to DATABASE_URL (node-postgres) and exits.
 * Plain JavaScript so it runs inside the standalone image without tsx or TypeScript.
 * Local development keeps using `npm run db:migrate` (scripts/migrate.ts), which also
 * knows the embedded PGlite database.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set; the production image needs PostgreSQL.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
// Without a listener an idle-client error (database restart mid-run) would be thrown as an uncaught exception.
pool.on("error", (error) => console.error("[migrate] idle client error", error));
// The migrator's transaction holds a checked-out client, which has no pool listener: log its error
// too, so the migration rejects (exit code 1, pool closed) instead of crashing the process.
pool.on("connect", (client) => client.on("error", (error) => console.error("[migrate] client error", error)));
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied (pg).");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
