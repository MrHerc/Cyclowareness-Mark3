"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { requestPhoneCodeAction, verifyPhoneCodeAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function PhoneForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [sendState, send] = useActionState<AuthState, FormData>(requestPhoneCodeAction, undefined);
  const [codeState, verify] = useActionState<AuthState, FormData>(verifyPhoneCodeAction, undefined);
  const phone = codeState?.phone ?? sendState?.phone;
  const stage = sendState?.step === "code" && codeState?.step !== "phone" ? "code" : "phone";
  const err = (stage === "code" ? codeState?.error : sendState?.error) ?? null;
  const errorText = err ? t(`errors.${err}` as "errors.generic") : null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-7 shadow-raised sm:p-8">
      {stage === "phone" ? (
        <form action={send} className="grid gap-5" noValidate>
          <div>
            <h1 className="text-headline font-bold">{t("phone.title")}</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{t("phone.subtitle")}</p>
          </div>
          <Field label={t("phone.label")} htmlFor="phone" error={errorText}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder={t("phone.placeholder")} defaultValue={phone} aria-invalid={!!errorText} />
          </Field>
          <SubmitButton size="lg">{t("phone.send")}</SubmitButton>
        </form>
      ) : (
        <form action={verify} className="grid gap-5" noValidate>
          <div>
            <h1 className="text-headline font-bold">{t("phone.codeTitle")}</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{t("phone.codeSubtitle", { phone: phone ?? "" })}</p>
          </div>
          {sendState?.devCode ? <p className="rounded-md bg-warn-50 px-3.5 py-2.5 text-caption text-warn-700">{t("phone.devCode", { code: sendState.devCode })}</p> : null}
          <input type="hidden" name="phone" value={phone ?? ""} />
          <input type="hidden" name="next" value={next} />
          <Field label={t("phone.codeLabel")} htmlFor="code" error={errorText}>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              className="text-center font-mono text-title tracking-[0.4em]"
              aria-invalid={!!errorText}
            />
          </Field>
          <SubmitButton size="lg">{t("phone.verify")}</SubmitButton>
        </form>
      )}
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="mt-5 flex items-center justify-center gap-2 text-caption font-semibold text-brand-600 hover:underline">
        <Mail className="size-4" />
        {t("withEmail")}
      </Link>
    </div>
  );
}
