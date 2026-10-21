"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Signature } from "lucide-react";
import { signPolicyAction, type SignState } from "@/server/actions/policies";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toast";

// A rejected submit (server unreachable, a deploy in between) becomes the generic error on this form
// instead of replacing the sign-off page with the error boundary.
function submitSign(prev: SignState, data: FormData): Promise<SignState> {
  return signPolicyAction(prev, data).catch((): SignState => ({ error: "generic" }));
}

export function SignForm({ versionId, needsPassword }: { versionId: string; needsPassword: boolean }) {
  const t = useTranslations("learner.policy");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<SignState, FormData>(submitSign, undefined);
  const [, startSubmit] = useTransition();
  useEffect(() => {
    if (state?.ok) toast(t("signedToast"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const error = state?.error === "agree" ? t("mustAgree") : state?.error === "password" ? t("wrongPassword") : state?.error === "rateLimited" ? tc("errors.rateLimited") : state?.error ? tc("errors.generic") : null;
  // Only a wrong password marks the password field; every other refusal is said above the button.
  const passwordError = needsPassword && state?.error === "password" ? error : null;
  return (
    // `action` stays on the form so React replays a submit made before hydration instead of the browser
    // sending a GET that puts the password in the URL. Once hydrated, onSubmit dispatches in its own
    // transition: React then skips its automatic form reset, so a refused submit keeps the ticked box
    // and the typed password.
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startSubmit(() => action(data));
      }}
      className="grid gap-4"
    >
      <input type="hidden" name="versionId" value={versionId} />
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <input type="checkbox" name="agree" className="mt-0.5 size-5 shrink-0 accent-(--brand)" />
        <span className="text-body-sm font-semibold">{t("agree")}</span>
      </label>
      {needsPassword ? (
        <Field label={t("password")} htmlFor="sign-password" error={passwordError}>
          <Input id="sign-password" name="password" type="password" autoComplete="current-password" aria-invalid={!!passwordError} aria-describedby={passwordError ? "sign-password-error" : undefined} />
        </Field>
      ) : null}
      {error && !passwordError ? (
        <p role="alert" className="text-caption text-risk-600">
          {error}
        </p>
      ) : null}
      <SubmitButton size="lg" icon={<Signature />} pending={pending}>
        {t("sign")}
      </SubmitButton>
    </form>
  );
}
