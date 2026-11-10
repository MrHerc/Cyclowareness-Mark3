"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { toggleSessionAction } from "@/server/actions/engage";
import { Button, TextButton } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

export function SessionButton({ id, registered, full }: { id: string; registered: boolean; full: boolean }) {
  const t = useTranslations("learner.sessions");
  const { run, pending } = useAction(toggleSessionAction, { successToast: registered ? t("cancelledToast") : t("registeredToast"), errorMap: { full: t("full") } });
  if (registered) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-safe-700">
          <CheckCircle2 className="size-4" />
          {t("registered")}
        </span>
        <TextButton tone="muted" size="tab" className="font-normal hover:text-risk-600" disabled={pending} onClick={() => run(id, false)}>
          {t("cancel")}
        </TextButton>
      </div>
    );
  }
  return (
    <Button size="sm" disabled={full || pending} onClick={() => run(id, true)}>
      {t("register")}
    </Button>
  );
}
