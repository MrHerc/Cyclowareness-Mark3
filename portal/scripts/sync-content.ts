/**
 * Loads the lesson library and learning paths from ./content into the configured database.
 * Safe to run again after content changes: modules and lessons are matched by slug/key and
 * updated in place, so progress and assignments are kept. Local: stop `next dev` first.
 */
import { createDb } from "../src/server/db/client";
import { syncLibrary, syncPaths } from "../src/server/services/library";

async function main() {
  const handle = createDb();
  const lib = await syncLibrary(handle.db);
  const paths = await syncPaths(handle.db);
  await handle.close();
  console.log(`Library synced (${handle.driver}): ${lib.modules} modules, ${lib.lessons} lessons, ${paths} paths.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
