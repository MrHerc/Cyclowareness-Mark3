"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, CircleAlert, Mail, MailCheck } from "lucide-react";
import { forgotPasswordAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { authCard, authInput, authInputIcon, authLead, authNotice, authTitle } from "../../ui";

// A thrown action (database or mail queue unavailable) stays on this form with the email kept,
// instead of replacing the page with the error boundary.
const FAILED = "failed";
function submitForgot(prev: AuthState, data: FormData): Promise<AuthState> {
  return forgotPasswordAction(prev, data).catch((): AuthState => ({ error: FAILED, email: String(data.get("email") ?? "") }));
}

export default function ForgotPage() {
  const t = useTranslations("auth");
  const [state, action] = useActionState<AuthState, FormData>(submitForgot, undefined);
  const failed = state?.error === FAILED;
  const error = state?.error && !failed ? t(`errors.${state.error}` as "errors.generic") : null;
  return (
    <div className={authCard}>
      {state?.done ? (
        <div className="grid gap-4 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-safe-50 text-safe-600 ring-8 ring-safe-50/50">
            <MailCheck className="size-7" />
          </span>
          <h1 className={authTitle}>{t("forgot.doneTitle")}</h1>
          <p className="text-body-sm text-ink-muted">{t("forgot.doneBody")}</p>
          <Link href="/sign-in" className="inline-flex w-fit items-center justify-self-center text-caption font-semibold text-brand-600 hover:underline pointer-coarse:-my-3 pointer-coarse:min-h-11">
            {t("forgot.back")}
          </Link>
        </div>
      ) : (
        <form action={action} className="grid gap-5" noValidate>
          <Link href="/sign-in" className="inline-flex w-fit items-center gap-1.5 text-caption font-semibold text-ink-muted hover:text-ink pointer-coarse:-my-3 pointer-coarse:min-h-11">
            <ArrowLeft className="size-4" />
            {t("forgot.back")}
          </Link>
          <div>
            <h1 className={authTitle}>{t("forgot.title")}</h1>
            <p className={authLead}>{t("forgot.subtitle")}</p>
          </div>
          {failed ? (
            <p role="alert" className={`${authNotice} bg-risk-50 text-risk-700`}>
              <CircleAlert aria-hidden />
              {t("forgot.failed")}
            </p>
          ) : null}
          <Field label={t("emailLabel")} htmlFor="email" error={error}>
            <div dir="ltr" className="relative">
              <Mail aria-hidden className={authInputIcon} />
              <Input id="email" name="email" type="email" autoComplete="email" autoFocus defaultValue={state?.email} placeholder={t("emailPlaceholder")} aria-invalid={!!error} aria-describedby={error ? "email-error" : undefined} className={authInput} />
            </div>
          </Field>
          <SubmitButton size="lg">{t("forgot.submit")}</SubmitButton>
        </form>
      )}
    </div>
  );
}
