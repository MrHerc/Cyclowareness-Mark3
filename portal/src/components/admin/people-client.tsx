"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { RelativeTime } from "@/components/relative-time";
import { Bell, Building2, FileUp, KeyRound, Link2, Mail, Plus, Search, UserX } from "lucide-react";
import { addPersonAction, createLinkAction, emailInvitesAction, importPeopleAction, moveDepartmentAction, remindPeopleAction, setStatusAction, type ImportPreview, type PersonState } from "@/server/actions/people";
import { remindAwaitingAction } from "@/server/actions/admin-overview";
import { Avatar } from "@/components/ui/avatar";
import { Button, TextButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { SortHeader } from "@/components/ui/layout";
import { ScrollRegion } from "@/components/ui/scroll-region";
import { Pill } from "@/components/ui/pill";
import { SubmitButton } from "@/components/ui/submit-button";
import { toast } from "@/components/ui/toast";
import { riskBand } from "@/lib/domain/risk";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, isLocale } from "@/i18n/config";
import { cn } from "@/lib/cn";

export type PeopleRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  departmentName: string | null;
  riskScore: number;
  /** Formatted on the server in the interface language (browsers have no Azerbaijani number data). */
  xp: string;
  lastActiveAt: string | null;
  awaiting: number;
  avatarUrl: string | null;
};

const ROLES = ["learner", "department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin"] as const;

/** Around a row checkbox: a 44 px hit area on touch screens, pulled back by negative margins so rows keep their height (unchanged with a mouse). */
const CHECK_HIT = "pointer-coarse:-m-3.5 pointer-coarse:inline-flex pointer-coarse:size-11 pointer-coarse:items-center pointer-coarse:justify-center";

export function PeopleFilters({ departments }: { departments: { id: string; name: string }[] }) {
  const t = useTranslations("admin.people");
  const tc = useTranslations("common");
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const push = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`?${next.toString()}`, { scroll: false });
  };
  useEffect(() => {
    const id = setTimeout(() => q !== (sp.get("q") ?? "") && push("q", q), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
      <label className="relative">
        <span className="sr-only">{t("search")}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-10" />
      </label>
      <Select aria-label={tc("department")} value={sp.get("dept") ?? ""} onChange={(e) => push("dept", e.target.value)}>
        <option value="">{tc("allDepartments")}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <Select aria-label={tc("role")} value={sp.get("role") ?? ""} onChange={(e) => push("role", e.target.value)}>
        <option value="">{t("anyRole")}</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {tc(`roles.${r}`)}
          </option>
        ))}
      </Select>
      <Select aria-label={tc("status")} value={sp.get("status") ?? ""} onChange={(e) => push("status", e.target.value)}>
        <option value="">{t("anyStatus")}</option>
        {(["active", "invited", "suspended", "deleted"] as const).map((s) => (
          <option key={s} value={s}>
            {tc(`userStatus.${s}`)}
          </option>
        ))}
      </Select>
      <Select aria-label={tc("risk.score")} value={sp.get("risk") ?? ""} onChange={(e) => push("risk", e.target.value)}>
        <option value="">{t("anyRisk")}</option>
        {(["low", "medium", "high"] as const).map((r) => (
          <option key={r} value={r}>
            {tc(`risk.${r}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function PeopleTable({
  rows,
  canWrite,
  canRemind,
  emailReady,
  departments,
  sortDir,
}: {
  rows: PeopleRow[];
  canWrite: boolean;
  canRemind: boolean;
  /** Settings → Email is on: invitations can be emailed from the bulk bar. */
  emailReady: boolean;
  departments: { id: string; name: string }[];
  sortDir: "asc" | "desc";
}) {
  const t = useTranslations("admin.people");
  const tc = useTranslations("common");
  const to = useTranslations("admin.overview");
  const sp = useSearchParams();
  const sortHref = useMemo(() => {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    if (sortDir === "asc") next.set("dir", "desc");
    else next.delete("dir");
    return `?${next.toString()}`;
  }, [sp, sortDir]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [moveTo, setMoveTo] = useState<string>("");
  // Deleted people cannot be selected or changed.
  const selectable = rows.filter((r) => r.status !== "deleted");
  const all = selectable.length > 0 && selected.size === selectable.length;
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));
  const ids = useMemo(() => [...selected], [selected]);
  const invitedSelected = rows.some((r) => selected.has(r.id) && r.status === "invited");

  const copyLink = (id: string, kind: "invite" | "reset") =>
    start(async () => {
      const res = await createLinkAction(id, kind);
      if (res.ok && res.url) {
        try {
          await navigator.clipboard.writeText(res.url);
          toast(t("linkCopied"));
        } catch {
          window.prompt(t("linkCreated"), res.url);
        }
      }
    });

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-sunken/60 px-4 py-3 text-caption">
        {selected.size ? (
          <>
            <span className="font-semibold">{t("selected", { count: selected.size })}</span>
            <Button size="sm" variant="secondary" icon={<Bell />} disabled={pending} onClick={() => start(async () => toast(to("reminded", { count: (await remindPeopleAction(ids)).count })))}>
              {t("bulkRemind")}
            </Button>
            {canWrite ? (
              <>
                {emailReady && invitedSelected ? (
                  <Button size="sm" variant="secondary" icon={<Mail />} disabled={pending} onClick={() => start(async () => toast(t("invitesSent", { count: (await emailInvitesAction(ids)).count })))}>
                    {t("bulkInvite")}
                  </Button>
                ) : null}
                <span className="flex items-center gap-2">
                  <Select className="h-9 w-48" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label={t("bulkMove")}>
                    <option value="">{t("bulkMove")}…</option>
                    <option value="none">{tc("noDepartment")}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" icon={<Building2 />} disabled={!moveTo || pending} onClick={() => start(async () => void (await moveDepartmentAction(ids, moveTo === "none" ? null : moveTo), setSelected(new Set()), toast(tc("saved"))))}>
                    {tc("apply")}
                  </Button>
                </span>
                <Button size="sm" variant="danger-soft" icon={<UserX />} disabled={pending} onClick={() => start(async () => void (await setStatusAction(ids, "suspended"), setSelected(new Set())))}>
                  {t("bulkSuspend")}
                </Button>
              </>
            ) : null}
          </>
        ) : (
          <>
            <span className="text-ink-muted">{t("bulkHint")}</span>
            {canRemind ? (
              <Button size="sm" variant="secondary" icon={<Bell />} className="ml-auto" disabled={pending} onClick={() => start(async () => toast(to("reminded", { count: (await remindAwaitingAction(null)).count })))}>
                {t("remindWaiting")}
              </Button>
            ) : null}
          </>
        )}
      </div>
      <ScrollRegion label={t("title")}>
        <table className="w-full min-w-[60rem] text-left text-body-sm">
          <thead className="text-tab text-ink-subtle">
            <tr className="border-b border-line">
              <th className="w-10 py-3 pl-4">
                <label className={CHECK_HIT}>
                  <input type="checkbox" aria-label={tc("all")} className="size-4 accent-(--brand)" checked={all} onChange={() => setSelected(all ? new Set() : new Set(selectable.map((r) => r.id)))} />
                </label>
              </th>
              <SortHeader label={t("col.person")} active dir={sortDir} href={sortHref} className="px-3 py-3" />
              <th className="px-3 py-3 font-semibold">{t("col.department")}</th>
              <th className="px-3 py-3 font-semibold">{t("col.role")}</th>
              <th className="px-3 py-3 font-semibold">{t("col.status")}</th>
              <th className="px-3 py-3 font-semibold">{t("col.confirmation")}</th>
              <th className="px-3 py-3 font-semibold">{t("col.risk")}</th>
              <th className="px-3 py-3 font-semibold">{t("col.xp")}</th>
              <th className="px-3 py-3 font-semibold">{t("col.lastActive")}</th>
              {canWrite ? <th className="py-3 pr-4 pl-3 font-semibold">{t("col.actions")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const band = riskBand(r.riskScore);
              const deleted = r.status === "deleted";
              return (
                <tr key={r.id} className={cn("border-b border-line last:border-0 hover:bg-sunken/40", selected.has(r.id) && "bg-brand-50/50")}>
                  <td className="py-3 pl-4">
                    {deleted ? null : (
                      <label className={CHECK_HIT}>
                        <input type="checkbox" aria-label={r.name} className="size-4 accent-(--brand)" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      </label>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {deleted ? (
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{r.name}</span>
                          <span className="block truncate text-tab text-ink-subtle">{r.email}</span>
                        </span>
                      </span>
                    ) : (
                      <Link href={`/admin/users/${r.id}`} className="flex items-center gap-3 pointer-coarse:min-h-11">
                        <Avatar name={r.name} src={r.avatarUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold hover:underline">{r.name}</span>
                          <span className="block truncate text-tab text-ink-subtle">{r.email}</span>
                        </span>
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-3 text-ink-muted">{r.departmentName ?? "—"}</td>
                  <td className="px-3 py-3">{tc(`roles.${r.role as "learner"}`)}</td>
                  <td className="px-3 py-3">
                    <Pill tone={r.status === "active" ? "safe" : r.status === "invited" ? "brand" : "neutral"}>{tc(`userStatus.${r.status as "active"}`)}</Pill>
                  </td>
                  <td className="px-3 py-3">{r.awaiting ? <Pill tone="reward">{t("waiting", { count: r.awaiting })}</Pill> : <span className="text-ink-subtle">—</span>}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                      <span className={cn("size-2 rounded-full", band === "low" ? "bg-safe-500" : band === "medium" ? "bg-warn-500" : "bg-risk-500")} />
                      {r.riskScore}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{r.xp}</td>
                  <td className="px-3 py-3 text-ink-muted">{r.lastActiveAt ? <RelativeTime date={r.lastActiveAt} /> : tc("time.never")}</td>
                  {canWrite ? (
                    <td className="py-3 pr-4 pl-3">
                      {r.status === "invited" ? (
                        <TextButton disabled={pending} onClick={() => copyLink(r.id, "invite")}>
                          <Link2 className="size-3.5" />
                          {t("inviteLink")}
                        </TextButton>
                      ) : r.status === "active" ? (
                        <TextButton tone="muted" disabled={pending} onClick={() => copyLink(r.id, "reset")}>
                          <KeyRound className="size-3.5" />
                          {t("resetLink")}
                        </TextButton>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  );
}

export function AddPerson({ departments, defaultLocale, locales }: { departments: { id: string; name: string }[]; defaultLocale: string; locales: string[] }) {
  const t = useTranslations("admin.people");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PersonState, FormData>(async (prev, data) => {
    // A request that fails outright (network, server) keeps the dialog and what was typed, with a notice.
    const res = await addPersonAction(prev, data).catch((): PersonState => ({ error: "generic" }));
    if (res?.ok) {
      toast(t("added", { name: res.name ?? "" }));
      setOpen(false);
    }
    return res;
  }, undefined);
  const [, startSubmit] = useTransition();
  // Each rejected value is reported on its own field; anything without a field of its own goes in the notice below.
  const fields = state?.fields ?? [];
  const emailError = state?.error === "emailTaken" ? t("emailTaken") : state?.error === "foreignDomain" ? t("foreignDomain") : fields.includes("email") ? tc("errors.email") : null;
  const phoneError = state?.error === "phoneTaken" ? t("phoneTaken") : fields.includes("phone") ? t("invalidPhone") : null;
  const nameError = fields.includes("name") ? tc("errors.invalid") : null;
  const deptError = fields.includes("departmentId") ? t("invalidDepartment") : null;
  const formError = state?.error === "generic" ? tc("errors.generic") : state?.error && !state.ok && !emailError && !phoneError && !nameError && !deptError ? tc("errors.invalid") : null;
  const invalid = (error: unknown, id: string) => (error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {});
  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        {t("add")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("addTitle")} description={t("addBody")}>
        {/* Submitted through a transition rather than the form action, so a rejected form keeps what was typed. */}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startSubmit(() => action(data));
          }}
        >
          {formError ? (
            <p role="alert" className="text-caption text-risk-600">
              {formError}
            </p>
          ) : null}
          <Field label={t("fullName")} htmlFor="p-name" error={nameError}>
            <Input id="p-name" name="name" required minLength={2} maxLength={120} placeholder={t("fullNamePh")} {...invalid(nameError, "p-name")} />
          </Field>
          <Field label={t("workEmail")} htmlFor="p-email" error={emailError}>
            <Input id="p-email" name="email" type="email" required placeholder={t("workEmailPh")} {...invalid(emailError, "p-email")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc("role")} htmlFor="p-role">
              <Select id="p-role" name="role" defaultValue="learner">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tc(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tc("department")} htmlFor="p-dept" error={deptError}>
              <Select id="p-dept" name="departmentId" defaultValue="" {...invalid(deptError, "p-dept")}>
                <option value="">{tc("noDepartment")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("jobTitle")} htmlFor="p-job" optional={tc("optional")}>
              <Input id="p-job" name="jobTitle" maxLength={120} />
            </Field>
            <Field label={t("phone")} htmlFor="p-phone" optional={tc("optional")} error={phoneError}>
              <Input id="p-phone" name="phone" type="tel" placeholder="+994501234567" {...invalid(phoneError, "p-phone")} />
            </Field>
          </div>
          <Field label={t("interfaceLanguage")} htmlFor="p-locale">
            {/* The organisation's default language, offering only the languages it switched on (Settings → Languages). */}
            <Select id="p-locale" name="locale" defaultValue={isLocale(defaultLocale) ? defaultLocale : DEFAULT_LOCALE}>
              {LOCALES.filter((l) => locales.includes(l) || l === defaultLocale).map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton disabled={pending}>{t("add")}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ImportPeople() {
  const t = useTranslations("admin.people");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const step = done !== null ? 3 : preview ? 2 : 1;
  const reset = () => {
    setCsv("");
    setFileName("");
    setPreview(null);
    setDone(null);
  };
  return (
    <>
      <Button variant="secondary" icon={<FileUp />} onClick={() => (reset(), setOpen(true))}>
        {t("import")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("importTitle")} description={t("importBody")} size="lg">
        <ol className="mb-5 flex gap-2 text-caption">
          {(["upload", "review", "done"] as const).map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2 rounded-pill px-3 py-1.5 font-semibold", step === i + 1 ? "bg-brand-600 text-brand-on" : step > i + 1 ? "bg-safe-50 text-safe-700" : "bg-sunken text-ink-muted")}>
              <span>{i + 1}</span>
              {t(`importSteps.${s}`)}
            </li>
          ))}
        </ol>
        {step === 1 ? (
          <div className="grid gap-4">
            <p className="text-caption text-ink-muted">
              {t("importColumns")} ·{" "}
              <a href="/api/admin/people/template" download className="font-semibold text-brand-600 underline">
                {t("importTemplate")}
              </a>
            </p>
            <label className="grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line-strong px-6 py-10 text-center hover:bg-sunken">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setFileName(f.name);
                  setCsv(await f.text());
                }}
              />
              <FileUp className="size-8 text-brand-600" />
              <span className="mt-2 text-body-sm font-semibold">{fileName || t("import")}</span>
            </label>
            <div className="flex justify-end">
              <Button disabled={!csv || pending} onClick={() => start(async () => setPreview(await importPeopleAction(csv, false)))}>
                {t("checkFile")}
              </Button>
            </div>
          </div>
        ) : step === 2 && preview ? (
          <div className="grid gap-4">
            {preview.error === "tooMany" ? <p className="text-body-sm text-risk-600">{t("importErrors.tooMany")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Pill tone="safe">{t("importRows", { count: preview.rows - new Set(preview.problems.map((p) => p.line)).size })}</Pill>
              {preview.problems.length ? <Pill tone="risk">{t("importProblems", { count: preview.problems.length })}</Pill> : null}
            </div>
            {preview.newDepartments.length ? (
              <p className="text-caption text-ink-muted">{t("importNewDepartments", { count: preview.newDepartments.length, names: preview.newDepartments.join(", ") })}</p>
            ) : null}
            {preview.problems.length ? (
              <ScrollRegion axis="y" label={t("importProblems", { count: preview.problems.length })} className="max-h-60 rounded-lg bg-risk-50 p-3 text-caption text-risk-700">
                <ul>
                  {preview.problems.map((p, i) => (
                    <li key={i}>{t("importLine", { line: p.line, problem: t(`importErrors.${p.problem as "name"}`) })}</li>
                  ))}
                </ul>
              </ScrollRegion>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={reset}>
                {tc("back")}
              </Button>
              <Button
                disabled={!preview.ok || pending}
                onClick={() =>
                  start(async () => {
                    const res = await importPeopleAction(csv, true);
                    if (res.ok) {
                      setDone(res.imported ?? 0);
                      router.refresh();
                    } else setPreview(res);
                  })
                }
              >
                {t("importConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center gap-4 py-6 text-center">
            <p className="text-title font-bold">{t("imported", { count: done ?? 0 })}</p>
            <Button onClick={() => setOpen(false)}>{tc("done")}</Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
