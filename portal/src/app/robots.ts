import type { MetadataRoute } from "next";
import { SITE_LOCALES } from "@/i18n/config";
import { env } from "@/server/env";

/** Public site and legal pages are indexable; everything personal or tracking is not. */
export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/", ...SITE_LOCALES.map((l) => `/${l}`), "/og/"],
        disallow: ["/admin", "/super", "/learn", "/api/", "/t/", "/q/", "/c/", "/account/", "/dev/", "/print/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
