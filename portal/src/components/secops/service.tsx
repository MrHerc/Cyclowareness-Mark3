"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useOrgTimeZone } from "@/lib/client-format";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSessionAction, reviewFeedbackAction, saveSessionAction, setAttendanceAction, setTicketStatusAction } from "@/server/actions/secops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useAction } from "@/components/ui/use-action";
import { fromZonedLocalInput, fromZonedParts, toZonedLocalInput, zonedParts } from "@/lib/baku-clock";

/* ───────── live sessions ───────── */

export type SessionDraft = { id: string | null; title: string; description: string; startsAt: string; durationMin: number; location: string; host: string; capacity: number | null };

export function SessionEditor({ initial }: { initial: SessionDraft | null }) {
  const t = useTranslations("secops.sessions");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  // The start is entered in the organisation's time zone, the one sessions are listed in, not the
  // browser's: a new one defaults to 11:00 there a week from now.
  const timeZone = useOrgTimeZone();
  const fresh = (): SessionDraft => {
    const startsAt = fromZonedParts(zonedParts(Date.now() + 7 * 86_400_000, timeZone).date, "11:00", timeZone)!;
    return { id: null, title: "", description: "", startsAt: startsAt.toISOString(), durationMin: 45, location: "", host: "", capacity: null };
  };
  const [f, setF] = useState<SessionDraft>(() => initial ?? fresh());
  const [local, setLocal] = useState(() => toZonedLocalInput(f.startsAt, timeZone));
  const startsAt = fromZonedLocalInput(local, timeZone);
  // Number inputs are kept as typed, so an out-of-range value is shown and explained instead of silently replaced.
  const [dur, setDur] = useState(String(f.durationMin));
  const [cap, setCap] = useState(f.capacity === null ? "" : String(f.capacity));
  /** Field the server refused (it validates the same rules), until that field is edited. */
  const [serverField, setServerField] = useState<string | null>(null);
  const durationMin = Number(dur);
  const capacity = cap.trim() === "" ? null : Number(cap);
  const durationError = !(dur.trim() !== "" && Number.isInteger(durationMin) && durationMin >= 5 && durationMin <= 480) || serverField === "durationMin" ? t("form.durationRange") : null;
  const capacityError = (capacity !== null && !(Number.isInteger(capacity) && capacity >= 1 && capacity <= 100_000)) || serverField === "capacity" ? t("form.capacityRange") : null;
  const fieldError = (name: string) => (serverField === name ? t("form.fieldInvalid") : null);
  const invalid = (error: string | null, id: string) => (error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});
  const edit = (name: string) => {
    if (serverField === name) setServerField(null);
  };
  const valid = f.title.trim().length >= 3 && f.location.trim().length >= 2 && f.host.trim().length >= 2 && !!startsAt && !durationError && !capacityError;
  const { run, pending } = useAction(saveSessionAction, {
    successToast: t("saved"),
    onSuccess: () => {
      setOpen(false);
      setServerField(null);
      if (!initial) {
        const next = fresh();
        setF(next);
        setLocal(toZonedLocalInput(next.startsAt, timeZone));
        setDur(String(next.durationMin));
        setCap("");
      }
    },
    // The refused field is marked until it is edited.
    errorMap: (res) => {
      setServerField(res.field ?? null);
      return tc("errors.invalid");
    },
  });
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
              onClick={() => run({ ...f, durationMin, capacity, startsAt: startsAt!.toISOString() })}
            >
              {t("form.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("form.title")} htmlFor="s-title" error={fieldError("title")}>
            <Input id="s-title" value={f.title} onChange={(e) => { edit("title"); setF({ ...f, title: e.target.value }); }} maxLength={200} {...invalid(fieldError("title"), "s-title")} />
          </Field>
          <Field label={t("form.description")} htmlFor="s-desc" error={fieldError("description")}>
            <Textarea id="s-desc" value={f.description} onChange={(e) => { edit("description"); setF({ ...f, description: e.target.value }); }} maxLength={2000} {...invalid(fieldError("description"), "s-desc")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("form.startsAt")} htmlFor="s-start" hint={tc("time.zone", { zone: timeZone })} error={fieldError("startsAt")}>
              <Input id="s-start" type="datetime-local" value={local} onChange={(e) => { edit("startsAt"); setLocal(e.target.value); }} aria-describedby="s-start-hint" {...invalid(fieldError("startsAt"), "s-start")} />
            </Field>
            <Field label={t("form.duration")} htmlFor="s-dur" error={durationError}>
              <Input id="s-dur" type="number" min={5} max={480} step={1} value={dur} onChange={(e) => { edit("durationMin"); setDur(e.target.value); }} {...invalid(durationError, "s-dur")} />
            </Field>
            <Field label={t("form.capacity")} htmlFor="s-cap" error={capacityError}>
              <Input id="s-cap" type="number" min={1} max={100_000} step={1} value={cap} onChange={(e) => { edit("capacity"); setCap(e.target.value); }} {...invalid(capacityError, "s-cap")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.location")} htmlFor="s-loc" error={fieldError("location")}>
              <Input id="s-loc" value={f.location} onChange={(e) => { edit("location"); setF({ ...f, location: e.target.value }); }} maxLength={300} {...invalid(fieldError("location"), "s-loc")} />
            </Field>
            <Field label={t("form.host")} htmlFor="s-host" error={fieldError("host")}>
              <Input id="s-host" dir="ltr" value={f.host} onChange={(e) => { edit("host"); setF({ ...f, host: e.target.value }); }} maxLength={120} {...invalid(fieldError("host"), "s-host")} />
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
  const { run, pending } = useAction(deleteSessionAction, { successToast: t("deleted"), onSuccess: () => setOpen(false) });
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
            <Button variant="danger" disabled={pending} onClick={() => run(id)}>
              {t("delete")}
            </Button>
          </>
        }
      />
    </>
  );
}

export function AttendanceToggle({ sessionId, userId, attended, label }: { sessionId: string; userId: string; attended: boolean; label: string }) {
  const [on, setOn] = useState(attended);
  // The box shows the change at once and goes back if it is not saved; a retry from the toast sets it again.
  const { run, pending } = useAction(async (next: boolean) => {
    try {
      const res = await setAttendanceAction(sessionId, userId, next);
      setOn(res.ok ? next : !next);
      return res;
    } catch (error) {
      setOn(!next);
      throw error;
    }
  });
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
        run(next);
      }}
    />
  );
}

/* ───────── support desk ───────── */

const TICKET_STATUSES = ["open", "in_progress", "answered", "closed"] as const;

export function TicketStatus({ id, status }: { id: string; status: (typeof TICKET_STATUSES)[number] }) {
  const t = useTranslations("secops.support");
  const { run, pending } = useAction(setTicketStatusAction, { successToast: t("updated") });
  return (
    <Select
      aria-label={t("setStatus")}
      className="h-10 w-44"
      value={status}
      disabled={pending}
      onChange={(e) => run(id, e.target.value)}
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
  const { run, pending } = useAction(reviewFeedbackAction, { successToast: t("reviewed") });
  return (
    <Button size="sm" variant="ghost" icon={<Check />} disabled={pending} onClick={() => run(id)}>
      {t("markReviewed")}
    </Button>
  );
}
