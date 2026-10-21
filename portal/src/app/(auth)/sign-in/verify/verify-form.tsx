"use client";

import { useActionState, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { verifySecondFactorAction, signOutAction, type AuthState } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextButton } from "@/components/ui/button";

/**
 * A failure before the server answers (offline, a dropped connection, a restart or deploy) rejects the action, and
 * useActionState would rethrow it into the error boundary. It becomes the translated "try again" error on the form instead;
 * the redirect after a correct code still goes through.
 */
function submitCode(prev: AuthState, data: FormData): Promise<AuthState> {
  return verifySecondFactorAction(prev, data).catch((error: unknown): AuthState => {
    unstable_rethrow(error);
    return { error: "generic", step: data.get("mode") === "backup" ? "backup" : "totp" };
  });
}

export function VerifyForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [state, action] = useActionState<AuthState, FormData>(submitCode, undefined);
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
        <TextButton className="justify-self-center" onClick={() => setMode(mode === "totp" ? "backup" : "totp")}>
          {mode === "totp" ? t("code.useBackup") : t("code.useAuthenticator")}
        </TextButton>
      </form>
      <form action={signOutAction} className="mt-3 text-center">
        <TextButton type="submit" tone="muted" className="font-normal">
          {t("code.otherAccount")}
        </TextButton>
      </form>
    </div>
  );
}
