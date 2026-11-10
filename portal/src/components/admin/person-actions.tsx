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
import { CreatedLinkDialog, copyOrShow } from "@/components/admin/created-link";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";

const ROLES = ["learner", "department_head", "executive", "analyst", "campaign_manager", "content_creator", "tenant_admin"] as const;

/** The actor's own password before an action that can take over an account (the server's step-up). */
export function ConfirmPasswordField({ id, value, onChange, error, autoFocus = true }: { id: string; value: string; onChange: (v: string) => void; error: string | null; autoFocus?: boolean }) {
  const t = useTranslations("admin.person");
  return (
    <Field label={t("confirmPassword")} htmlFor={id} hint={t("confirmPasswordHint")} error={error}>
      <Input id={id} type="password" autoComplete="current-password" value={value} onChange={(e) => onChange(e.target.value)} required autoFocus={autoFocus} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : `${id}-hint`} />
    </Field>
  );
}

/** The step-up refusal as the actor reads it; null for any other outcome. */
export function useStepUpError() {
  const t = useTranslations("admin.person");
  const tc = useTranslations("common");
  return (error: string | undefined) => (error === "wrongPassword" ? t("wrongPassword") : error === "rateLimited" ? tc("errors.rateLimited") : null);
}

/**
 * A refused invite or reset link: a step-up refusal stays on the password field; any other (the person was activated
 * or removed meanwhile) closes the dialog with a message and refreshes the stale view.
 */
export function useLinkRefused(setPwError: (message: string) => void, close: () => void) {
  const stepUpError = useStepUpError();
  const tc = useTranslations("common");
  const router = useRouter();
  return (error: string | undefined) => {
    const message = stepUpError(error);
    if (message) return setPwError(message);
    close();
    toast(tc("errors.generic"), "error");
    router.refresh();
  };
}

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
  const [open, setOpen] = useState<null | "edit" | "role" | "move" | "twofa" | "reset" | "unlink">(null);
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const stepUpError = useStepUpError();
  const [name, setName] = useState(person.name);
  const [jobTitle, setJobTitle] = useState(person.jobTitle ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [locale, setLocale] = useState(person.locale);
  const [role, setRole] = useState(person.role);
  const [dept, setDept] = useState(person.departmentId ?? "");
  // A rejected phone is reported on its own field (taken by another account, or not a usable number).
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // A new number signs the person in by SMS, so the server asks for the actor's password (updatePersonAction).
  const newPhone = phone.trim() !== "" && phone.trim() !== (person.phone ?? "");
  const close = () => {
    setOpen(null);
    setPassword("");
    setPwError(null);
  };
  const done = (msg = t("saved")) => {
    toast(msg);
    close();
    router.refresh();
  };
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const linkRefused = useLinkRefused(setPwError, close);
  const copy = (kind: "invite" | "reset") =>
    start(async () => {
      const res = await createLinkAction(person.id, kind, password);
      if (res.ok && res.url) {
        close();
        await copyOrShow(res.url, () => toast(tp("linkCopied")), setCreatedLink);
      } else linkRefused(res.error);
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
        <Button size="sm" variant="secondary" icon={<KeyRound />} onClick={() => setOpen("reset")}>
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
        <Button size="sm" variant="secondary" icon={<Unlink />} onClick={() => setOpen("unlink")}>
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

      <Dialog open={open === "edit"} onClose={close} title={t("edit")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updatePersonAction(person.id, { name, jobTitle, phone, locale: locale as "az" }, newPhone ? password : undefined);
              const phoneProblem = res.error === "phoneTaken" ? tp("phoneTaken") : res.error === "cannotAdd" ? tp("cannotAdd") : res.fields?.includes("phone") ? tp("invalidPhone") : null;
              setPhoneError(res.ok ? null : phoneProblem);
              const refusedPassword = newPhone ? stepUpError(res.error) : null;
              setPwError(refusedPassword);
              if (res.ok) done();
              else if (!refusedPassword && (!phoneProblem || (res.fields?.length ?? 0) > 1)) toast(res.error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.invalid"), "error");
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
          {/* Mounted by the keystroke that changes the number, so it must not take the focus from the phone field. */}
          {newPhone ? <ConfirmPasswordField id="edit-pw" autoFocus={false} value={password} onChange={setPassword} error={pwError} /> : null}
          <Button type="submit" disabled={pending || (newPhone && !password)}>
            {tc("save")}
          </Button>
        </form>
      </Dialog>

      <Dialog open={open === "unlink"} onClose={close} title={t("unlinkSso")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await unlinkSsoAction(person.id, password);
              if (res.ok) done(t("ssoUnlinked"));
              else if (res.error) setPwError(stepUpError(res.error));
              else toast(tc("errors.forbidden"), "error");
            });
          }}
        >
          <ConfirmPasswordField id="unlink-pw" value={password} onChange={setPassword} error={pwError} />
          <Button type="submit" disabled={pending || !password}>
            {t("unlinkSso")}
          </Button>
        </form>
      </Dialog>

      <Dialog open={open === "role"} onClose={close} title={t("changeRole")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await changeRoleAction(person.id, role as "learner", password);
              if (res.ok) done();
              else if (res.error) setPwError(stepUpError(res.error));
              else toast(tc("errors.forbidden"), "error");
            });
          }}
        >
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label={tc("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tc(`roles.${r}`)}
              </option>
            ))}
          </Select>
          <ConfirmPasswordField id="role-pw" value={password} onChange={setPassword} error={pwError} />
          <Button type="submit" disabled={pending || role === person.role || !password}>
            {tc("save")}
          </Button>
        </form>
      </Dialog>

      <Dialog open={open === "reset"} onClose={close} title={t("resetLinkTitle", { name: person.name })} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            copy("reset");
          }}
        >
          <p className="text-body-sm text-ink-muted">{t("resetLinkBody", { name: person.name })}</p>
          <ConfirmPasswordField id="reset-pw" value={password} onChange={setPassword} error={pwError} />
          <Button type="submit" disabled={pending || !password}>
            {t("resetLink")}
          </Button>
        </form>
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

      <Dialog open={open === "twofa"} onClose={close} title={t("resetTwoFactorTitle", { name: person.name })} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await resetTwoFactorAction(person.id, password);
              if (res.ok) done(t("twoFactorReset"));
              else if (res.error) setPwError(stepUpError(res.error));
              else toast(tc("errors.forbidden"), "error");
            });
          }}
        >
          <p className="text-body-sm text-ink-muted">{t("resetTwoFactorBody")}</p>
          <ConfirmPasswordField id="twofa-pw" value={password} onChange={setPassword} error={pwError} />
          <Button type="submit" variant="danger" disabled={pending || !password}>
            {t("resetTwoFactor")}
          </Button>
        </form>
      </Dialog>
      <CreatedLinkDialog url={createdLink} onClose={() => setCreatedLink(null)} />
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
