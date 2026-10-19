"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { createAssignmentAction } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Segmented, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Option = { id: string; title: string; meta: string };

export function AssignDialog({
  modules,
  paths,
  departments,
  people,
  preset,
  label,
}: {
  modules: Option[];
  paths: Option[];
  departments: { id: string; name: string }[];
  people: { id: string; name: string }[];
  preset?: { target: "module" | "path"; targetId: string; userIds?: string[] };
  label?: string;
}) {
  const t = useTranslations("admin.assignments");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"module" | "path">(preset?.target ?? "module");
  const [targetId, setTargetId] = useState(preset?.targetId ?? "");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"everyone" | "department" | "user">(preset?.userIds?.length ? "user" : "everyone");
  const [departmentId, setDepartmentId] = useState("");
  const [userId, setUserId] = useState(preset?.userIds?.[0] ?? "");
  const [dueKind, setDueKind] = useState<"none" | "fixed" | "after_joining">("none");
  const [dueDate, setDueDate] = useState("");
  const [dueDays, setDueDays] = useState(30);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const list = useMemo(() => (target === "module" ? modules : paths).filter((m) => !q || m.title.toLocaleLowerCase().includes(q.toLocaleLowerCase())), [target, modules, paths, q]);
  const valid = !!targetId && (scope !== "department" || !!departmentId) && (scope !== "user" || !!userId) && (dueKind !== "fixed" || !!dueDate);

  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        {label ?? t("add")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("dialogTitle")} description={t("dialogBody")} size="lg">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-caption font-semibold">{t("what")}</p>
            <Segmented
              name="target"
              value={target}
              onChange={(x) => {
                setTarget(x as "module" | "path");
                setTargetId("");
              }}
              options={[
                { value: "module", label: t("module") },
                { value: "path", label: t("path") },
              ]}
            />
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchModule")} className="pl-10" aria-label={t("searchModule")} />
            </label>
            <div role="radiogroup" className="grid max-h-60 gap-1 overflow-y-auto rounded-lg border border-line p-1.5">
              {list.map((m) => (
                <label key={m.id} className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body-sm", targetId === m.id ? "bg-brand-50" : "hover:bg-sunken")}>
                  <input type="radio" name="target-id" className="accent-(--brand)" checked={targetId === m.id} onChange={() => setTargetId(m.id)} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
                  <span className="shrink-0 text-tab text-ink-subtle">{m.meta}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-caption font-semibold">{t("who")}</p>
            <Segmented
              name="scope"
              value={scope}
              onChange={(x) => setScope(x as typeof scope)}
              options={[
                { value: "everyone", label: t("everyone") },
                { value: "department", label: t("department") },
                { value: "user", label: t("person") },
              ]}
            />
            {scope === "department" ? (
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label={t("pickDepartment")}>
                <option value="">{t("pickDepartment")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            ) : scope === "user" ? (
              <Select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label={t("pickPerson")}>
                <option value="">{t("pickPerson")}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <div className="grid gap-2">
            <p className="text-caption font-semibold">
              {t("dueDate")} <span className="font-normal text-ink-subtle">· {tc("optional")}</span>
            </p>
            <Segmented
              name="due"
              value={dueKind}
              onChange={(x) => setDueKind(x as typeof dueKind)}
              options={[
                { value: "none", label: t("noDue") },
                { value: "fixed", label: t("fixedDate") },
                { value: "after_joining", label: t("afterJoin") },
              ]}
            />
            {dueKind === "fixed" ? <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t("fixedDate")} className="w-56" /> : null}
            {dueKind === "after_joining" ? (
              <label className="flex items-center gap-2 text-body-sm">
                <Input type="number" min={1} max={365} value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))} className="w-28" />
                {t("days")}
              </label>
            ) : null}
          </div>
          <Field label={t("reason")} htmlFor="a-reason">
            <Input id="a-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={!valid || pending}
              onClick={() =>
                start(async () => {
                  const res = await createAssignmentAction({
                    target,
                    targetId,
                    scope,
                    departmentId: scope === "department" ? departmentId : null,
                    userId: scope === "user" ? userId : null,
                    dueKind,
                    dueDate: dueKind === "fixed" ? dueDate : null,
                    dueDays: dueKind === "after_joining" ? dueDays : null,
                    reason: reason || null,
                  });
                  if (res.ok) {
                    toast(t("assigned", { count: res.count ?? 0 }));
                    setOpen(false);
                  } else toast(tc("errors.invalid"), "error");
                })
              }
            >
              {t("assign")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
