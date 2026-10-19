"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setProblemStatusAction } from "@/server/actions/workspace";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const STATUSES = ["new", "in_progress", "resolved", "not_a_problem"] as const;

export function ProblemStatus({ id, status }: { id: string; status: (typeof STATUSES)[number] }) {
  const t = useTranslations("admin.problems");
  const [pending, start] = useTransition();
  return (
    <Select
      className="h-9 w-44"
      aria-label={t("move")}
      value={status}
      disabled={pending}
      onChange={(e) => start(async () => void ((await setProblemStatusAction(id, e.target.value as typeof status)).ok && toast(t("changed"))))}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`status.${s}`)}
        </option>
      ))}
    </Select>
  );
}
