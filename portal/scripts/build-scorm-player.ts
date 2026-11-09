/**
 * Builds the offline lesson player of the SCORM 1.2 export (src/scorm/entry.tsx): player.js, one IIFE script
 * that runs from file:// (no modules, no chunks, no absolute URLs), and player.css, the app's Tailwind CSS.
 *   npx tsx scripts/build-scorm-player.ts [outDir]      (default .data/scorm)
 * The export route builds it on first use when it is missing (src/server/scorm/player.ts); the Docker image
 * builds it in its builder stage. In development the route also rebuilds it once its sources are newer.
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const ROOT = path.join(__dirname, "..");
export const SCORM_PLAYER_DIR = path.join(ROOT, ".data", "scorm");

export async function buildScormPlayer(outDir = SCORM_PLAYER_DIR): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  await build({
    entryPoints: [path.join(ROOT, "src", "scorm", "entry.tsx")],
    outfile: path.join(outDir, "player.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: true,
    jsx: "automatic",
    legalComments: "none",
    logLevel: "warning",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "next/link": path.join(ROOT, "src", "scorm", "next-shim.tsx"), "next/navigation": path.join(ROOT, "src", "scorm", "next-shim.tsx") },
    plugins: [
      {
        name: "no-server",
        // Server actions (and anything else of the server) never reach the package: the player's onComplete replaces them.
        setup(b) {
          b.onResolve({ filter: /^@\/server\// }, () => ({ path: path.join(ROOT, "src", "scorm", "no-server.ts") }));
        },
      },
    ],
  });
  const from = path.join(ROOT, "src", "app", "globals.css");
  const css = await postcss([tailwind({ base: ROOT, optimize: true })]).process(fs.readFileSync(from, "utf8"), { from });
  // The app's fonts come from next/font, which sets these variables on <html>; without them the font stacks
  // are invalid and the page falls back to serif. The package uses the system's sans-serif instead.
  fs.writeFileSync(path.join(outDir, "player.css"), `${css.css}\n:root{--font-geologica:ui-sans-serif;--font-georgian:ui-sans-serif;--font-arabic:ui-sans-serif}\n`);
}

if (path.resolve(process.argv[1] ?? "") === __filename) {
  buildScormPlayer(process.argv[2] ? path.resolve(process.argv[2]) : undefined).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
