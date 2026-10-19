import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/server/auth/viewer";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn"), robots: { index: true, follow: false } };
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  if (await getViewer()) redirect(next);
  const t = await getTranslations("auth");
  return <SignInForm next={next} notice={sp.signedOut ? t("signedOut") : undefined} alertText={sp.error === "sso" ? t("errors.sso") : undefined} />;
}
