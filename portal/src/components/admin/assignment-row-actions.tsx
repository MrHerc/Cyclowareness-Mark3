"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Trash2 } from "lucide-react";
import { removeAssignmentAction, updateDueAction } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Segmented } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

export function AssignmentRowActions({ id, dueKind, dueDate, dueDays }: { id: string; dueKind: "none" | "fixed" | "after_joining"; dueDate: string | null; dueDays: number | null }) {
  const t = useTranslations("admin.assignments");
  const tc = useTranslations("common");
  const [open, setOpen] = useState<null | "due" | "remove">(null);
  const [kind, setKind] = useState(dueKind);
  const [date, setDate] = useState(dueDate ?? "");
  const [days, setDays] = useState(dueDays ?? 30);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="ghost" icon={<CalendarClock />} onClick={() => setOpen("due")}>
        {t("editDue")}
      </Button>
      <Button size="sm" variant="ghost" className="text-risk-600" icon={<Trash2 />} onClick={() => setOpen("remove")}>
        {t("remove")}
      </Button>
      <Dialog open={open === "due"} onClose={() => setOpen(null)} title={t("editDue")} size="sm">
        <div className="grid gap-4">
          <Segmented
            name="due-kind"
            value={kind}
            onChange={(x) => setKind(x as typeof kind)}
            options={[
              { value: "none", label: t("noDue") },
              { value: "fixed", label: t("fixedDate") },
              { value: "after_joining", label: t("afterJoin") },
            ]}
          />
          {kind === "fixed" ? <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("fixedDate")} /> : null}
          {kind === "after_joining" ? <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t("days")} /> : null}
          <Button disabled={pending} onClick={() => start(async () => void ((await updateDueAction(id, kind, date || null, days)).ok ? (toast(t("updated")), setOpen(null)) : toast(tc("errors.invalid"), "error")))}>
            {tc("save")}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={open === "remove"}
        onClose={() => setOpen(null)}
        title={t("removeTitle")}
        size="sm"
        footer={
          <Button variant="danger" disabled={pending} onClick={() => start(async () => void ((await removeAssignmentAction(id)).ok && (toast(t("removed")), setOpen(null))))}>
            {t("remove")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("removeBody")}</p>
      </Dialog>
    </div>
  );
}
