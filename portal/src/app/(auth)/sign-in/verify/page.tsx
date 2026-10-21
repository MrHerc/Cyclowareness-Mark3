import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safePath } from "@/lib/safe-path";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/server/auth/viewer";
import { VerifyForm } from "./verify-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("code.title"), robots: { index: false } };
}

export default async function VerifyPage({ searchParams }: PageProps<"/sign-in/verify">) {
  const sp = await searchParams;
  const next = safePath(sp.next);
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.user.totpEnabled || session.twoFactorVerified) redirect(next);
  return <VerifyForm next={next} />;
}
