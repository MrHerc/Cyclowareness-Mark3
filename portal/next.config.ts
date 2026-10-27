import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // The microphone is used only by the tutor's voice questions.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  // Strict-Transport-Security is set per request in src/proxy.ts: these headers are fixed at build
  // time, while subdomain coverage and preload are an operator's choice at run time.
];

const nextConfig: NextConfig = {
  // Almost every page is per-user and per-tenant, so we use classic dynamic rendering
  // instead of Cache Components (docs/build/DECISIONS.md, ADR-002).
  cacheComponents: false,
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  // Pins the standalone layout to .next/standalone/server.js (scripts/start-standalone.mjs and the
  // Dockerfile rely on it). Without it Next guesses the root from lockfiles, and one in a parent
  // folder nests the server under that folder's path.
  outputFileTracingRoot: __dirname,
  // The standalone build must never carry the local development database (accounts, sessions,
  // secrets). client.ts keeps the folder out of the tracer's reach; this is the second layer
  // (the "postbuild" script removes anything that still slipped in). content/ is read from disk
  // at run time, so it travels with the server.
  outputFileTracingExcludes: { "**": ["./.data/**/*"] },
  outputFileTracingIncludes: { "**": ["./content/**/*"] },
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2", "pg", "nodemailer"],
  experimental: {
    // Sandbox uploads are up to 10 MB.
    serverActions: { bodySizeLimit: "11mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/rive/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
      // Narration clips are named by a hash of their text and voice: a changed sentence is a new file.
      { source: "/generated/tts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The service worker must be revalidated on every load so updates reach people quickly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
