"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Building2, CircleAlert, CircleCheck, Eye, EyeOff, LockKeyhole, Mail, Smartphone } from "lucide-react";
import { checkEmailAction, signInAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { authBackPill, authCard, authInput, authInputIcon, authLead, authNotice, authTitle } from "../ui";

/**
 * A failure before the server answers (offline, a dropped connection, a restart or deploy) rejects the action, and
 * useActionState would rethrow it into the error boundary. It becomes the translated "try again" error on the form instead,
 * with what was typed; the redirect after a successful sign-in still goes through.
 */
function orGeneric(run: Promise<AuthState>, fallback: NonNullable<AuthState>): Promise<AuthState> {
  return run.catch((error: unknown): AuthState => {
    unstable_rethrow(error);
    return { ...fallback, error: "generic" };
  });
}

export function SignInForm({ next, notice, alertText }: { next: string; notice?: string; alertText?: string }) {
  const t = useTranslations("auth");
  const [stage, setStage] = useState<"email" | "password" | "sso">("email");
  const [email, setEmail] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [show, setShow] = useState(false);
  // Errors from an earlier password attempt must not reappear after "change email".
  const [seenPw, setSeenPw] = useState<AuthState>(undefined);
  // The stage moves in the submit path, as soon as a result is known.
  const [pwState, pwAction] = useActionState<AuthState, FormData>(async (prev, data) => {
    const res = await orGeneric(signInAction(prev, data), { step: "password", email: String(data.get("email") ?? "") });
    if (res?.step === "email") setStage("email");
    return res;
  }, undefined);
  const [emailState, emailAction] = useActionState<AuthState, FormData>(async (prev, data) => {
    const res = await orGeneric(checkEmailAction(prev, data), { email: String(data.get("email") ?? "").trim() });
    if (res?.step === "password" && res.email) {
      setEmail(res.email);
      setSeenPw(pwState);
      setStage("password");
    } else if (res?.step === "sso" && res.email && res.ssoUrl) {
      // A proven single sign-on domain: the organisation's provider takes over.
      setEmail(res.email);
      setSsoUrl(res.ssoUrl);
      setStage("sso");
    }
    return res;
  }, undefined);

  useEffect(() => {
    if (stage === "sso" && ssoUrl) window.location.assign(ssoUrl);
  }, [stage, ssoUrl]);

  const error = stage === "password" ? (pwState !== seenPw ? pwState?.error : undefined) : stage === "email" && emailState?.step !== "password" && emailState?.step !== "sso" ? emailState?.error : undefined;
  const errorText = error ? (error === "blocked" ? t("blocked") : t(`errors.${error}` as "errors.generic")) : null;

  return (
    <div className={authCard}>
      {stage === "sso" ? (
        <div className="grid gap-5">
          <div>
            <button type="button" onClick={() => setStage("email")} aria-label={t("changeEmail")} className={authBackPill}>
              <ArrowLeft className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{email}</span>
            </button>
            <h1 className={authTitle}>{t("ssoTitle")}</h1>
            <p className={authLead}>{t("ssoBody")}</p>
          </div>
          <ButtonAnchor href={ssoUrl} size="lg" icon={<Building2 />}>
            {t("ssoContinue")}
          </ButtonAnchor>
        </div>
      ) : stage === "email" ? (
        <form action={emailAction} className="grid gap-5" noValidate>
          <div>
            <h1 className={authTitle}>{t("title")}</h1>
            <p className={authLead}>{t("subtitle")}</p>
          </div>
          {notice ? (
            <p className={`${authNotice} bg-safe-50 text-safe-700`}>
              <CircleCheck aria-hidden />
              {notice}
            </p>
          ) : null}
          {alertText ? (
            <p role="alert" className={`${authNotice} bg-risk-50 text-risk-700`}>
              <CircleAlert aria-hidden />
              {alertText}
            </p>
          ) : null}
          <Field label={t("emailLabel")} htmlFor="email" error={errorText}>
            <div className="relative">
              <Mail aria-hidden className={authInputIcon} />
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                defaultValue={emailState?.email ?? email}
                placeholder={t("emailPlaceholder")}
                aria-invalid={!!errorText}
                aria-describedby={errorText ? "email-error" : undefined}
                className={authInput}
                required
              />
            </div>
          </Field>
          <SubmitButton size="lg">{t("next")}</SubmitButton>
          <p className="flex items-center gap-3 text-tab font-medium text-ink-subtle">
            <span aria-hidden className="h-px flex-1 bg-line" />
            {t("or")}
            <span aria-hidden className="h-px flex-1 bg-line" />
          </p>
          <ButtonLink href={`/sign-in/phone?next=${encodeURIComponent(next)}`} variant="secondary" icon={<Smartphone />}>
            {t("withPhone")}
          </ButtonLink>
        </form>
      ) : (
        <form action={pwAction} className="grid gap-5" noValidate>
          <div>
            <button type="button" onClick={() => setStage("email")} aria-label={t("changeEmail")} className={authBackPill}>
              <ArrowLeft className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{email}</span>
            </button>
            <h1 className={authTitle}>{t("passwordTitle")}</h1>
          </div>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <Field label={t("passwordLabel")} htmlFor="password" error={errorText}>
            <div className="relative">
              <LockKeyhole aria-hidden className={authInputIcon} />
              <Input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                aria-invalid={!!errorText}
                aria-describedby={errorText ? "password-error" : undefined}
                className={`${authInput} pr-12`}
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? t("hidePassword") : t("showPassword")}
                className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:right-0.5 pointer-coarse:size-11"
              >
                {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
          </Field>
          <SubmitButton size="lg">{t("signIn")}</SubmitButton>
          <Link href="/sign-in/forgot" className="inline-flex items-center justify-center text-caption font-semibold text-brand-600 hover:underline pointer-coarse:-my-3 pointer-coarse:min-h-11">
            {t("forgotLink")}
          </Link>
        </form>
      )}
      <p className="mt-7 border-t border-line pt-5 text-center text-tab leading-normal text-pretty text-ink-subtle">
        {t.rich("consent", {
          terms: (c) => (
            <Link href="/legal/terms" className="underline hover:text-ink">
              {c}
            </Link>
          ),
          privacy: (c) => (
            <Link href="/legal/privacy" className="underline hover:text-ink">
              {c}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
