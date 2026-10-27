import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { loadLanding } from "@/server/landing";
import { SITE_LOCALES, isSiteLocale, type SiteLocale } from "@/i18n/config";

/** OpenGraph card of the public site, one per language: /og/{lang} (1200×630 PNG). */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LOCALES.map((lang) => ({ lang }));
}

/**
 * The renderer's bundled font (Geist) covers Latin and Cyrillic only. Languages in another script
 * get a font with that script; DejaVu Sans (Bitstream Vera licence, embedded in the file) has Georgian.
 */
const SCRIPT_FONTS: Partial<Record<SiteLocale, { name: string; file: string }>> = {
  ka: { name: "DejaVu Sans", file: "DejaVuSans.ttf" },
};

/** Long titles get a smaller size so they wrap within two lines of the 760 px text column. */
function titleSize(title: string): number {
  if (title.length <= 18) return 84;
  if (title.length <= 28) return 68;
  return 56;
}

export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLocale(lang)) notFound();
  // shortcut: Satori neither joins Arabic letters nor reorders right-to-left text, so /og/ar is the English card; render ar once Satori shapes Arabic, or ship a pre-drawn PNG.
  const card = lang === "ar" ? "en" : lang;
  const { copy } = await loadLanding(card);
  const icon = `data:image/png;base64,${(await readFile(path.join(process.cwd(), "public", "icons", "icon-512.png"))).toString("base64")}`;
  const scriptFont = SCRIPT_FONTS[card];
  const fonts = scriptFont
    ? [{ name: scriptFont.name, data: await readFile(path.join(process.cwd(), "public", "fonts", scriptFont.file)), weight: 400 as const, style: "normal" as const }]
    : undefined;
  // Satori (the renderer behind ImageResponse) supports inline styles only. The text column takes
  // the width left of the icon (1200 − 2×72 padding − 240 icon − 56 gap = 760 px) so lines wrap
  // instead of running off the canvas; lineClamp keeps unusually long copy inside the 630 px height.
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#1d1a4e",
          color: "#fff",
          padding: 72,
          alignItems: "center",
          gap: 56,
          ...(scriptFont ? { fontFamily: scriptFont.name } : {}),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img only */}
        <img src={icon} width={240} height={240} alt="" style={{ flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 24 }}>
          <div style={{ display: "block", fontSize: titleSize(copy.seo.ogTitle), lineHeight: 1.1, lineClamp: 2 }}>{copy.seo.ogTitle}</div>
          <div style={{ display: "block", fontSize: 36, lineHeight: 1.3, opacity: 0.8, lineClamp: 4 }}>{copy.seo.ogDescription}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
