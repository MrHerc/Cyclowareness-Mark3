"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useClientFormat, useOrgTimeZone } from "@/lib/client-format";
import { parseDay } from "@/lib/day";
import { CalendarClock, FileDown, Plus, Trash2 } from "lucide-react";
import { removeScheduleAction, saveScheduleAction } from "@/server/actions/reports";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

/** A period the reports can apply: each date empty or an existing day, the start not after the end. */
const validPeriod = (from: string, to: string) => (!from || !!parseDay(from)) && (!to || !!parseDay(to)) && !(from && to && from > to);

/**
 * Shared filter for the report cards. `value` is what the page applied to the downloads (the last 30 days
 * while the URL carries no dates; empty where a value was ignored), so the form always shows the period
 * the links use. Dates are written to the URL together, an empty one meaning "no bound"; a period the
 * reports cannot apply (a start after the end, or a year still being typed) is flagged here, not applied.
 */
export function ReportFilters({ departments, value }: { departments: { id: string; name: string }[]; value: { from: string; to: string; d: string } }) {
  const t = useTranslations("admin.reports");
  const tc = useTranslations("common");
  const router = useRouter();
  const sp = useSearchParams();
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const [dept, setDept] = useState(value.d);
  // Follow the server whenever it applies something else (a navigation, or values it had to ignore).
  const [applied, setApplied] = useState(value);
  if (applied.from !== value.from || applied.to !== value.to || applied.d !== value.d) {
    setApplied(value);
    setFrom(value.from);
    setTo(value.to);
    setDept(value.d);
  }
  const invalid = !validPeriod(from, to);
  const go = (q: URLSearchParams) => router.replace(`?${q.toString()}`, { scroll: false });
  const setDates = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    if (!validPeriod(nextFrom, nextTo)) return;
    const q = new URLSearchParams(sp.toString());
    q.set("from", nextFrom);
    q.set("to", nextTo);
    go(q);
  };
  const setDepartment = (next: string) => {
    setDept(next);
    const q = new URLSearchParams(sp.toString());
    if (next) q.set("d", next);
    else q.delete("d");
    go(q);
  };
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs">
      <label className="grid gap-1 text-caption font-semibold">
        {tc("from")}
        <Input type="date" className="w-44" value={from} max={to || undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? "report-range-error" : undefined} onChange={(e) => setDates(e.target.value, to)} />
      </label>
      <label className="grid gap-1 text-caption font-semibold">
        {tc("to")}
        <Input type="date" className="w-44" value={to} min={from || undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? "report-range-error" : undefined} onChange={(e) => setDates(from, e.target.value)} />
      </label>
      <label className="grid gap-1 text-caption font-semibold">
        {tc("department")}
        <Select className="w-56" value={dept} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">{t("allDepartments")}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </label>
      {invalid ? (
        <p id="report-range-error" role="alert" className="basis-full text-caption font-semibold text-risk-600">
          {t("rangeInvalid")}
        </p>
      ) : null}
    </div>
  );
}

/** The compliance pack has its own period, independent of the shared filter; an invalid one cannot be generated. */
export function CompliancePack({ defaults }: { defaults: { from: string; to: string } }) {
  const t = useTranslations("admin.reports");
  const tc = useTranslations("common");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const invalid = !validPeriod(from, to);
  const q = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-caption font-semibold">
        {tc("from")}
        <Input type="date" className="w-40" value={from} max={to || undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? "compliance-range-error" : undefined} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label className="grid gap-1 text-caption font-semibold">
        {tc("to")}
        <Input type="date" className="w-40" value={to} min={from || undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? "compliance-range-error" : undefined} onChange={(e) => setTo(e.target.value)} />
      </label>
      {invalid ? (
        <Button size="sm" icon={<FileDown />} disabled>
          {t("generate")}
        </Button>
      ) : (
        <ButtonLink size="sm" icon={<FileDown />} href={`/print/compliance${q ? `?${q}` : ""}`} target="_blank">
          {t("generate")}
        </ButtonLink>
      )}
      {invalid ? (
        <p id="compliance-range-error" role="alert" className="basis-full text-caption font-semibold text-risk-600">
          {t("rangeInvalid")}
        </p>
      ) : null}
    </div>
  );
}

export function Schedules({
  schedules,
  kinds,
  departments,
}: {
  schedules: { id: string; kind: string; format: string; frequency: string; day: number; recipients: string[]; lastSentAt: string | null }[];
  kinds: { key: string; title: string }[];
  departments: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.reports");
  const tc = useTranslations("common");
  const format = useClientFormat();
  const timeZone = useOrgTimeZone();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(kinds[0]?.key ?? "completion");
  const [fmt, setFmt] = useState("xlsx");
  const [freq, setFreq] = useState("weekly");
  const [day, setDay] = useState(1);
  const [recipients, setRecipients] = useState("");
  const [dept, setDept] = useState("");
  const [pending, start] = useTransition();
  const title = (k: string) => kinds.find((x) => x.key === k)?.title ?? k;
  // Weekly: weekday 1–7 (Monday first). Monthly: day of the month 1–28, so every month has it.
  const dayLabel = (frequency: string, d: number) => (frequency === "weekly" ? t(`weekdays.${d as 1}`) : t("dayOfMonth", { day: d }));
  const dayOptions = freq === "weekly" ? [1, 2, 3, 4, 5, 6, 7] : Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <div className="grid gap-3">
      {schedules.length ? (
        <ul className="grid gap-2">
          {schedules.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
              <CalendarClock className="size-5 text-brand-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold">
                  {title(s.kind)} · {s.format.toUpperCase()} · {s.frequency === "weekly" ? t("weekly") : t("monthly")} · {dayLabel(s.frequency, s.day)}
                </span>
                <span className="block text-tab text-ink-subtle">
                  {s.recipients.join(", ")} · {s.lastSentAt ? t("lastSent", { date: format.dateTime(new Date(s.lastSentAt), { dateStyle: "medium" }) }) : t("never")}
                </span>
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-risk-600"
                aria-label={tc("remove")}
                onClick={() =>
                  start(async () => {
                    const res = await removeScheduleAction(s.id);
                    toast(res.ok ? t("scheduleRemoved") : tc("errors.generic"), res.ok ? "success" : "error");
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-ink-muted">{t("noSchedules")}</p>
      )}
      <div>
        <Button variant="secondary" icon={<Plus />} onClick={() => setOpen(true)}>
          {t("addSchedule")}
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("addSchedule")} size="sm">
        <div className="grid gap-4">
          <Field label={t("report")} htmlFor="s-kind">
            <Select id="s-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("format")} htmlFor="s-fmt">
              <Select id="s-fmt" value={fmt} onChange={(e) => setFmt(e.target.value)}>
                <option value="xlsx">Excel</option>
                <option value="csv">CSV</option>
              </Select>
            </Field>
            <Field label={t("frequency")} htmlFor="s-freq">
              <Select
                id="s-freq"
                value={freq}
                onChange={(e) => {
                  setFreq(e.target.value);
                  setDay(1);
                }}
              >
                <option value="weekly">{t("weekly")}</option>
                <option value="monthly">{t("monthly")}</option>
              </Select>
            </Field>
          </div>
          <Field label={t("day")} htmlFor="s-day">
            <Select id="s-day" value={String(day)} onChange={(e) => setDay(Number(e.target.value))}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(freq, d)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tc("department")} htmlFor="s-dept">
            <Select id="s-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">{t("allDepartments")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("recipients")} htmlFor="s-to" hint={t("recipientsHint")}>
            <Input id="s-to" dir="ltr" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="ciso@example.az, hr@example.az" />
          </Field>
          <p className="text-caption text-ink-muted">{t("scheduleHint", { zone: timeZone })}</p>
          <Button
            disabled={!recipients.trim() || pending}
            onClick={() =>
              start(async () => {
                const res = await saveScheduleAction({ kind, format: fmt, frequency: freq, day, recipients, departmentId: dept || null });
                if (res.ok) {
                  toast(t("scheduleSaved"));
                  setOpen(false);
                  setRecipients("");
                } else toast(tc("errors.invalid"), "error");
              })
            }
          >
            {tc("save")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
