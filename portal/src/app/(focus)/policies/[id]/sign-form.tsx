"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Signature } from "lucide-react";
import { signPolicyAction, type SignState } from "@/server/actions/policies";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toast";

export function SignForm({ versionId, needsPassword }: { versionId: string; needsPassword: boolean }) {
  const t = useTranslations("learner.policy");
  const tc = useTranslations("common");
  const [state, action] = useActionState<SignState, FormData>(signPolicyAction, undefined);
  useEffect(() => {
    if (state?.ok) toast(t("signedToast"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const error = state?.error === "agree" ? t("mustAgree") : state?.error === "password" ? t("wrongPassword") : state?.error === "rateLimited" ? tc("errors.rateLimited") : state?.error ? tc("errors.generic") : null;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="versionId" value={versionId} />
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <input type="checkbox" name="agree" className="mt-0.5 size-5 shrink-0 accent-(--brand)" />
        <span className="text-body-sm font-semibold">{t("agree")}</span>
      </label>
      {needsPassword ? (
        <Field label={t("password")} htmlFor="sign-password" error={error}>
          <Input id="sign-password" name="password" type="password" autoComplete="current-password" aria-invalid={!!error} />
        </Field>
      ) : error ? (
        <p role="alert" className="text-caption text-risk-600">
          {error}
        </p>
      ) : null}
      <SubmitButton size="lg" icon={<Signature />}>
        {t("sign")}
      </SubmitButton>
    </form>
  );
}
