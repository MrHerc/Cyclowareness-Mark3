"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { toggleSessionAction } from "@/server/actions/engage";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function SessionButton({ id, registered, full }: { id: string; registered: boolean; full: boolean }) {
  const t = useTranslations("learner.sessions");
  const [pending, start] = useTransition();
  if (registered) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-safe-700">
          <CheckCircle2 className="size-4" />
          {t("registered")}
        </span>
        <button type="button" disabled={pending} className="text-tab text-ink-muted hover:text-risk-600 hover:underline" onClick={() => start(async () => void ((await toggleSessionAction(id, false)).ok && toast(t("cancelledToast"))))}>
          {t("cancel")}
        </button>
      </div>
    );
  }
  return (
    <Button size="sm" disabled={full || pending} onClick={() => start(async () => void ((await toggleSessionAction(id, true)).ok && toast(t("registeredToast"))))}>
      {t("register")}
    </Button>
  );
}
