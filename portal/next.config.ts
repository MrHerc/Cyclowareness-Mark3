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
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  // Almost every page is per-user and per-tenant, so we use classic dynamic rendering
  // instead of Cache Components (docs/build/DECISIONS.md, ADR-002).
  cacheComponents: false,
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2", "pg", "nodemailer"],
  experimental: {
    // Sandbox uploads are up to 10 MB.
    serverActions: { bodySizeLimit: "11mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/rive/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
      // The service worker must be revalidated on every load so updates reach people quickly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
