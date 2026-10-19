"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { createTicketAction, sendFeedbackAction, type TicketState } from "@/server/actions/engage";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export function NewTicket() {
  const t = useTranslations("learner.help");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<TicketState, FormData>(async (prev, data) => {
    const res = await createTicketAction(prev, data);
    if (res?.ok) {
      toast(t("created", { number: res.number ?? 0 }));
      setOpen(false);
      router.refresh();
    }
    return res;
  }, undefined);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("newTicket")}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("newTicket")}>
        <form action={action} className="grid gap-4">
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
          <Field label={t("subject")} htmlFor="subject" error={state?.error === "invalid" ? tc("errors.invalid") : state?.error === "rateLimited" ? tc("errors.rateLimited") : null}>
            <Input id="subject" name="subject" required minLength={3} maxLength={200} />
          </Field>
          <Field label={t("body")} htmlFor="body">
            <Textarea id="body" name="body" required minLength={3} maxLength={5000} />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>{t("submit")}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function FeedbackForm() {
  const t = useTranslations("learner.help");
  const tc = useTranslations("common");
  const [rating, setRating] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const action = async (data: FormData) => {
    const res = await sendFeedbackAction(undefined, data);
    if (res?.ok) {
      toast(t("feedbackThanks"));
      form.current?.reset();
      setRating(0);
    }
  };
  return (
    <form ref={form} action={action} className="grid gap-4">
      <input type="hidden" name="rating" value={rating} />
      <div>
        <p className="text-caption font-semibold">{t("rating")}</p>
        <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={t("rating")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={String(n)} onClick={() => setRating(n)} className="rounded-full p-1 hover:bg-sunken">
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
      <SubmitButton variant="secondary" disabled={!rating}>
        {t("sendFeedback")}
      </SubmitButton>
    </form>
  );
}
