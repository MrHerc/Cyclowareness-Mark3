import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Geologica, Noto_Sans_Georgian } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { getViewer } from "@/server/auth/viewer";
import { brandStyle } from "@/lib/color";
import { Toaster } from "@/components/ui/toast";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { env } from "@/server/env";
import "./globals.css";

const geologica = Geologica({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-geologica",
  display: "swap",
});
const georgian = Noto_Sans_Georgian({ subsets: ["georgian"], variable: "--font-georgian", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: "Cyclowareness", template: "%s · Cyclowareness" },
  applicationName: "Cyclowareness",
  description: "Kiber təhlükələri tanımağı qısa, interaktiv dərslərlə öyrənin.",
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/icon-192.png" },
  formatDetection: { telephone: false, email: false, address: false },
};

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
    <html lang={locale} className={`${geologica.variable} ${georgian.variable}`} data-motion={viewer?.user.motion ?? "full"} style={style}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
