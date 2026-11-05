/**
 * One command to a ready-to-present demo: `npm run demo` (from portal/) or `npm --prefix portal run demo`
 * (from the repository root). It installs dependencies when they are missing, creates .env.local, rebuilds the
 * demo organisation "Safarov Industries" in the embedded database (no Docker, no PostgreSQL), starts the
 * portal and warms up the pages of the 3-minute walkthrough, so the first click in front of an audience does
 * not wait for a compile. The walkthrough is in docs/DEMO.md.
 *
 *   npm run demo                      development server on :3000 (fastest to start)
 *   npm run demo -- --prod            production build, then the standalone server (fastest pages; the build takes minutes)
 *   npm run demo -- --port 3005       another port
 *   npm run demo -- --keep-data       keep the current demo database (drills already run stay)
 *
 * Only Node.js built-ins are used here, so it runs before `npm ci`.
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const prod = flag("prod");
const keepData = flag("keep-data");
const port = Number(option("port", process.env.PORT ?? "3000"));
// This computer only: the demo accounts share a published password, and the session cookie needs localhost over HTTP.
const host = "127.0.0.1";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const say = (line) => console.log(`\x1b[36m[demo]\x1b[0m ${line}`);
/** The portal's server process once started; stopped on any exit so it never outlives this script. */
let child = null;
const fail = (line) => {
  console.error(`\x1b[31m[demo]\x1b[0m ${line}`);
  if (child && !child.killed) child.kill("SIGTERM");
  process.exit(1);
};

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (res.status !== 0) fail(`\`${cmd} ${cmdArgs.join(" ")}\` failed (exit code ${res.status}).`);
}

function portFreeOn(p, address) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(p, address);
  });
}

/** Free on the loopback address the server binds and on the wildcard (macOS lets both coexist, Linux does not). */
async function portFree(p) {
  return (await portFreeOn(p, "127.0.0.1")) && (await portFreeOn(p, "0.0.0.0"));
}

async function waitFor(url, timeoutMs, cookie = "") {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(120_000) });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/* 1. Requirements */
const [major] = process.versions.node.split(".").map(Number);
if (major < 24) fail(`Node.js 24 is needed (this is ${process.versions.node}).`);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`Not a port: ${option("port")}`);
if (!(await portFree(port))) {
  fail(
    `Port ${port} is in use. If it is an earlier demo or \`npm run dev\` from this folder, stop it first: both use the embedded database in .data/pg, which only one process may open. If it is an unrelated program, pass --port <another>.`,
  );
}

/* 2. Dependencies and configuration */
if (!fs.existsSync(path.join(root, "node_modules", "next"))) {
  say("Installing dependencies (npm ci)…");
  run(npm, ["ci", "--no-audit", "--no-fund"]);
}
const envLocal = path.join(root, ".env.local");
if (!fs.existsSync(envLocal)) {
  fs.copyFileSync(path.join(root, ".env.example"), envLocal);
  say("Created .env.local from .env.example.");
}

/* 3. A fresh demo organisation (the seed empties every table of the embedded database first) */
if (keepData && fs.existsSync(path.join(root, ".data", "pg"))) {
  say("Keeping the current demo database; applying pending migrations.");
  run(npm, ["run", "db:migrate"]);
} else {
  say("Building the demo organisation Safarov Industries (35 people, 60 days of history)…");
  run(npm, ["run", "db:reset"]);
}

/* 4. A short-lived session for the warm-up requests (the pages behind sign-in compile on their first request) */
const warm = spawnSync(npx, ["tsx", "scripts/demo-session.ts"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
const warmToken = warm.status === 0 ? warm.stdout.trim() : "";
if (!warmToken) say("Could not create the warm-up session; pages behind sign-in compile on their first visit instead.");

/* 5. Start the portal */
const appUrl = `http://localhost:${port}`;
// The warm-up calls the address the server binds to ("localhost" may resolve to ::1 first).
const warmBase = `http://${host}:${port}`;
if (prod) {
  // The standalone server runs from .next/standalone, so its embedded database lives next to it, and the build
  // deletes that folder. With --keep-data the previous production run's database (and its drills) is set aside first.
  const target = path.join(root, ".next", "standalone", ".data", "pg");
  const kept = path.join(root, ".data", "pg-standalone-kept");
  fs.rmSync(kept, { recursive: true, force: true });
  if (keepData && fs.existsSync(target)) fs.renameSync(target, kept);
  say("Production build (takes a few minutes)…");
  run(npm, ["run", "build"]);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(kept)) fs.renameSync(kept, target);
  else fs.cpSync(path.join(root, ".data", "pg"), target, { recursive: true });
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: host,
    APP_URL: appUrl,
    ALLOW_HTTP_APP_URL: "1",
    ALLOW_EMBEDDED_DB: "1",
    APP_SECRET: process.env.APP_SECRET || crypto.randomBytes(32).toString("base64url"),
    JOBS_ENABLED: "1",
  };
  say(`Starting the production server on ${appUrl}…`);
  child = spawn(process.execPath, ["scripts/start-standalone.mjs"], { cwd: root, env, stdio: "inherit" });
} else {
  say(`Starting the development server on ${appUrl}…`);
  child = spawn(npx, ["next", "dev", "--webpack", "-H", host, "-p", String(port)], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "inherit", shell: process.platform === "win32" });
}
const stop = () => child?.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
process.on("exit", () => {
  if (child && !child.killed && child.exitCode === null) child.kill("SIGTERM");
});

/* 6. Warm up the walkthrough's pages (each compiles on its first request in development) */
if (!(await waitFor(`${warmBase}/sign-in`, 300_000))) fail("The server did not answer within 5 minutes.");
say("Warming up the demo pages…");
const cookie = warmToken ? `${prod ? "__Host-cy_session" : "cy_session"}=${warmToken}` : "";
const zero = "00000000-0000-4000-8000-000000000000";
for (const route of ["/sign-in", "/admin/drill", `/admin/drill/${zero}`, `/api/admin/drill/${zero}`, "/admin", "/admin/campaigns", `/admin/campaigns/${zero}`, "/admin/threats", "/admin/leadership"]) {
  await waitFor(`${warmBase}${route}`, 300_000, cookie);
}

const email = "admin@safarovindustries.com";
console.log(`
\x1b[32m  Cyclowareness demo is ready.\x1b[0m

  1. Open      ${appUrl}/sign-in?next=/admin/drill
  2. Sign in   ${email}
               password: the SEED_PASSWORD value in portal/.env.example (unless you exported your own)
  3. Press     "Start the drill" and talk over the 90 seconds (script: docs/DEMO.md)

  Ctrl+C stops the server. Run it again for a fresh organisation, or add --keep-data to keep this one.
`);
