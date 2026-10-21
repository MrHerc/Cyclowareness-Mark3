import type { MetadataRoute } from "next";
import { SITE_LOCALES } from "@/i18n/config";
import { appUrl } from "@/server/env";

/** Rendered per request: the sitemap address comes from the runtime APP_URL, never from the build's environment. */
export const dynamic = "force-dynamic";

/** Public site and legal pages are indexable; everything personal or tracking is not. */
export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
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
