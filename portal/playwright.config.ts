import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke suite (e2e/): `npx playwright test`. e2e/server.mjs rebuilds the demo organisation in the
 * embedded database and serves it: the production standalone build in CI (`npm run build` first), `next dev`
 * elsewhere. Variables are set on process.env here, so the server, the seed and the test workers share them.
 */
const ci = !!process.env.CI;
process.env.E2E_PORT ||= "3400";
// The demo accounts' password: SEED_PASSWORD from the environment (CI exports its own), else .env.local, else .env.example.
process.env.SEED_PASSWORD ||= seedPassword();

function seedPassword(): string {
  for (const file of [".env.local", ".env.example"]) {
    const full = path.join(__dirname, file);
    const line = fs.existsSync(full) ? /^SEED_PASSWORD=(.*)$/m.exec(fs.readFileSync(full, "utf8")) : null;
    const value = line?.[1].trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  throw new Error("SEED_PASSWORD is not set in the environment, .env.local or .env.example.");
}

export default defineConfig({
  testDir: "e2e",
  // Development compiles every route on its first request, which can take minutes on a cold cache.
  timeout: ci ? 60_000 : 900_000,
  expect: { timeout: ci ? 15_000 : 300_000 },
  // One worker: the journeys switch the shared demo accounts' interface language.
  workers: 1,
  forbidOnly: ci,
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    // localhost, not 127.0.0.1: the production session cookie is Secure, which browsers accept over http only there.
    baseURL: `http://localhost:${process.env.E2E_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "en", use: { ...devices["Desktop Chrome"], locale: "en" } },
    { name: "ar", use: { ...devices["Desktop Chrome"], locale: "ar" } },
  ],
  webServer: {
    command: "node e2e/server.mjs",
    url: `http://127.0.0.1:${process.env.E2E_PORT}/api/health`,
    // The production server answers before its start-up library sync, which holds the embedded database for a while.
    wait: ci ? { stdout: /\[bootstrap\] library synced/ } : undefined,
    // The seed takes about a minute; a cold development server compiles its first route on top.
    timeout: ci ? 240_000 : 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
