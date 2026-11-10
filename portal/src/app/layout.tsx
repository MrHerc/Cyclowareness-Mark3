import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Geologica, Noto_Sans_Arabic, Noto_Sans_Georgian } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";
import { dirOf } from "@/i18n/config";
import { getViewer } from "@/server/auth/viewer";
import { brandStyle } from "@/lib/color";
import { Toaster } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { IntlScope } from "@/components/intl-scope";
import { env } from "@/server/env";
import "./globals.css";

const geologica = Geologica({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-geologica",
  display: "swap",
});
// Not preloaded: their unicode-range faces download only on a page that shows Georgian or Arabic text.
const georgian = Noto_Sans_Georgian({ subsets: ["georgian"], variable: "--font-georgian", display: "swap", preload: false });
// No Arial fallback face: it has no unicode-range, so Latin words in Arabic text would render in Arial instead of Geologica.
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap", preload: false, adjustFontFallback: false });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: "Cyclowareness", template: "%s · Cyclowareness" },
    applicationName: "Cyclowareness",
    description: t("appDescription"),
    icons: { icon: [{ url: "/favicon.ico" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f7f6fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, viewer] = await Promise.all([getLocale(), getViewer()]);
  const style = brandStyle(viewer?.tenant.branding.primary, viewer?.tenant.branding.accent) as CSSProperties;
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${geologica.variable} ${georgian.variable} ${arabic.variable}`} data-motion={viewer?.user.motion ?? "full"} style={style}>
      <body>
        <IntlScope surface="root">
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </IntlScope>
      </body>
    </html>
  );
}
