"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSessionAction, reviewFeedbackAction, saveSessionAction, setAttendanceAction, setTicketStatusAction } from "@/server/actions/secops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

/* ───────── live sessions ───────── */

export type SessionDraft = { id: string | null; title: string; description: string; startsAt: string; durationMin: number; location: string; host: string; capacity: number | null };

/** `datetime-local` value in the browser's time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SessionEditor({ initial }: { initial: SessionDraft | null }) {
  const t = useTranslations("secops.sessions");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const fresh = (): SessionDraft => {
    const d = new Date(Date.now() + 7 * 86_400_000);
    d.setHours(11, 0, 0, 0);
    return { id: null, title: "", description: "", startsAt: d.toISOString(), durationMin: 45, location: "", host: "", capacity: null };
  };
  const [f, setF] = useState<SessionDraft>(() => initial ?? fresh());
  const [local, setLocal] = useState(toLocalInput(f.startsAt));
  const valid = f.title.trim().length >= 3 && f.location.trim().length >= 2 && f.host.trim().length >= 2 && !Number.isNaN(new Date(local).getTime());
  return (
    <>
      {initial ? (
        <Button size="icon-sm" variant="ghost" aria-label={tc("edit")} onClick={() => setOpen(true)}>
          <Pencil />
        </Button>
      ) : (
        <Button icon={<Plus />} onClick={() => setOpen(true)}>
          {t("new")}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={initial ? initial.title : t("new")}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || !valid}
              onClick={() =>
                start(async () => {
                  const res = await saveSessionAction({ ...f, startsAt: new Date(local).toISOString() });
                  if (!res.ok) return toast(tc("errors.invalid"), "error");
                  toast(t("saved"));
                  setOpen(false);
                  if (!initial) {
                    const next = fresh();
                    setF(next);
                    setLocal(toLocalInput(next.startsAt));
                  }
                })
              }
            >
              {t("form.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("form.title")} htmlFor="s-title">
            <Input id="s-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} />
          </Field>
          <Field label={t("form.description")} htmlFor="s-desc">
            <Textarea id="s-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("form.startsAt")} htmlFor="s-start">
              <Input id="s-start" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} />
            </Field>
            <Field label={t("form.duration")} htmlFor="s-dur">
              <Input id="s-dur" type="number" min={5} max={480} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) || 45 })} />
            </Field>
            <Field label={t("form.capacity")} htmlFor="s-cap">
              <Input id="s-cap" type="number" min={1} value={f.capacity ?? ""} onChange={(e) => setF({ ...f, capacity: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.location")} htmlFor="s-loc">
              <Input id="s-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={300} />
            </Field>
            <Field label={t("form.host")} htmlFor="s-host">
              <Input id="s-host" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} maxLength={120} />
            </Field>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function DeleteSession({ id }: { id: string }) {
  const t = useTranslations("secops.sessions");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={t("delete")} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("delete")}
        description={t("deleteBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => start(async () => void ((await deleteSessionAction(id)).ok && (toast(t("deleted")), setOpen(false))))}>
              {t("delete")}
            </Button>
          </>
        }
      />
    </>
  );
}

export function AttendanceToggle({ sessionId, userId, attended, label }: { sessionId: string; userId: string; attended: boolean; label: string }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(attended);
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-4 accent-(--brand)"
      checked={on}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        setOn(next);
        start(async () => {
          if (!(await setAttendanceAction(sessionId, userId, next)).ok) setOn(!next);
        });
      }}
    />
  );
}

/* ───────── support desk ───────── */

const TICKET_STATUSES = ["open", "in_progress", "answered", "closed"] as const;

export function TicketStatus({ id, status }: { id: string; status: (typeof TICKET_STATUSES)[number] }) {
  const t = useTranslations("secops.support");
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label={t("setStatus")}
      className="h-10 w-44"
      value={status}
      disabled={pending}
      onChange={(e) => start(async () => void ((await setTicketStatusAction(id, e.target.value)).ok && toast(t("updated"))))}
    >
      {TICKET_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`statuses.${s}`)}
        </option>
      ))}
    </Select>
  );
}

/* ───────── feedback ───────── */

export function ReviewFeedback({ id }: { id: string }) {
  const t = useTranslations("secops.feedback");
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" icon={<Check />} disabled={pending} onClick={() => start(async () => void ((await reviewFeedbackAction(id)).ok && toast(t("reviewed"))))}>
      {t("markReviewed")}
    </Button>
  );
}
