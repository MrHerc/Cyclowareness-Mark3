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

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied (pg).");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
