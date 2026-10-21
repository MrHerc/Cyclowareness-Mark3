"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Building2, Eye, EyeOff, Smartphone } from "lucide-react";
import { checkEmailAction, signInAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { ButtonAnchor } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

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
    <div className="rounded-2xl border border-line bg-surface p-7 shadow-raised sm:p-8">
      {stage === "sso" ? (
        <div className="grid gap-5">
          <div>
            <button
              type="button"
              onClick={() => setStage("email")}
              aria-label={t("changeEmail")}
              className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-1.5 text-caption font-semibold text-ink-muted hover:text-ink pointer-coarse:min-h-11"
            >
              <ArrowLeft className="size-4" />
              <span className="max-w-56 truncate">{email}</span>
            </button>
            <h1 className="text-headline font-bold">{t("ssoTitle")}</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{t("ssoBody")}</p>
          </div>
          <ButtonAnchor href={ssoUrl} size="lg" icon={<Building2 />}>
            {t("ssoContinue")}
          </ButtonAnchor>
        </div>
      ) : stage === "email" ? (
        <form action={emailAction} className="grid gap-5" noValidate>
          <div>
            <h1 className="text-headline font-bold">{t("title")}</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{t("subtitle")}</p>
          </div>
          {notice ? <p className="rounded-md bg-safe-50 px-3.5 py-2.5 text-caption text-safe-700">{notice}</p> : null}
          {alertText ? (
            <p role="alert" className="rounded-md bg-risk-50 px-3.5 py-2.5 text-caption text-risk-700">
              {alertText}
            </p>
          ) : null}
          <Field label={t("emailLabel")} htmlFor="email" error={errorText}>
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
              required
            />
          </Field>
          <SubmitButton size="lg">{t("next")}</SubmitButton>
          <Link
            href={`/sign-in/phone?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center justify-center gap-2 text-caption font-semibold text-brand-600 hover:underline pointer-coarse:-my-3 pointer-coarse:min-h-11"
          >
            <Smartphone className="size-4" />
            {t("withPhone")}
          </Link>
        </form>
      ) : (
        <form action={pwAction} className="grid gap-5" noValidate>
          <div>
            <button
              type="button"
              onClick={() => setStage("email")}
              aria-label={t("changeEmail")}
              className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-sunken px-3 py-1.5 text-caption font-semibold text-ink-muted hover:text-ink pointer-coarse:min-h-11"
            >
              <ArrowLeft className="size-4" />
              <span className="max-w-56 truncate">{email}</span>
            </button>
            <h1 className="text-headline font-bold">{t("passwordTitle")}</h1>
          </div>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <Field label={t("passwordLabel")} htmlFor="password" error={errorText}>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                aria-invalid={!!errorText}
                aria-describedby={errorText ? "password-error" : undefined}
                className="pr-12"
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
      <p className="mt-6 text-center text-tab text-ink-subtle">
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
