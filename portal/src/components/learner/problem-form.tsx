"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { reportProblemAction } from "@/server/actions/learning";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/layout";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

/**
 * "Report a problem" form (lesson player, /profile). Submitted through a transition rather than the
 * form action, so a rejected report keeps what was typed and says why: a message that is too short
 * is marked on the field, a rate limit or a failed call is shown above the form.
 */
export function ProblemForm({ context, onSent, className }: { context: string; onSent: () => void; className?: string }) {
  const t = useTranslations("learner.problem");
  const tc = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAction(reportProblemAction, { successToast: t("sent"), onSuccess: onSent, onError: setError });
  const messageError = error === "message" ? t("messageError") : null;
  const formError = !error || messageError ? null : error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.generic");
  return (
    <form
      className={cn("grid gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        run(undefined, new FormData(e.currentTarget));
      }}
    >
      {formError ? (
        <Notice tone="risk" icon={<AlertTriangle />}>
          <span role="alert">{formError}</span>
        </Notice>
      ) : null}
      <input type="hidden" name="context" value={context} />
      <Textarea
        name="message"
        aria-label={t("message")}
        placeholder={t("message")}
        required
        minLength={3}
        maxLength={4000}
        aria-invalid={messageError ? true : undefined}
        aria-describedby={messageError ? "problem-message-error" : undefined}
      />
      {messageError ? (
        <p id="problem-message-error" role="alert" className="text-caption text-risk-600">
          {messageError}
        </p>
      ) : null}
      <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
    </form>
  );
}
