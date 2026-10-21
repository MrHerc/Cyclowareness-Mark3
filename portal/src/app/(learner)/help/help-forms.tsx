"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Star } from "lucide-react";
import { createTicketAction, sendFeedbackAction, type FeedbackState, type TicketState } from "@/server/actions/engage";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export function NewTicket() {
  const t = useTranslations("learner.help");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("newTicket")}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("newTicket")}>
        {/* The dialog unmounts its body when closed, so a reopened form starts without the previous error. */}
        <NewTicketForm onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("learner.help");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, action, pending] = useActionState<TicketState, FormData>(async (prev, data) => {
    // A thrown action (server unreachable) becomes the generic form error instead of unmounting the form.
    let res: TicketState;
    try {
      res = await createTicketAction(prev, data);
    } catch {
      return { error: "generic" };
    }
    if (res?.ok) {
      toast(t("created", { number: res.number ?? 0 }));
      onDone();
      router.refresh();
    }
    return res;
  }, undefined);
  const [, startSubmit] = useTransition();
  // Field errors stay on their field; anything without a field of its own is shown above the form.
  const fields = state?.fields ?? [];
  const subjectError = fields.includes("subject") ? t("subjectError") : null;
  const bodyError = fields.includes("body") ? t("bodyError") : null;
  const formError = !state?.error || subjectError || bodyError ? null : formErrorMessage(state.error, tc);
  const invalid = (error: unknown, id: string) => (error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});
  return (
    // Submitted through a transition rather than the form action, so a rejected form keeps what was typed.
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startSubmit(() => action(data));
      }}
    >
      {formError ? (
        <Notice tone="risk" icon={<AlertTriangle />}>
          <span role="alert">{formError}</span>
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("category")} htmlFor="category">
          <Select id="category" name="category" defaultValue="training">
            {(["training", "technical", "account", "security", "other"] as const).map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("priority")} htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="medium">
            {(["low", "medium", "high"] as const).map((p) => (
              <option key={p} value={p}>
                {t(`priorities.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("subject")} htmlFor="subject" error={subjectError}>
        <Input id="subject" name="subject" required minLength={3} maxLength={200} {...invalid(subjectError, "subject")} />
      </Field>
      <Field label={t("body")} htmlFor="body" error={bodyError}>
        <Textarea id="body" name="body" required minLength={3} maxLength={5000} {...invalid(bodyError, "body")} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}

/** Message for an error the server could not attach to a single field. */
function formErrorMessage(error: string, tc: ReturnType<typeof useTranslations<"common">>) {
  return error === "rateLimited" ? tc("errors.rateLimited") : error === "forbidden" ? tc("errors.forbidden") : tc("errors.generic");
}

export function FeedbackForm() {
  const t = useTranslations("learner.help");
  const tc = useTranslations("common");
  const [rating, setRating] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const [pending, startSubmit] = useTransition();
  const submit = (data: FormData) =>
    startSubmit(async () => {
      // A thrown action (server unreachable) is reported like any other failure; the comment stays.
      const res = await sendFeedbackAction(undefined, data).catch((): FeedbackState => ({ error: "generic" }));
      if (res?.ok) {
        toast(t("feedbackThanks"));
        form.current?.reset();
        setRating(0);
      } else toast(formErrorMessage(res?.error ?? "", tc), "error");
    });
  return (
    // Submitted through a transition rather than the form action, so a rejected form keeps the comment that was typed.
    <form
      ref={form}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="rating" value={rating} />
      <div>
        <p className="text-caption font-semibold">{t("rating")}</p>
        <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={t("rating")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={String(n)} onClick={() => setRating(n)} className="rounded-full p-1 hover:bg-sunken pointer-coarse:p-2">
              <Star className={cn("size-7", n <= rating ? "fill-laurel-500 text-laurel-600" : "text-line-strong")} />
            </button>
          ))}
        </div>
      </div>
      <Field label={t("topic")} htmlFor="topic">
        <Select id="topic" name="topic" defaultValue="platform">
          {(["platform", "module", "idea"] as const).map((x) => (
            <option key={x} value={x}>
              {t(`topics.${x}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("comment")} htmlFor="comment" optional={tc("optional")}>
        <Textarea id="comment" name="comment" maxLength={3000} />
      </Field>
      <Checkbox name="anonymous" label={t("anonymous")} />
      <SubmitButton variant="secondary" disabled={!rating} pending={pending}>
        {t("sendFeedback")}
      </SubmitButton>
    </form>
  );
}
