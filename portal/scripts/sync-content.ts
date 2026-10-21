/**
 * Loads the lesson library and learning paths from ./content into the configured database.
 * Safe to run again after content changes: modules and lessons are matched by slug/key and
 * updated in place, so progress and assignments are kept. The production server runs the same
 * import on every start (src/server/bootstrap.ts). Local: stop `next dev` first.
 */
import { sql } from "drizzle-orm";
import { createDb, type DB } from "../src/server/db/client";
import { CONTENT_SYNC_LOCK_KEY, syncLibrary, syncPaths } from "../src/server/services/library";

async function main() {
  const handle = createDb();
  const run = async (db: DB) => ({ lib: await syncLibrary(db), paths: await syncPaths(db) });
  // With PostgreSQL: one transaction under the same lock the servers take, so a running server's
  // start-up import and this one never overlap, and a failed import changes nothing.
  const { lib, paths } =
    handle.driver === "pg"
      ? await handle.db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(${CONTENT_SYNC_LOCK_KEY})`);
          return run(tx as unknown as DB);
        })
      : await run(handle.db);
  await handle.close();
  console.log(`Library synced (${handle.driver}): ${lib.modules} modules, ${lib.lessons} lessons, ${paths} paths.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
