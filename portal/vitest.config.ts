import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // `vitest run --coverage` (CI). Floor: the behavioural tests (without the seven translation-parity files)
    // covered 63.6 % of the lines on 2026-11-05; 60 leaves a margin. Raise it as coverage grows.
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**"],
      reporter: ["text-summary", "html"],
      thresholds: { lines: 60 },
    },
  },
});
