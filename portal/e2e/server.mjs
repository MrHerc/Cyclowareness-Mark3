/**
 * The server the smoke suite runs against (playwright.config.ts starts it and sets E2E_PORT and SEED_PASSWORD).
 * Like `npm run demo`, it rebuilds the demo organisation in the embedded database (.data/pg), so stop
 * `npm run dev` in this folder first. CI serves the production standalone build of `npm run build`;
 * elsewhere it runs `next dev --webpack`.
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const port = process.env.E2E_PORT ?? "3400";
const appUrl = `http://localhost:${port}`;

// Command strings with a shell: npm and npx are .cmd files on Windows.
const reset = spawnSync("npm run db:reset", { cwd: root, stdio: "inherit", shell: true });
if (reset.status !== 0) process.exit(reset.status ?? 1);

let child;
if (process.env.CI) {
  // server.js changes into .next/standalone, so the embedded database is opened there (as in `npm run demo -- --prod`).
  const target = path.join(root, ".next", "standalone", ".data", "pg");
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(path.join(root, ".data", "pg"), target, { recursive: true });
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: "127.0.0.1",
    APP_URL: appUrl,
    // A local single-process test stack: the production guards refuse http and the embedded database otherwise.
    ALLOW_HTTP_APP_URL: "1",
    ALLOW_EMBEDDED_DB: "1",
    APP_SECRET: process.env.APP_SECRET || crypto.randomBytes(32).toString("base64url"),
  };
  child = spawn(process.execPath, ["scripts/start-standalone.mjs"], { cwd: root, env, stdio: "inherit" });
} else {
  child = spawn(`npx next dev --webpack -H 127.0.0.1 -p ${Number(port)}`, { cwd: root, env: { ...process.env, APP_URL: appUrl }, stdio: "inherit", shell: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
