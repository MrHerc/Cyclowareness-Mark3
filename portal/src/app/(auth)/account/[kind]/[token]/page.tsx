import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { LinkIcon } from "lucide-react";
import { db, t } from "@/server/db";
import { sha256Hex } from "@/server/crypto";
import { ButtonLink } from "@/components/ui/button";
import { SetPasswordForm } from "./set-password-form";
import { authCard, authTitle } from "../../../ui";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getTranslations("auth");
  return { title: tr("account.metaTitle"), robots: { index: false }, referrer: "no-referrer" };
}

export default async function AccountLinkPage({ params }: PageProps<"/account/[kind]/[token]">) {
  const { kind, token } = await params;
  if (kind !== "invite" && kind !== "reset") notFound();
  const tr = await getTranslations("auth");
  const [row] = token.length < 100
    ? await db()
        .select({ usedAt: t.authTokens.usedAt, expiresAt: t.authTokens.expiresAt, name: t.users.name, email: t.users.email })
        .from(t.authTokens)
        .innerJoin(t.users, eq(t.users.id, t.authTokens.userId))
        .where(and(eq(t.authTokens.id, sha256Hex(token)), eq(t.authTokens.kind, kind)))
    : [];

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return (
      <div className={`${authCard} text-center`}>
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-sunken text-ink-subtle ring-8 ring-sunken/50">
          <LinkIcon className="size-6" />
        </span>
        <h1 className={authTitle}>{row ? tr("account.expiredTitle") : tr("account.invalidTitle")}</h1>
        <p className="mt-2 text-body-sm text-ink-muted">{row ? tr("account.expiredBody") : tr("account.invalidBody")}</p>
        <ButtonLink href="/sign-in" className="mt-6" variant="secondary">
          {tr("account.signIn")}
        </ButtonLink>
      </div>
    );
  }
  return <SetPasswordForm kind={kind} token={token} name={row.name} email={row.email} />;
}
