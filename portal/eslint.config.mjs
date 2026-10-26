import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The cat mascot's canvas engine, vendored from design/mascot-cat/source (p2.js + p3.js + p4.js);
    // typed by engine.d.ts beside it. Re-port design changes instead of editing it by hand.
    "src/components/mascot/cat/engine.js",
  ]),
]);

export default eslintConfig;
