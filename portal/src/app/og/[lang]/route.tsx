import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { loadLanding } from "@/server/landing";
import { SITE_LOCALES, isSiteLocale } from "@/i18n/config";

/** OpenGraph card of the public site, one per language: /og/{lang} (1200×630 PNG). */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LOCALES.map((lang) => ({ lang }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLocale(lang)) notFound();
  const { copy } = await loadLanding(lang);
  const icon = `data:image/png;base64,${(await readFile(path.join(process.cwd(), "public", "icons", "icon-512.png"))).toString("base64")}`;
  // Satori (the renderer behind ImageResponse) supports inline styles only.
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#1d1a4e", color: "#fff", padding: 72, alignItems: "center", gap: 56 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img only */}
        <img src={icon} width={240} height={240} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, lineHeight: 1.05 }}>{copy.seo.ogTitle}</div>
          <div style={{ fontSize: 36, opacity: 0.8 }}>{copy.seo.ogDescription}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
