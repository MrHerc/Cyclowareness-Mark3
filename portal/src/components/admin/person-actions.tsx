"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, KeyRound, Link2, Pencil, ShieldCheck, ShieldOff, Trash2, Unlink, UserCheck, UserX } from "lucide-react";
import { changeRoleAction, createLinkAction, deletePersonAction, moveDepartmentAction, resetTwoFactorAction, setStatusAction, unlinkSsoAction, updatePersonAction } from "@/server/actions/people";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";

const ROLES = ["learner", "department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin"] as const;

export function PersonActions({
  person,
  departments,
  locales,
  isSelf,
}: {
  person: { id: string; name: string; jobTitle: string | null; phone: string | null; locale: string; role: string; status: string; departmentId: string | null; totpEnabled: boolean; ssoLinked: boolean };
  departments: { id: string; name: string }[];
  /** The organisation's available languages (Settings → Languages). */
  locales: string[];
  isSelf: boolean;
}) {
  const t = useTranslations("admin.person");
  const tp = useTranslations("admin.people");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState<null | "edit" | "role" | "move" | "twofa">(null);
  const [pending, start] = useTransition();
  const [name, setName] = useState(person.name);
  const [jobTitle, setJobTitle] = useState(person.jobTitle ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [locale, setLocale] = useState(person.locale);
  const [role, setRole] = useState(person.role);
  const [dept, setDept] = useState(person.departmentId ?? "");
  // A rejected phone is reported on its own field (taken by another account, or not a usable number).
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const done = (msg = t("saved")) => {
    toast(msg);
    setOpen(null);
    router.refresh();
  };
  const copy = (kind: "invite" | "reset") =>
    start(async () => {
      const res = await createLinkAction(person.id, kind);
      if (res.ok && res.url) {
        try {
          await navigator.clipboard.writeText(res.url);
          toast(tp("linkCopied"));
        } catch {
          window.prompt(tp("linkCreated"), res.url);
        }
      }
    });

  return (
    <div className="contents">
      <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setOpen("edit")}>
        {t("edit")}
      </Button>
      {person.status === "invited" ? (
        <Button size="sm" variant="secondary" icon={<Link2 />} disabled={pending} onClick={() => copy("invite")}>
          {tp("inviteLink")}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" icon={<KeyRound />} disabled={pending} onClick={() => copy("reset")}>
          {t("resetLink")}
        </Button>
      )}
      {!isSelf ? (
        <Button size="sm" variant="secondary" icon={<ShieldCheck />} onClick={() => setOpen("role")}>
          {t("changeRole")}
        </Button>
      ) : null}
      <Button size="sm" variant="secondary" icon={<Building2 />} onClick={() => setOpen("move")}>
        {t("moveDepartment")}
      </Button>
      {!isSelf && person.totpEnabled ? (
        <Button size="sm" variant="secondary" icon={<ShieldOff />} onClick={() => setOpen("twofa")}>
          {t("resetTwoFactor")}
        </Button>
      ) : null}
      {person.ssoLinked ? (
        <Button size="sm" variant="secondary" icon={<Unlink />} disabled={pending} onClick={() => start(async () => void ((await unlinkSsoAction(person.id)).ok ? done(t("ssoUnlinked")) : toast(tc("errors.forbidden"), "error")))}>
          {t("unlinkSso")}
        </Button>
      ) : null}
      {!isSelf ? (
        person.status === "suspended" ? (
          <Button size="sm" variant="secondary" icon={<UserCheck />} disabled={pending} onClick={() => start(async () => void ((await setStatusAction([person.id], "active")).ok && done(t("reactivated"))))}>
            {t("reactivate")}
          </Button>
        ) : (
          <Button size="sm" variant="danger-soft" icon={<UserX />} disabled={pending} onClick={() => start(async () => void ((await setStatusAction([person.id], "suspended")).ok && done(t("suspended"))))}>
            {t("suspend")}
          </Button>
        )
      ) : null}

      <Dialog open={open === "edit"} onClose={() => setOpen(null)} title={t("edit")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updatePersonAction(person.id, { name, jobTitle, phone, locale: locale as "az" });
              const phoneProblem = res.error === "phoneTaken" ? tp("phoneTaken") : res.error === "cannotAdd" ? tp("cannotAdd") : res.fields?.includes("phone") ? tp("invalidPhone") : null;
              setPhoneError(res.ok ? null : phoneProblem);
              if (res.ok) done();
              else if (!phoneProblem || (res.fields?.length ?? 0) > 1) toast(res.error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.invalid"), "error");
            });
          }}
        >
          <Field label={tp("fullName")} htmlFor="e-name">
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Field label={tp("jobTitle")} htmlFor="e-job">
            <Input id="e-job" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
          <Field label={tp("phone")} htmlFor="e-phone" error={phoneError}>
            <Input
              id="e-phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(null);
              }}
              placeholder="+994501234567"
              {...(phoneError ? { "aria-invalid": true, "aria-describedby": "e-phone-error" } : {})}
            />
          </Field>
          <Field label={tp("interfaceLanguage")} htmlFor="e-locale">
            <Select id="e-locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {/* The person's current language stays listed even if the organisation has since switched it off. */}
              {LOCALES.filter((l) => locales.includes(l) || l === person.locale).map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={pending}>
            {tc("save")}
          </Button>
        </form>
      </Dialog>

      <Dialog open={open === "role"} onClose={() => setOpen(null)} title={t("changeRole")} size="sm">
        <div className="grid gap-4">
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label={tc("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tc(`roles.${r}`)}
              </option>
            ))}
          </Select>
          <Button disabled={pending || role === person.role} onClick={() => start(async () => void ((await changeRoleAction(person.id, role as "learner")).ok ? done() : toast(tc("errors.forbidden"), "error")))}>
            {tc("save")}
          </Button>
        </div>
      </Dialog>

      <Dialog open={open === "move"} onClose={() => setOpen(null)} title={t("moveDepartment")} size="sm">
        <div className="grid gap-4">
          <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label={tc("department")}>
            <option value="">{tc("noDepartment")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Button disabled={pending} onClick={() => start(async () => void ((await moveDepartmentAction([person.id], dept || null)).ok && done()))}>
            {tc("save")}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={open === "twofa"}
        onClose={() => setOpen(null)}
        title={t("resetTwoFactorTitle", { name: person.name })}
        size="sm"
        footer={
          <Button variant="danger" disabled={pending} onClick={() => start(async () => void ((await resetTwoFactorAction(person.id)).ok ? done(t("twoFactorReset")) : toast(tc("errors.forbidden"), "error")))}>
            {t("resetTwoFactor")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("resetTwoFactorBody")}</p>
      </Dialog>
    </div>
  );
}

/** "Delete person" sits on its own below the profile, apart from the header actions. */
export function DeletePersonButton({ person, isSelf }: { person: { id: string; name: string }; isSelf: boolean }) {
  const t = useTranslations("admin.person");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (isSelf) return null;

  return (
    <>
      <Button size="sm" variant="ghost" className="text-risk-600" icon={<Trash2 />} onClick={() => setOpen(true)}>
        {t("delete")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("deleteTitle", { name: person.name })}
        size="sm"
        footer={
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if ((await deletePersonAction(person.id)).ok) router.push("/admin/users");
              })
            }
          >
            {t("delete")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("deleteBody")}</p>
      </Dialog>
    </>
  );
}
