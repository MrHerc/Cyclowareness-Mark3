import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

// Spread like PGLITE_SEGMENTS (db/client.ts): the build's file tracer must not copy a local build into .next/standalone.
const SEGMENTS = [".data", "scorm"];
// What the bundle is built from. The Docker image has none of them, so its build (made with the image) is never stale.
const SOURCES = [["src", "scorm"], ["src", "components", "player"], ["src", "lib", "content"], ["messages"]];
let building: Promise<unknown> | null = null;

/** The newest modification time under the bundle's sources, 0 where they are absent. */
async function newestSource(root: string) {
  let newest = 0;
  for (const segments of SOURCES) {
    const dir = path.join(root, ...segments);
    const files = await fs.readdir(dir, { recursive: true }).catch(() => [] as string[]);
    for (const f of files) newest = Math.max(newest, (await fs.stat(path.join(dir, f))).mtimeMs);
  }
  return newest;
}

/**
 * The offline player's player.js and player.css. The Docker image ships them (built in its builder stage);
 * in development an export builds them with scripts/build-scorm-player.ts when they are missing or older than
 * their sources, once for concurrent requests.
 */
export async function scormPlayer(): Promise<{ js: Buffer; css: Buffer }> {
  const root = process.cwd();
  const dir = path.join(root, ...SEGMENTS);
  const built = await fs.stat(path.join(dir, "player.js")).then((s) => s.mtimeMs, () => 0);
  if (!built || built < (await newestSource(root))) {
    building ??= promisify(execFile)(process.execPath, ["--import", "tsx", path.join("scripts", "build-scorm-player.ts"), dir], { cwd: root }).finally(() => (building = null));
    await building;
  }
  return { js: await fs.readFile(path.join(dir, "player.js")), css: await fs.readFile(path.join(dir, "player.css")) };
}
