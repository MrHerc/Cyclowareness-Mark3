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
    // The cat mascot's canvas engine, typed by engine.d.ts beside it. It is the only source of the cat
    // (design/mascot-cat/README.md): edit it here; design/mascot-cat/source is a historical copy, do not re-port it.
    "src/components/mascot/cat/engine.js",
  ]),
]);

export default eslintConfig;
