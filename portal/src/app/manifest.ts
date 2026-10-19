import type { MetadataRoute } from "next";

/** PWA manifest (as on the original site: standalone, start at /start). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cyclowareness",
    short_name: "Cyclowareness",
    description: "Kiber təhlükələri tanımağı qısa, interaktiv dərslərlə öyrənin.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#f7f6fb",
    theme_color: "#f7f6fb",
    lang: "az",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
