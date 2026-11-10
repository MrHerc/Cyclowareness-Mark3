"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Copy, Download, ImagePlus, KeyRound, MessageSquareWarning, MonitorSmartphone, ShieldCheck, ShieldOff, Signpost, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button, TextButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Segmented, Switch } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { ProblemForm } from "@/components/learner/problem-form";
import { setPreferencesAction } from "@/server/actions/preferences";
import {
  cancelDeletionAction,
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  regenerateBackupCodesAction,
  requestDeletionAction,
  resetTourAction,
  setAvatarAction,
  signOutOtherDevicesAction,
  startTotpAction,
} from "@/server/actions/profile";
import { hapticsEnabled, hapticsSupported, setHapticsEnabled, vibrate } from "@/lib/haptics";
import { checkPassword } from "@/lib/password-strength";
import { cn } from "@/lib/cn";

export function PhotoEditor({ name, src }: { name: string; src: string | null }) {
  const t = useTranslations("learner.profile");
  const input = useRef<HTMLInputElement>(null);
  const upload = useAction(setAvatarAction, { successToast: t("photoSaved"), errorMap: () => t("photoError") });
  const remove = useAction(setAvatarAction);
  const pending = upload.pending || remove.pending;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      toast(t("photoError"), "error");
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Centre-crop to a square and scale to 256 px; only this small JPEG is uploaded.
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d")!.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      upload.run(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => toast(t("photoError"), "error");
    img.src = url;
  };

  return (
    <div className="flex flex-col items-center text-center">
      <Avatar name={name} src={src} size="2xl" className="bg-safe-50 text-safe-700" />
      <p className="mt-4 text-headline font-bold">{name}</p>
      {/* The visible button below is the control; the hidden input is named but kept out of the tab order. */}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={src ? t("changePhoto") : t("addPhoto")}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="mt-3 flex flex-col items-center gap-1.5">
        <Button variant="secondary" size="sm" icon={<ImagePlus />} onClick={() => input.current?.click()} disabled={pending}>
          {src ? t("changePhoto") : t("addPhoto")}
        </Button>
        {src ? (
          <TextButton tone="danger" size="tab" disabled={pending} onClick={() => remove.run(null)}>
            {t("removePhoto")}
          </TextButton>
        ) : null}
      </div>
    </div>
  );
}

/** The vibration choice lives in this browser (src/lib/haptics.ts); this tiny store re-renders the switch after a change. */
const hapticListeners = new Set<() => void>();
function subscribeHaptics(onChange: () => void) {
  hapticListeners.add(onChange);
  return () => {
    hapticListeners.delete(onChange);
  };
}
const noHaptics = () => false;

function VibrationSwitch() {
  const t = useTranslations("learner.profile");
  // Decided after hydration: the server markup shows no control, so the first client paint matches it.
  const supported = useSyncExternalStore(subscribeHaptics, hapticsSupported, noHaptics);
  const enabled = useSyncExternalStore(subscribeHaptics, hapticsEnabled, noHaptics);
  if (!supported) {
    return (
      <div>
        <span className="block text-body-sm font-semibold">{t("vibration")}</span>
        <span className="text-caption text-ink-muted">{t("noVibration")}</span>
      </div>
    );
  }
  return (
    <Switch
      label={t("vibration")}
      description={t("vibrationBody")}
      checked={enabled}
      onChange={(e) => {
        setHapticsEnabled(e.target.checked);
        if (e.target.checked) vibrate(30);
        hapticListeners.forEach((notify) => notify());
      }}
    />
  );
}

const TIMER_KEYS = {
  standard: ["timerStandard", "timerStandardBody"],
  more: ["timerMore", "timerMoreBody"],
  off: ["timerOff", "timerOffBody"],
} as const;

export function Preferences({ soundOn, motion, timerPref }: { soundOn: boolean; motion: "full" | "calm" | "still"; timerPref: "standard" | "more" | "off" }) {
  const t = useTranslations("learner.profile");
  const [sound, setSound] = useState(soundOn);
  const [m, setM] = useState(motion);
  const [timer, setTimer] = useState(timerPref);
  const save = (data: Parameters<typeof setPreferencesAction>[0]) =>
    setPreferencesAction(data).then((r) => (r.ok ? toast(t("saved")) : undefined));
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
        <section className="grid gap-3">
          <h3 className="text-body font-semibold">{t("sound")}</h3>
          <Switch
            label={t("soundLabel")}
            description={t("soundBody")}
            checked={sound}
            onChange={(e) => {
              setSound(e.target.checked);
              void save({ soundOn: e.target.checked });
            }}
          />
          <VibrationSwitch />
        </section>
        <section className="grid gap-3">
          <div>
            <h3 className="text-body font-semibold">{t("motion")}</h3>
            <p className="text-caption text-ink-muted">{t("motionBody")}</p>
          </div>
          <Segmented
            name="motion"
            ariaLabel={t("motion")}
            value={m}
            onChange={(v) => {
              setM(v as typeof m);
              document.documentElement.dataset.motion = v;
              void save({ motion: v as typeof m });
            }}
            options={[
              { value: "full", label: t("motionFull") },
              { value: "calm", label: t("motionCalm") },
              { value: "still", label: t("motionStill") },
            ]}
          />
        </section>
      </div>
      <section className="grid gap-2">
        <h3 className="text-body font-semibold">{t("accessibility")}</h3>
        <fieldset className="grid gap-2">
          <legend className="text-body-sm font-semibold">{t("timer")}</legend>
          <p className="mb-1 text-caption text-ink-muted">{t("timerBody")}</p>
          {(["standard", "more", "off"] as const).map((v) => {
            const on = timer === v;
            return (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border bg-surface px-4 py-3.5 shadow-xs transition-colors",
                  on ? "border-brand-600" : "border-transparent hover:border-line",
                )}
              >
                <input
                  type="radio"
                  name="timer"
                  value={v}
                  className="peer sr-only"
                  checked={on}
                  onChange={() => {
                    setTimer(v);
                    void save({ timerPref: v });
                  }}
                />
                <span className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-line-control text-white peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="grid gap-0.5">
                  <span className="text-body-sm font-semibold">{t(TIMER_KEYS[v][0])}</span>
                  <span className="text-caption text-ink-muted">{t(TIMER_KEYS[v][1])}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </section>
    </div>
  );
}

function CodesList({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations("learner.twoFactor");
  const tc = useTranslations("common");
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="grid gap-4">
      <p className="text-body-sm text-ink-muted">{t("codesBody")}</p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-sunken p-4 font-mono text-body-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={<Copy />} onClick={() => navigator.clipboard.writeText(text).then(() => toast(tc("copied")))}>
          {tc("copy")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download />}
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([`${text}\n`], { type: "text/plain" }));
            a.download = t("codesFile");
            a.click();
          }}
        >
          {tc("download")}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-body-sm font-semibold">
        <input type="checkbox" className="size-5 accent-(--brand)" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        {t("codesSaved")}
      </label>
      <Button disabled={!saved} onClick={onDone}>
        {t("finish")}
      </Button>
    </div>
  );
}

export function TwoFactor({ enabled, required }: { enabled: boolean; required: boolean }) {
  const t = useTranslations("learner.twoFactor");
  const tp = useTranslations("learner.profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState<null | "setup" | "disable" | "codes">(null);
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<{ svg: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setOpen(null);
    setStep(1);
    setPassword("");
    setCode("");
    setQr(null);
    setCodes(null);
    setError(null);
    router.refresh();
  };
  const err = (e: string) => setError(e === "wrongPassword" ? t("errors.wrongPassword") : e === "wrongCode" ? t("errors.wrongCode") : e === "required" ? t("requiredNote") : tc("errors.generic"));
  const setup = useAction(startTotpAction, {
    onSuccess: (res) => {
      setQr({ svg: res.qrSvg, secret: res.secret });
      setError(null);
      setStep(2);
    },
    onError: err,
  });
  const confirmCode = useAction(confirmTotpAction, {
    successToast: t("enabled"),
    onSuccess: (res) => {
      setCodes(res.codes);
      setError(null);
      setStep(3);
    },
    onError: err,
  });
  const disable = useAction(disableTotpAction, { successToast: t("disabled"), onSuccess: close, onError: err });
  const regenerate = useAction(regenerateBackupCodesAction, { successToast: t("regenerated"), onSuccess: (res) => setCodes(res.codes), onError: err });
  const pending = setup.pending || confirmCode.pending || disable.pending || regenerate.pending;

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-sm", enabled ? "bg-safe-50 text-safe-600" : "bg-brand-50 text-brand-600")}>
          {enabled ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-body-sm font-semibold">
            {tp("twoStep")}
            <Pill tone={enabled ? "safe" : "neutral"}>{enabled ? tc("on") : tc("off")}</Pill>
          </p>
          <p className="text-caption text-ink-muted">{enabled ? tp("twoStepOnBody") : tp("twoStepBody")}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {enabled ? (
          <>
            <Button variant="secondary" size="sm" icon={<KeyRound />} onClick={() => setOpen("codes")}>
              {t("newCodes")}
            </Button>
            {!required ? (
              <Button variant="danger-soft" size="sm" onClick={() => setOpen("disable")}>
                {t("turnOff")}
              </Button>
            ) : null}
          </>
        ) : (
          <Button icon={<ShieldCheck />} onClick={() => setOpen("setup")}>
            {t("turnOn")}
          </Button>
        )}
      </div>
      {enabled && required ? <p className="mt-2 text-tab text-ink-subtle">{t("requiredNote")}</p> : null}

      <Dialog open={open === "setup"} onClose={close} title={tp("twoStep")} description={t("steps", { current: step, total: 3 })} size="sm">
        {step === 1 ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setup.run(password);
            }}
          >
            <p className="text-body-sm font-semibold">{t("passwordTitle")}</p>
            <p className="text-caption text-ink-muted">{t("passwordBody")}</p>
            <Field label={t("passwordLabel")} htmlFor="pw" error={error}>
              <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </Field>
            <Button type="submit" disabled={!password || pending}>
              {t("turnOn")}
            </Button>
          </form>
        ) : step === 2 && qr ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              confirmCode.run(code);
            }}
          >
            <p className="text-body-sm font-semibold">{t("scanTitle")}</p>
            <p className="text-caption text-ink-muted">{t("scanBody")}</p>
            <div className="mx-auto size-52 rounded-lg border border-line bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
            <p className="text-tab text-ink-muted">{t("manual")}</p>
            <code className="rounded-md bg-sunken px-3 py-2 text-center font-mono text-caption break-all">{qr.secret}</code>
            <Field label={t("verifyTitle")} htmlFor="totp" hint={t("verifyBody")} error={error}>
              <Input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="text-center font-mono text-title tracking-[0.4em]" />
            </Field>
            <Button type="submit" disabled={code.length < 6 || pending}>
              {t("finish")}
            </Button>
          </form>
        ) : codes ? (
          <CodesList codes={codes} onDone={close} />
        ) : null}
      </Dialog>

      <Dialog open={open === "disable"} onClose={close} title={t("disableTitle")} description={t("disableBody")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            disable.run(password);
          }}
        >
          <Field label={t("passwordLabel")} htmlFor="pw-off" error={error}>
            <Input id="pw-off" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" variant="danger" disabled={!password || pending}>
            {t("turnOff")}
          </Button>
        </form>
      </Dialog>

      <Dialog open={open === "codes"} onClose={close} title={t("newCodes")} description={t("regenerateBody")} size="sm">
        {codes ? (
          <CodesList codes={codes} onDone={close} />
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              regenerate.run(password);
            }}
          >
            <Field label={t("passwordLabel")} htmlFor="pw-codes" error={error}>
              <Input id="pw-codes" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </Field>
            <Button type="submit" disabled={!password || pending}>
              {t("newCodes")}
            </Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}

export function OtherDevices() {
  const t = useTranslations("learner.profile");
  const { run, pending } = useAction(signOutOtherDevicesAction, { successToast: t("signedOutOthers") });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-sm bg-sunken text-ink-subtle">
          <MonitorSmartphone className="size-5" />
        </span>
        <div>
          <p className="text-body-sm font-semibold">{t("signOutOthers")}</p>
          <p className="text-caption text-ink-muted">{t("signOutOthersBody")}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => run()}>
        {t("signOutOthers")}
      </Button>
    </div>
  );
}

const PASSWORD_MIN = 10;

/** The change-password field a refusal of changePasswordAction belongs to; null for one about no field (generic). */
export function passwordErrorField(error: string): "pw-current" | "pw-next" | "pw-confirm" | null {
  if (error === "wrongPassword") return "pw-current";
  if (error === "mismatch") return "pw-confirm";
  return ["required", "tooShort", "tooLong", "sameAsEmail", "weak"].includes(error) ? "pw-next" : null;
}

/** Profile → Security: replace the password (current one first), as setting it from a link, with the same rules. */
export function ChangePassword({ email, name }: { email: string; name: string }) {
  const t = useTranslations("learner.profile");
  const ta = useTranslations("auth.account");
  const t2 = useTranslations("learner.twoFactor");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const score = useMemo(() => (next ? checkPassword(next, [email, name]).score : 0), [next, email, name]);
  const rules = [
    { ok: next.length >= PASSWORD_MIN, label: ta("rules.length", { min: PASSWORD_MIN }) },
    { ok: next.length > 0 && score >= 3, label: ta("rules.strength") },
    { ok: next.length > 0 && next.toLowerCase() !== email.toLowerCase(), label: ta("rules.notEmail") },
    { ok: next.length > 0 && next === confirm, label: ta("rules.match") },
  ];
  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };
  const errText = (e: string) => (e === "wrongPassword" ? t2("errors.wrongPassword") : ["required", "tooShort", "tooLong", "sameAsEmail", "mismatch", "weak"].includes(e) ? ta(`errors.${e as "weak"}`, { min: PASSWORD_MIN }) : tc("errors.generic"));
  const { run, pending } = useAction(changePasswordAction, { successToast: t("passwordChanged"), onSuccess: close, onError: setError });
  // Each refusal is shown on, and announced with, the field it is about; one without a field goes below the form.
  const errorField = error ? passwordErrorField(error) : null;
  const fieldError = (id: string) => (errorField === id ? errText(error!) : null);
  const describe = (id: string, extra?: string) => ({ "aria-invalid": errorField === id || undefined, "aria-describedby": [errorField === id ? `${id}-error` : null, extra].filter(Boolean).join(" ") || undefined });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-sm bg-sunken text-ink-subtle">
          <KeyRound className="size-5" />
        </span>
        <div>
          <p className="text-body-sm font-semibold">{t("changePassword")}</p>
          <p className="text-caption text-ink-muted">{t("changePasswordBody")}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t("changePassword")}
      </Button>
      <Dialog open={open} onClose={close} title={t("changePassword")} description={t("changePasswordBody")} size="sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(current, next, confirm);
          }}
        >
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <Field label={t("currentPassword")} htmlFor="pw-current" error={fieldError("pw-current")}>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus {...describe("pw-current")} />
          </Field>
          <Field label={ta("passwordLabel")} htmlFor="pw-next" error={fieldError("pw-next")}>
            <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} {...describe("pw-next", "pw-rules")} />
          </Field>
          <Field label={ta("confirmLabel")} htmlFor="pw-confirm" error={fieldError("pw-confirm")}>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} {...describe("pw-confirm")} />
          </Field>
          <ul id="pw-rules" aria-label={ta("rules.label")} className="grid gap-1.5 text-caption">
            {rules.map((r) => (
              <li key={r.label} className={cn("flex items-center gap-2", r.ok ? "text-safe-700" : "text-ink-muted")}>
                <Check aria-hidden className={cn("size-3.5", r.ok ? "" : "opacity-30")} />
                {r.label}
              </li>
            ))}
          </ul>
          {error && !errorField ? (
            <p role="alert" className="text-caption text-risk-600">
              {errText(error)}
            </p>
          ) : null}
          <Button type="submit" disabled={!current || !next || !confirm || pending}>
            {t("changePassword")}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

export function DataSection({ pendingSince }: { pendingSince: string | null }) {
  const t = useTranslations("learner.profile");
  const [open, setOpen] = useState(false);
  const cancel = useAction(cancelDeletionAction);
  const request = useAction(requestDeletionAction, { onSuccess: () => setOpen(false) });
  const pending = cancel.pending || request.pending;
  return (
    <div className="grid gap-3">
      <a href="/api/me/export" download className="flex items-center gap-3 rounded-lg border border-line p-4 hover:bg-sunken">
        <Download className="size-5 text-brand-600" />
        <span>
          <span className="block text-body-sm font-semibold">{t("download")}</span>
          <span className="block text-caption text-ink-muted">{t("downloadBody")}</span>
        </span>
      </a>
      {pendingSince ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn-100 bg-warn-50 p-4">
          <p className="text-caption text-warn-700">{t("deletionPending", { date: pendingSince })}</p>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => cancel.run()}>
            {t("deletionCancel")}
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-3 rounded-lg border border-line p-4 text-start hover:bg-risk-50">
          <Trash2 className="size-5 text-risk-600" />
          <span>
            <span className="block text-body-sm font-semibold text-risk-600">{t("deletion")}</span>
            <span className="block text-caption text-ink-muted">{t("deletionBody")}</span>
          </span>
        </button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("deletionConfirmTitle")}
        size="sm"
        footer={
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => request.run()}
          >
            {t("deletionConfirm")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("deletionConfirmBody")}</p>
      </Dialog>
    </div>
  );
}

export function TourReset() {
  const t = useTranslations("learner.profile");
  return (
    <button type="button" className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-start hover:bg-sunken" onClick={() => resetTourAction().then(() => toast(t("tourReset")))}>
      <Signpost className="size-5 text-brand-600" />
      <span className="flex-1 text-body-sm font-semibold">{t("tour")}</span>
      <ChevronRight className="size-4 text-ink-subtle" />
    </button>
  );
}

export function ProblemButton() {
  const t = useTranslations("learner.problem");
  const tp = useTranslations("learner.profile");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-start hover:bg-sunken" onClick={() => setOpen(true)}>
        <MessageSquareWarning className="size-5 text-brand-600" />
        <span className="flex-1 text-body-sm font-semibold">{tp("reportProblem")}</span>
        <ChevronRight className="size-4 text-ink-subtle" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("title")} description={t("description")} size="sm">
        <ProblemForm context="page:/profile" onSent={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

