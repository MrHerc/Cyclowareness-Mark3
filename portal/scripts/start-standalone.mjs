/**
 * Serves the production build outside Docker (`npm run build`, then `npm start`). The standalone
 * server expects public/, .next/static and content/ next to it; they are copied into
 * .next/standalone first. Configuration comes from the environment, as for the container
 * (DATABASE_URL, APP_SECRET, APP_URL, ...), and pending migrations are applied with
 * `node scripts/migrate.mjs` beforehand.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const out = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(out, "server.js"))) {
  console.error("No standalone build found in .next/standalone. Run `npm run build` first.");
  process.exit(1);
}
for (const dir of ["public", ".next/static", "content"]) {
  const from = path.join(root, dir);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(out, dir), { recursive: true, force: true });
}
// server.js changes into its own folder, so content/ is read from the copy above.
await import(pathToFileURL(path.join(out, "server.js")).href);
