"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { reportThreatAction, type ReportState } from "@/server/actions/security";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const CHANNELS = ["email", "sms", "call", "link", "file", "in_person", "other"] as const;

export function ReportForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("security.report");
  const tc = useTranslations("common");
  const [state, action] = useActionState<ReportState, FormData>(reportThreatAction, undefined);

  useEffect(() => {
    if (!state?.ok || !state.number) return;
    toast(state.simulation ? t("simulation", { xp: state.xp ?? 0 }) : state.xp ? t("thanksXp", { number: state.number, xp: state.xp }) : t("thanks", { number: state.number }));
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-4">
      <Field label={t("channel")} htmlFor="channel">
        <Select id="channel" name="channel" defaultValue="email">
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`channels.${c}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("subject")} htmlFor="subject" error={state?.error === "subject" ? t("errors.subject") : state?.error === "rateLimited" ? tc("errors.rateLimited") : null}>
        <Input id="subject" name="subject" maxLength={300} placeholder={t("subjectPlaceholder")} required aria-invalid={state?.error === "subject"} />
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
        <SubmitButton icon={<ShieldAlert />}>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}

export function ReportButton({ className, variant = "compact" }: { className?: string; variant?: "compact" | "full" }) {
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
      <Dialog open={open} onClose={() => setOpen(false)} title={t("title")} description={t("description")}>
        {open ? <ReportForm onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}
