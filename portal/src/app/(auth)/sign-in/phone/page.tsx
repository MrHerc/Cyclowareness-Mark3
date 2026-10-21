import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safePath } from "@/lib/safe-path";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/server/auth/viewer";
import { PhoneForm } from "./phone-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("phone.title"), robots: { index: false } };
}

export default async function PhoneSignInPage({ searchParams }: PageProps<"/sign-in/phone">) {
  const sp = await searchParams;
  const next = safePath(sp.next);
  if (await getViewer()) redirect(next);
  return <PhoneForm next={next} />;
}
