import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** The page is a client component, so its tab title comes from here. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgot.metaTitle"), robots: { index: false } };
}

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
