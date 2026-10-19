"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, MailCheck } from "lucide-react";
import { forgotPasswordAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export default function ForgotPage() {
  const t = useTranslations("auth");
  const [state, action] = useActionState<AuthState, FormData>(forgotPasswordAction, undefined);
  const error = state?.error ? t(`errors.${state.error}` as "errors.generic") : null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-7 shadow-raised sm:p-8">
      {state?.done ? (
        <div className="grid gap-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-safe-50 text-safe-600">
            <MailCheck className="size-7" />
          </span>
          <h1 className="text-title font-bold">{t("forgot.doneTitle")}</h1>
          <p className="text-body-sm text-ink-muted">{t("forgot.doneBody")}</p>
          <Link href="/sign-in" className="text-caption font-semibold text-brand-600 hover:underline">
            {t("forgot.back")}
          </Link>
        </div>
      ) : (
        <form action={action} className="grid gap-5" noValidate>
          <Link href="/sign-in" className="inline-flex w-fit items-center gap-1.5 text-caption font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" />
            {t("forgot.back")}
          </Link>
          <div>
            <h1 className="text-headline font-bold">{t("forgot.title")}</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{t("forgot.subtitle")}</p>
          </div>
          <Field label={t("emailLabel")} htmlFor="email" error={error}>
            <Input id="email" name="email" type="email" autoComplete="email" autoFocus placeholder={t("emailPlaceholder")} aria-invalid={!!error} />
          </Field>
          <SubmitButton size="lg">{t("forgot.submit")}</SubmitButton>
        </form>
      )}
    </div>
  );
}
