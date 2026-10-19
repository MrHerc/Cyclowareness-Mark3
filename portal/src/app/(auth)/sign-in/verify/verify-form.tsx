"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { verifySecondFactorAction, signOutAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function VerifyForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [state, action] = useActionState<AuthState, FormData>(verifySecondFactorAction, undefined);
  const error = state?.error && state.step === mode ? t(`errors.${state.error}` as "errors.generic") : null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-7 shadow-raised sm:p-8">
      <form action={action} className="grid gap-5" noValidate key={mode}>
        <div>
          <h1 className="text-headline font-bold">{mode === "totp" ? t("code.title") : t("code.backupTitle")}</h1>
          <p className="mt-2 text-body-sm text-ink-muted">{mode === "totp" ? t("code.subtitle") : t("code.backupSubtitle")}</p>
        </div>
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />
        <Field label={mode === "totp" ? t("code.label") : t("code.backupLabel")} htmlFor="code" error={error}>
          <Input
            id="code"
            name="code"
            autoFocus
            autoComplete="one-time-code"
            inputMode={mode === "totp" ? "numeric" : "text"}
            pattern={mode === "totp" ? "[0-9]{6}" : undefined}
            maxLength={mode === "totp" ? 6 : 16}
            className="text-center font-mono text-title tracking-[0.4em]"
            aria-invalid={!!error}
          />
        </Field>
        <SubmitButton size="lg">{t("code.verify")}</SubmitButton>
        <button type="button" onClick={() => setMode(mode === "totp" ? "backup" : "totp")} className="text-caption font-semibold text-brand-600 hover:underline">
          {mode === "totp" ? t("code.useBackup") : t("code.useAuthenticator")}
        </button>
      </form>
      <form action={signOutAction} className="mt-3 text-center">
        <button type="submit" className="text-caption text-ink-muted hover:text-ink hover:underline">
          {t("code.otherAccount")}
        </button>
      </form>
    </div>
  );
}
