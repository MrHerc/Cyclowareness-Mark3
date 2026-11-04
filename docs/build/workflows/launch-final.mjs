// Starts the production build of the clean copy on :3200 (preview "final").
// Next's standalone server chdirs into .next/standalone, so the static files, public/ and the seeded
// PGlite folder (.data) must be reachable from there.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "portal");
const SA = path.join(ROOT, ".next", "standalone");
if (!fs.existsSync(path.join(SA, "server.js"))) throw new Error(`no standalone build in ${SA}: run npm run build first`);

fs.cpSync(path.join(ROOT, "public"), path.join(SA, "public"), { recursive: true });
fs.cpSync(path.join(ROOT, ".next", "static"), path.join(SA, ".next", "static"), { recursive: true });
const data = path.join(SA, ".data");
if (!fs.existsSync(data)) fs.symlinkSync(path.join(ROOT, ".data"), data, "junction");

const env = { ...process.env };
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// A local single-process test stack: the production guards refuse an http APP_URL and the embedded
// database unless told so.
Object.assign(env, { PORT: "3200", HOSTNAME: "localhost", APP_URL: "http://localhost:3200", ALLOW_HTTP_APP_URL: "1", ALLOW_EMBEDDED_DB: "1", NODE_ENV: "production" });
spawn(process.execPath, [path.join(SA, "server.js")], { cwd: SA, env, stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 0));
