"use client";

import { useActionState } from "react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Smartphone } from "lucide-react";
import { requestPhoneCodeAction, verifyPhoneCodeAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { authCard, authInput, authInputIcon, authLead, authNotice, authTitle } from "../../ui";

/**
 * A failure before the server answers (offline, a dropped connection, a restart or deploy) rejects the action, and
 * useActionState would rethrow it into the error boundary. It becomes the translated "try again" error on the form instead,
 * with the number kept; the redirect after a successful sign-in still goes through.
 */
function orGeneric(run: Promise<AuthState>, fallback: NonNullable<AuthState>): Promise<AuthState> {
  return run.catch((error: unknown): AuthState => {
    unstable_rethrow(error);
    return { ...fallback, error: "generic" };
  });
}
const sendCode = (prev: AuthState, data: FormData) => orGeneric(requestPhoneCodeAction(prev, data), { step: "phone", phone: String(data.get("phone") ?? "").trim() });
const verifyCode = (prev: AuthState, data: FormData) => orGeneric(verifyPhoneCodeAction(prev, data), { step: "code", phone: String(data.get("phone") ?? "") });

export function PhoneForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [sendState, send] = useActionState<AuthState, FormData>(sendCode, undefined);
  const [codeState, verify] = useActionState<AuthState, FormData>(verifyCode, undefined);
  const phone = codeState?.phone ?? sendState?.phone;
  const stage = sendState?.step === "code" && codeState?.step !== "phone" ? "code" : "phone";
  const err = (stage === "code" ? codeState?.error : sendState?.error) ?? null;
  const errorText = err ? t(`errors.${err}` as "errors.generic") : null;

  return (
    <div className={authCard}>
      {stage === "phone" ? (
        <form action={send} className="grid gap-5" noValidate>
          <div>
            <h1 className={authTitle}>{t("phone.title")}</h1>
            <p className={authLead}>{t("phone.subtitle")}</p>
          </div>
          <Field label={t("phone.label")} htmlFor="phone" error={errorText}>
            <div dir="ltr" className="relative">
              <Smartphone aria-hidden className={authInputIcon} />
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder={t("phone.placeholder")} defaultValue={phone} aria-invalid={!!errorText} className={authInput} />
            </div>
          </Field>
          <SubmitButton size="lg">{t("phone.send")}</SubmitButton>
        </form>
      ) : (
        <form action={verify} className="grid gap-5" noValidate>
          <div>
            <h1 className={authTitle}>{t("phone.codeTitle")}</h1>
            <p className={authLead}>{t("phone.codeSubtitle", { phone: phone ?? "" })}</p>
          </div>
          {sendState?.devCode ? <p className={`${authNotice} bg-warn-50 text-warn-700`}>{t("phone.devCode", { code: sendState.devCode })}</p> : null}
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
              className="h-14 text-center font-mono text-title tracking-[0.4em]"
              aria-invalid={!!errorText}
            />
          </Field>
          <SubmitButton size="lg">{t("phone.verify")}</SubmitButton>
        </form>
      )}
      <p className="my-5 flex items-center gap-3 text-tab font-medium text-ink-subtle">
        <span aria-hidden className="h-px flex-1 bg-line" />
        {t("or")}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
      <ButtonLink href={`/sign-in?next=${encodeURIComponent(next)}`} variant="secondary" icon={<Mail />} className="w-full">
        {t("withEmail")}
      </ButtonLink>
    </div>
  );
}
