import type { MetadataRoute } from "next";
import { SITE_LOCALES } from "@/i18n/config";
import { env } from "@/server/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.APP_URL.replace(/\/$/, "");
  const languages = Object.fromEntries(SITE_LOCALES.map((l) => [l, `${base}/${l}`]));
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    ...SITE_LOCALES.map((l) => ({ url: `${base}/${l}`, changeFrequency: "weekly" as const, priority: 0.9, alternates: { languages } })),
    { url: `${base}/legal/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/legal/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
