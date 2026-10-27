"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleCheck, Circle, LockKeyhole } from "lucide-react";
import { setPasswordAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { checkPassword } from "@/lib/password-strength";
import { cn } from "@/lib/cn";
import { authCard, authInput, authInputIcon, authTitle } from "../../../ui";

const MIN = 10;

// A failure before the server answers (offline, a dropped connection, a restart or deploy) stays on this form with the
// translated "try again" error, instead of the error boundary replacing the page; both password fields keep their values.
function submitPassword(prev: AuthState, data: FormData): Promise<AuthState> {
  return setPasswordAction(prev, data).catch((): AuthState => ({ error: "generic" }));
}

export function SetPasswordForm({ kind, token, name, email }: { kind: "invite" | "reset"; token: string; name: string; email: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState<AuthState, FormData>(submitPassword, undefined);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const score = useMemo(() => (pw ? checkPassword(pw, [email, name]).score : 0), [pw, email, name]);
  const rules = [
    { ok: pw.length >= MIN, label: t("account.rules.length", { min: MIN }) },
    { ok: pw.length > 0 && score >= 3, label: t("account.rules.strength") },
    { ok: pw.length > 0 && pw.toLowerCase() !== email.toLowerCase(), label: t("account.rules.notEmail") },
    { ok: pw.length > 0 && pw === confirm, label: t("account.rules.match") },
  ];

  if (state?.done) {
    return (
      <div className={`${authCard} text-center`}>
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-safe-50 text-safe-600 ring-8 ring-safe-50/50">
          <Check className="size-7" />
        </span>
        <h1 className={authTitle}>{t("account.doneTitle")}</h1>
        <p className="mt-2 text-body-sm text-ink-muted">{t("account.doneBody")}</p>
        <ButtonLink href="/sign-in" className="mt-6" size="lg">
          {t("account.signIn")}
        </ButtonLink>
      </div>
    );
  }
  const error = state?.error ? (state.error === "expired" ? t("account.expiredBody") : t(`account.errors.${state.error}` as "account.errors.generic", { min: MIN })) : null;

  return (
    <form action={action} className={cn("grid gap-5", authCard)}>
      <div>
        <p className="text-caption font-semibold text-brand-600">{t("account.greeting", { name })}</p>
        <h1 className={cn("mt-1", authTitle)}>{kind === "invite" ? t("account.titleInvite") : t("account.titleReset")}</h1>
        <p className="mt-1.5 text-caption text-ink-muted">
          <bdi>{email}</bdi>
        </p>
      </div>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="kind" value={kind} />
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label={t("account.passwordLabel")} htmlFor="password">
        <div dir="ltr" className="relative">
          <LockKeyhole aria-hidden className={authInputIcon} />
          <Input id="password" name="password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus className={authInput} />
        </div>
      </Field>
      <div aria-hidden className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-pill transition-colors", pw && score > i ? (score >= 3 ? "bg-safe-500" : score === 2 ? "bg-warn-500" : "bg-risk-500") : "bg-sunken")} />
        ))}
      </div>
      <Field label={t("account.confirmLabel")} htmlFor="confirm" error={error}>
        <div dir="ltr" className="relative">
          <LockKeyhole aria-hidden className={authInputIcon} />
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!error} className={authInput} />
        </div>
      </Field>
      <ul aria-label={t("account.rules.label")} className="grid gap-1.5 text-caption">
        {rules.map((r) => (
          <li key={r.label} className={cn("flex items-center gap-2", r.ok ? "text-safe-700" : "text-ink-muted")}>
            {r.ok ? <CircleCheck className="size-4" /> : <Circle className="size-4" />}
            {r.label}
          </li>
        ))}
      </ul>
      <SubmitButton size="lg" disabled={!rules.every((r) => r.ok)}>
        {kind === "invite" ? t("account.submitInvite") : t("account.submitReset")}
      </SubmitButton>
    </form>
  );
}
