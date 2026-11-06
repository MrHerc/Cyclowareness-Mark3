import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

// Spread like PGLITE_SEGMENTS (db/client.ts): the build's file tracer must not copy a local build into .next/standalone.
const SEGMENTS = [".data", "scorm"];
let building: Promise<unknown> | null = null;

/**
 * The offline player's player.js and player.css. The Docker image ships them (built in its builder stage);
 * in development the first export builds them with scripts/build-scorm-player.ts, once for concurrent requests.
 */
export async function scormPlayer(): Promise<{ js: Buffer; css: Buffer }> {
  const dir = path.join(process.cwd(), ...SEGMENTS);
  const read = async () => ({ js: await fs.readFile(path.join(dir, "player.js")), css: await fs.readFile(path.join(dir, "player.css")) });
  try {
    return await read();
  } catch {
    building ??= promisify(execFile)(process.execPath, ["--import", "tsx", path.join("scripts", "build-scorm-player.ts"), dir], { cwd: process.cwd() }).finally(() => (building = null));
    await building;
    return read();
  }
}
