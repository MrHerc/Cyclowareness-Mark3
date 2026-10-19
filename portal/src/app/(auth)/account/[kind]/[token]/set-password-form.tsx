"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleCheck, Circle } from "lucide-react";
import { setPasswordAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { checkPassword } from "@/lib/password-strength";
import { cn } from "@/lib/cn";

const MIN = 10;

export function SetPasswordForm({ kind, token, name, email }: { kind: "invite" | "reset"; token: string; name: string; email: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState<AuthState, FormData>(setPasswordAction, undefined);
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
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-raised">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-safe-50 text-safe-600">
          <Check className="size-7" />
        </span>
        <h1 className="text-title font-bold">{t("account.doneTitle")}</h1>
        <p className="mt-2 text-body-sm text-ink-muted">{t("account.doneBody")}</p>
        <ButtonLink href="/sign-in" className="mt-6" size="lg">
          {t("account.signIn")}
        </ButtonLink>
      </div>
    );
  }
  const error = state?.error ? (state.error === "expired" ? t("account.expiredBody") : t(`account.errors.${state.error}` as "account.errors.generic", { min: MIN })) : null;

  return (
    <form action={action} className="grid gap-5 rounded-2xl border border-line bg-surface p-7 shadow-raised sm:p-8">
      <div>
        <p className="text-caption font-semibold text-brand-600">{t("account.greeting", { name })}</p>
        <h1 className="mt-1 text-headline font-bold">{kind === "invite" ? t("account.titleInvite") : t("account.titleReset")}</h1>
        <p className="mt-1.5 text-caption text-ink-muted">{email}</p>
      </div>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="kind" value={kind} />
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label={t("account.passwordLabel")} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
      <div aria-hidden className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-pill transition-colors", pw && score > i ? (score >= 3 ? "bg-safe-500" : score === 2 ? "bg-warn-500" : "bg-risk-500") : "bg-sunken")} />
        ))}
      </div>
      <Field label={t("account.confirmLabel")} htmlFor="confirm" error={error}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!error} />
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
