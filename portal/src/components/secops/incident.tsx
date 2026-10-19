"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Copy, GraduationCap, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { assignIncidentTrainingAction, createIncidentAction, setIncidentTrainingAction, updateIncidentAction } from "@/server/actions/secops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const SOURCES = ["analyst", "report", "sandbox", "siem", "intel"] as const;

type Option = { id: string; label: string };
type PersonOption = { id: string; name: string; email: string; department: string | null };

export function NewIncident({
  modules,
  departments,
  people,
  prefill,
  label,
  defaultOpen = false,
}: {
  modules: Option[];
  departments: Option[];
  people: PersonOption[];
  prefill?: { title?: string; severity?: (typeof SEVERITIES)[number]; source?: (typeof SOURCES)[number]; iocs?: string; mitre?: string; sandboxId?: string; description?: string };
  label?: string;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("secops.incidents");
  const ts = useTranslations("secops");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    severity: prefill?.severity ?? ("medium" as (typeof SEVERITIES)[number]),
    source: prefill?.source ?? ("analyst" as (typeof SOURCES)[number]),
    confidential: false,
    live: false,
    iocs: prefill?.iocs ?? "",
    mitre: prefill?.mitre ?? "",
    assignNow: true,
  });
  const [train, setTrain] = useState<TrainingValue>(emptyTraining());
  const submit = () =>
    start(async () => {
      const res = await createIncidentAction({
        title: f.title,
        description: f.description,
        severity: f.severity,
        source: f.source,
        confidential: f.confidential,
        live: f.live,
        iocs: f.iocs,
        mitre: f.mitre,
        ...trainingInput(train),
        sandboxId: prefill?.sandboxId ?? null,
        assignNow: f.assignNow,
      });
      if (!res.ok) return toast(tc("errors.invalid"), "error");
      toast(t("created", { number: res.number! }));
      setOpen(false);
      router.push(`/admin/incidents/${res.id}`);
    });
  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        {label ?? t("new")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("new")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={submit} disabled={pending || f.title.trim().length < 3}>
              {t("create")}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <Field label={t("title")} htmlFor="inc-title">
            <Input id="inc-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={300} />
          </Field>
          <Field label={t("description")} htmlFor="inc-desc">
            <Textarea id="inc-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={8000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("severity")} htmlFor="inc-sev">
              <Select id="inc-sev" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as typeof f.severity })}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {tc(`severity.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("source")} htmlFor="inc-src">
              <Select id="inc-src" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as typeof f.source })}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {ts(`sources.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Switch label={t("confidential")} description={t("confidentialHint")} checked={f.confidential} onChange={(e) => setF({ ...f, confidential: e.target.checked })} />
            <Switch label={t("live")} description={t("liveHint")} checked={f.live} onChange={(e) => setF({ ...f, live: e.target.checked })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("iocs")} htmlFor="inc-iocs" hint={t("iocsHint")}>
              <Textarea id="inc-iocs" value={f.iocs} onChange={(e) => setF({ ...f, iocs: e.target.value })} className="min-h-28 font-mono text-caption" spellCheck={false} />
            </Field>
            <Field label={t("mitre")} htmlFor="inc-mitre" hint={t("mitreHint")}>
              <Input id="inc-mitre" value={f.mitre} onChange={(e) => setF({ ...f, mitre: e.target.value })} className="font-mono" />
            </Field>
          </div>

          <fieldset className="grid gap-4 rounded-xl border border-line p-4">
            <legend className="px-1 text-body-sm font-semibold">{t("training")}</legend>
            <TrainingFields value={train} onChange={setTrain} modules={modules} departments={departments} people={people} />
            {train.moduleId ? <Checkbox label={t("autoTraining")} checked={f.assignNow} onChange={(e) => setF({ ...f, assignNow: e.target.checked })} /> : null}
          </fieldset>
        </div>
      </Dialog>
    </>
  );
}

type TrainingValue = { moduleId: string; minScore: string; dueDate: string; departmentId: string; userIds: Set<string> };

function emptyTraining(): TrainingValue {
  return { moduleId: "", minScore: "70", dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), departmentId: "", userIds: new Set() };
}

function trainingInput(v: TrainingValue) {
  return {
    moduleId: v.moduleId || null,
    minScore: v.moduleId && v.minScore ? Math.max(0, Math.min(100, Number(v.minScore) || 0)) : null,
    dueDate: v.moduleId ? v.dueDate || null : null,
    departmentId: v.moduleId ? v.departmentId || null : null,
    userIds: v.moduleId ? [...v.userIds] : [],
  };
}

/** Lesson, pass mark, due date and the people who need it (by department and/or by name). */
function TrainingFields({ value, onChange, modules, departments, people }: { value: TrainingValue; onChange: (v: TrainingValue) => void; modules: Option[]; departments: Option[]; people: PersonOption[] }) {
  const t = useTranslations("secops.incidents");
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) => p.name.toLocaleLowerCase().includes(q) || p.email.includes(q)).slice(0, 8);
  }, [query, people]);
  const toggle = (id: string) => {
    const next = new Set(value.userIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, userIds: next });
  };
  const selected = people.filter((p) => value.userIds.has(p.id));
  return (
    <div className="grid gap-4">
      <Field label={t("module")} htmlFor="tr-mod">
        <Select id="tr-mod" value={value.moduleId} onChange={(e) => onChange({ ...value, moduleId: e.target.value })}>
          <option value="">{t("noModule")}</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      {value.moduleId ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("minScore")} htmlFor="tr-min">
              <Input id="tr-min" type="number" min={0} max={100} value={value.minScore} onChange={(e) => onChange({ ...value, minScore: e.target.value })} />
            </Field>
            <Field label={t("due")} htmlFor="tr-due">
              <Input id="tr-due" type="date" value={value.dueDate} onChange={(e) => onChange({ ...value, dueDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3">
            <p className="text-caption font-semibold">
              {t("targets")} <span className="font-normal text-ink-subtle">· {t("targetsHint")}</span>
            </p>
            <Field label={t("department")} htmlFor="tr-dept">
              <Select id="tr-dept" value={value.departmentId} onChange={(e) => onChange({ ...value, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("people")} htmlFor="tr-people">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
                <Input id="tr-people" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("pickPeople")} className="pl-9" autoComplete="off" />
              </div>
            </Field>
            {matches.length ? (
              <ul className="grid gap-1 rounded-lg border border-line p-1">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => toggle(p.id)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-caption hover:bg-sunken", value.userIds.has(p.id) && "bg-brand-50")}>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{p.name}</b>
                        <span className="block truncate text-ink-subtle">
                          {p.email}
                          {p.department ? ` · ${p.department}` : ""}
                        </span>
                      </span>
                      {value.userIds.has(p.id) ? <CheckCircle2 className="size-4 text-brand-600" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected.length ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-tab text-ink-muted">{t("selected", { count: selected.length })}:</span>
                {selected.map((p) => (
                  <button key={p.id} type="button" onClick={() => toggle(p.id)} className="rounded-pill bg-brand-50 px-2.5 py-1 text-tab font-semibold text-brand-700 hover:bg-brand-100">
                    {p.name} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function IncidentTrainingEditor({
  id,
  initial,
  modules,
  departments,
  people,
}: {
  id: string;
  initial: { moduleId: string | null; minScore: number | null; dueDate: string | null; userIds: string[] };
  modules: Option[];
  departments: Option[];
  people: PersonOption[];
}) {
  const t = useTranslations("secops.incidents");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [train, setTrain] = useState<TrainingValue>({
    ...emptyTraining(),
    moduleId: initial.moduleId ?? "",
    minScore: initial.minScore === null ? "70" : String(initial.minScore),
    dueDate: initial.dueDate ?? emptyTraining().dueDate,
    userIds: new Set(initial.userIds),
  });
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setOpen(true)}>
        {t("editTraining")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("training")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await setIncidentTrainingAction(id, trainingInput(train));
                  if (!res.ok) return toast(tc("errors.invalid"), "error");
                  toast(t("saved"));
                  setOpen(false);
                })
              }
            >
              {tc("save")}
            </Button>
          </>
        }
      >
        <TrainingFields value={train} onChange={setTrain} modules={modules} departments={departments} people={people} />
      </Dialog>
    </>
  );
}

export function IncidentControls({ id, status, live, canAssign }: { id: string; status: "open" | "investigating" | "resolved"; live: boolean; canAssign: boolean }) {
  const t = useTranslations("secops.incidents");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const update = (input: Parameters<typeof updateIncidentAction>[1]) => start(async () => void ((await updateIncidentAction(id, input)).ok ? toast(t("saved")) : toast(tc("errors.generic"), "error")));
  return (
    <div className="flex flex-wrap gap-2">
      {canAssign ? (
        <Button
          icon={<GraduationCap />}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await assignIncidentTrainingAction(id);
              if (!res.ok) return toast(tc("errors.generic"), "error");
              toast(t("assigned", { count: res.count ?? 0 }));
            })
          }
        >
          {t("assignNow")}
        </Button>
      ) : null}
      {status === "open" ? (
        <Button variant="secondary" disabled={pending} onClick={() => update({ status: "investigating" })}>
          {t("investigate")}
        </Button>
      ) : null}
      {status !== "resolved" ? (
        <Button variant="safe" icon={<CheckCircle2 />} disabled={pending} onClick={() => update({ status: "resolved" })}>
          {t("resolve")}
        </Button>
      ) : (
        <Button variant="secondary" icon={<RotateCcw />} disabled={pending} onClick={() => update({ status: "open" })}>
          {t("reopen")}
        </Button>
      )}
      {status !== "resolved" ? (
        <Button variant="ghost" disabled={pending} onClick={() => update({ live: !live })}>
          {t("live")}: {live ? tc("on") : tc("off")}
        </Button>
      ) : null}
    </div>
  );
}

export function CopyText({ text, label }: { text: string; label: string }) {
  const tc = useTranslations("common");
  return (
    <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => navigator.clipboard.writeText(text).then(() => toast(tc("copied")))}>
      {label}
    </Button>
  );
}
