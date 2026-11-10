"use client";

import { useTranslations } from "next-intl";
import { setProblemStatusAction } from "@/server/actions/workspace";
import { Select } from "@/components/ui/field";
import { useAction } from "@/components/ui/use-action";

const STATUSES = ["new", "in_progress", "resolved", "not_a_problem"] as const;

export function ProblemStatus({ id, status }: { id: string; status: (typeof STATUSES)[number] }) {
  const t = useTranslations("admin.problems");
  const { run, pending } = useAction(setProblemStatusAction, { successToast: t("changed") });
  return (
    <Select
      className="h-9 w-44"
      aria-label={t("move")}
      value={status}
      disabled={pending}
      onChange={(e) => run(id, e.target.value as typeof status)}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`status.${s}`)}
        </option>
      ))}
    </Select>
  );
}
