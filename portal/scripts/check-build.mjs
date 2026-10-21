/**
 * Runs after `next build` (package.json "postbuild"). The build has no APP_URL (the image is built
 * once and started with any address), so src/server/env.ts falls back to http://localhost:3000
 * during it. Anything prerendered at build time that embeds that fallback would be served with
 * it in production, whatever APP_URL says at runtime: robots.txt, sitemap.xml and pages with
 * absolute links must render per request instead. This check fails the build when a prerendered
 * file still carries the fallback address.
 */
import fs from "node:fs";
import path from "node:path";

const FALLBACK_HOST = "localhost:3000";
/** Prerendered output: HTML pages, route-handler bodies (metadata routes) and RSC payloads. */
const PRERENDERED = [".html", ".body", ".rsc"];

const appDir = path.join(process.cwd(), ".next", "server", "app");
if (!fs.existsSync(appDir)) {
  console.error(`check-build: ${appDir} not found; run this after \`next build\`.`);
  process.exit(1);
}

const offending = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (PRERENDERED.some((ext) => entry.name.endsWith(ext)) && fs.readFileSync(file, "utf8").includes(FALLBACK_HOST)) {
      offending.push(path.relative(process.cwd(), file));
    }
  }
};
walk(appDir);

if (offending.length) {
  console.error(`check-build: ${offending.length} prerendered file(s) embed the build-time fallback address ${FALLBACK_HOST}:`);
  for (const file of offending) console.error(`  ${file}`);
  console.error("Render these routes per request (export const dynamic = \"force-dynamic\", or await connection()) so they use the runtime APP_URL.");
  process.exit(1);
}
console.info("check-build: no prerendered output embeds the build-time fallback address.");
