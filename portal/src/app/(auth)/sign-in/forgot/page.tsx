"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, MailCheck } from "lucide-react";
import { forgotPasswordAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

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
    <div className="rounded-2xl border border-line bg-surface p-7 shadow-raised sm:p-8">
      {state?.done ? (
        <div className="grid gap-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-safe-50 text-safe-600">
            <MailCheck className="size-7" />
          </span>
          <h1 className="text-title font-bold">{t("forgot.doneTitle")}</h1>
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
            <h1 className="text-headline font-bold">{t("forgot.title")}</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{t("forgot.subtitle")}</p>
          </div>
          {failed ? (
            <p role="alert" className="rounded-md bg-risk-50 px-3.5 py-2.5 text-caption text-risk-700">
              {t("forgot.failed")}
            </p>
          ) : null}
          <Field label={t("emailLabel")} htmlFor="email" error={error}>
            <Input id="email" name="email" type="email" autoComplete="email" autoFocus defaultValue={state?.email} placeholder={t("emailPlaceholder")} aria-invalid={!!error} aria-describedby={error ? "email-error" : undefined} />
          </Field>
          <SubmitButton size="lg">{t("forgot.submit")}</SubmitButton>
        </form>
      )}
    </div>
  );
}
