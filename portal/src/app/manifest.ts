import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";

/**
 * PWA manifest (as on the original site: standalone, start at /start). Browsers fetch it without
 * cookies, so the language usually comes from Accept-Language; site-only languages fall back to
 * English, the same as the interface messages.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return {
    name: "Cyclowareness",
    short_name: "Cyclowareness",
    description: t("appDescription"),
    start_url: "/start",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#f7f6fb",
    theme_color: "#f7f6fb",
    lang: isLocale(locale) ? locale : "en",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
