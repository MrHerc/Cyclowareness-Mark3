import type { MetadataRoute } from "next";
import { SITE_LOCALES } from "@/i18n/config";
import { appUrl } from "@/server/env";

/** Rendered per request: every <loc> and hreflang link comes from the runtime APP_URL, never from the build's environment. */
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const languages = Object.fromEntries(SITE_LOCALES.map((l) => [l, `${base}/${l}`]));
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    ...SITE_LOCALES.map((l) => ({ url: `${base}/${l}`, changeFrequency: "weekly" as const, priority: 0.9, alternates: { languages } })),
    { url: `${base}/legal/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/legal/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
