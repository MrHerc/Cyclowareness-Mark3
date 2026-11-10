"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Mail, ShieldAlert } from "lucide-react";
import { reportThreatAction, type ReportState } from "@/server/actions/security";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const CHANNELS = ["email", "sms", "call", "link", "file", "in_person", "other"] as const;

/** `forwardTo`: the organisation's report address (Settings → Integrations), offered for suspicious mail when set. */
export function ReportForm({ onDone, forwardTo }: { onDone?: () => void; forwardTo?: string }) {
  const t = useTranslations("security.report");
  const tc = useTranslations("common");
  // A thrown action (server unreachable) becomes the generic form error instead of unmounting the form.
  const [state, action, pending] = useActionState<ReportState, FormData>((prev, data) => reportThreatAction(prev, data).catch(() => ({ error: "generic" })), undefined);
  const [, startSubmit] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  // The subject error belongs to its field; rate limits and anything else are shown above the form.
  const subjectError = state?.error === "subject" ? t("errors.subject") : null;
  const formError = !state?.error || subjectError ? null : state.error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.generic");

  useEffect(() => {
    if (!state?.ok || !state.number) return;
    toast(state.simulation ? (state.xp ? t("simulation", { xp: state.xp }) : t("simulationNoXp")) : state.xp ? t("thanksXp", { number: state.number, xp: state.xp }) : t("thanks", { number: state.number }));
    form.current?.reset();
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    // Submitted through a transition rather than the form action, so a rejected report keeps what was typed.
    <form
      ref={form}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startSubmit(() => action(data));
      }}
    >
      {forwardTo ? (
        <Notice icon={<Mail />}>
          {t("forwardHint")}{" "}
          <bdi dir="ltr" className="font-semibold break-all">
            {forwardTo}
          </bdi>
        </Notice>
      ) : null}
      {formError ? (
        <Notice tone="risk" icon={<AlertTriangle />}>
          <span role="alert">{formError}</span>
        </Notice>
      ) : null}
      <Field label={t("channel")} htmlFor="channel">
        <Select id="channel" name="channel" defaultValue="email">
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`channels.${c}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("subject")} htmlFor="subject" error={subjectError}>
        <Input id="subject" name="subject" maxLength={300} placeholder={t("subjectPlaceholder")} required {...(subjectError ? { "aria-invalid": true, "aria-describedby": "subject-error" } : {})} />
      </Field>
      <Field label={t("details")} htmlFor="details" optional={tc("optional")}>
        <Textarea id="details" name="details" maxLength={4000} placeholder={t("detailsPlaceholder")} />
      </Field>
      <Field label={t("url")} htmlFor="url" hint={t("urlHint")}>
        <Input id="url" name="url" maxLength={2000} inputMode="url" autoComplete="off" spellCheck={false} placeholder="hxxps://…" />
      </Field>
      <div className="flex justify-end gap-3 pt-1">
        {onDone ? (
          <Button variant="secondary" onClick={onDone}>
            {tc("cancel")}
          </Button>
        ) : null}
        <SubmitButton icon={<ShieldAlert />} pending={pending}>
          {t("submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ReportButton({ className, variant = "compact", forwardTo }: { className?: string; variant?: "compact" | "full"; forwardTo?: string }) {
  const t = useTranslations("security.report");
  const tn = useTranslations("common.nav");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          variant === "compact"
            ? "inline-flex h-10 items-center gap-2 rounded-pill bg-risk-50 px-3 text-caption font-semibold text-risk-700 ring-1 ring-risk-100 hover:bg-risk-100"
            : "inline-flex h-11 items-center gap-2 rounded-pill bg-risk-600 px-5 text-body-sm font-semibold text-white hover:bg-risk-700",
          className,
        )}
      >
        <ShieldAlert className="size-4.5" />
        <span className={variant === "compact" ? "hidden sm:inline" : undefined}>{variant === "compact" ? tn("reportShort") : t("cta")}</span>
        {variant === "compact" ? <span className="sr-only sm:hidden">{tn("report")}</span> : null}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("title")} description={forwardTo ? t("descriptionForward") : t("description")}>
        {open ? <ReportForm onDone={() => setOpen(false)} forwardTo={forwardTo} /> : null}
      </Dialog>
    </>
  );
}
