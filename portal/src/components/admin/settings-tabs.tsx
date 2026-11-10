"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useClientFormat } from "@/lib/client-format";
import { RelativeTime } from "@/components/relative-time";
import {
  AlarmClock,
  ArrowUpRight,
  Bold,
  BookOpen,
  CalendarClock,
  Copy,
  Flame,
  ImageUp,
  Italic,
  KeyRound,
  LifeBuoy,
  Link as LinkIcon,
  Mail,
  PenLine,
  Pilcrow,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import {
  domainProofRecordAction,
  grantSupportAccessAction,
  lookupWatermarkAction,
  revokeSupportAccessAction,
  rotateWebhookSecretAction,
  saveAttestationAction,
  saveBrandingAction,
  saveCertificateAction,
  saveEmailAction,
  saveIdentityAction,
  saveIntegrationsAction,
  saveLanguagesAction,
  saveLearningAction,
  saveNotificationsAction,
  saveProtectionAction,
  saveRetentionAction,
  saveTimeZoneAction,
  resendFailedMailAction,
  sendTestEventAction,
  setLogoAction,
  testEmailAction,
  verifyDomainAction,
  verifySimulationDomainAction,
} from "@/server/actions/settings";
import type { TemplateKind, TenantSettings } from "@/server/db/schema";
import { DESTINATION_PORTS, SYSLOG_DEFAULT_PORT } from "@/lib/destination-ports";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/card";
import { Button, ButtonAnchor, TextButton, textButtonClass } from "@/components/ui/button";
import { Checkbox, Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/field";
import { Dot, Pill } from "@/components/ui/pill";
import { Notice } from "@/components/ui/layout";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "@/components/ui/toast";
import { BRAND_PALETTE, DEFAULT_ATTESTATION, DEFAULT_CERTIFICATE_TEXT, DEFAULT_TEMPLATES, WEBHOOK_EVENTS, emailButtonLabel } from "@/lib/tenant-defaults";
import { parseEmailMarkup } from "@/lib/email-markup";
import { LOCALES, LOCALE_NAMES, langAttrs } from "@/i18n/config";
import { readableOn } from "@/lib/color";
import { cn } from "@/lib/cn";
import { endpointKey } from "@/lib/stored-secret";
import { useStepUpError } from "@/components/admin/person-actions";

/*
 * Settings as the browser receives them: stored secrets (encrypted) stay on the server, the tabs
 * only learn whether one is set (src/app/(admin)/admin/settings/page.tsx strips them).
 */
type Identity = TenantSettings["identity"];
export type IdentityView = Omit<Identity, "sso" | "ldap"> & {
  sso?: Omit<NonNullable<Identity["sso"]>, "clientSecretEnc"> & { hasClientSecret: boolean };
  ldap?: Omit<NonNullable<Identity["ldap"]>, "passwordEnc"> & { hasPassword: boolean };
};
export type EmailView = Omit<TenantSettings["email"], "passwordEnc"> & { hasPassword: boolean };
export type IntegrationsView = Omit<TenantSettings["integrations"], "webhookSecretEnc"> & { hasWebhookSecret: boolean };

/** Marks the control the server rejected until it is edited again, and moves focus to it. */
function markInvalid(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute("aria-invalid", "true");
  el.addEventListener("input", () => el.removeAttribute("aria-invalid"), { once: true });
  el.focus();
}

/**
 * Runs a settings action and reports the outcome. `fields` maps the action's zod paths to input
 * ids, so a rejected value names its field (from the rendered label) and marks the input.
 */
function useSave() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<{ ok: boolean; field?: string; message?: string }>, fields?: Record<string, string>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast(t("saved"), "success");
        return;
      }
      const id = res.field ? fields?.[res.field] : undefined;
      const label = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || document.getElementById(id)?.getAttribute("aria-label") || undefined : undefined;
      toast(res.message ?? (label ? tc("errors.invalidField", { field: label }) : tc("errors.invalid")), "error");
      if (id) markInvalid(id);
    });
  return { pending, save };
}

function SaveBar({ pending, onSave }: { pending: boolean; onSave: () => void }) {
  const t = useTranslations("settings");
  return (
    <div className="flex justify-end">
      <Button disabled={pending} onClick={onSave}>
        {t("save")}
      </Button>
    </div>
  );
}

/** Numbered step heading (Sign-in and Protection steps). */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-tab font-bold text-brand-700">{n}</span>
      {children}
    </span>
  );
}

/* ───────── branding ───────── */

export function BrandingTab({
  name,
  branding,
  domain,
  verifiedOn,
  lapsing,
}: {
  name: string;
  branding: { primary: string; accent: string; logoUrl?: string | null; senderName?: string; senderDomain?: string };
  domain: string | null;
  verifiedOn: string | null;
  /** The daily re-check no longer finds the record: since when, and the day the proof ends (formatted on the server). */
  lapsing: { since: string; endsOn: string } | null;
}) {
  const t = useTranslations("settings.branding");
  const tc = useTranslations("common");
  const { pending, save } = useSave();
  const [n, setN] = useState(name);
  const [primary, setPrimary] = useState(branding.primary);
  const [accent, setAccent] = useState(branding.accent);
  const [senderName, setSenderName] = useState(branding.senderName ?? "");
  const [senderDomain, setSenderDomain] = useState(branding.senderDomain ?? "");
  const file = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(branding.logoUrl ?? null);

  // Domain proof: the TXT value is derived on the server from the organisation id and the app secret.
  const [proofDomain, setProofDomain] = useState(domain ?? branding.senderDomain ?? "");
  const [proof, setProof] = useState(domain && verifiedOn ? { domain, verifiedOn } : null);
  const [record, setRecord] = useState("");
  const [checking, startCheck] = useTransition();
  useEffect(() => {
    domainProofRecordAction().then(
      (r) => setRecord(r.record),
      () => setRecord(""),
    );
  }, []);
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast(tc("copied")));
  const checkDomain = () =>
    startCheck(async () => {
      const res = await verifyDomainAction(proofDomain);
      if (!res.ok) {
        toast(res.error === "rateLimited" ? tc("errors.rateLimited") : res.error === "domainTaken" ? t("domainTaken") : t("checkInvalid"), "error");
        return;
      }
      if (res.verified && res.verifiedOn) {
        setProof({ domain: proofDomain.trim().toLowerCase(), verifiedOn: res.verifiedOn });
        toast(t("checkOk"), "success");
      } else {
        // A missing record never removes an existing proof (see verifyDomainAction).
        if (!res.kept) setProof(null);
        toast(res.kept ? t("checkKept") : t("checkMissing"), "error");
      }
    });

  const upload = (f: File) => {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(f.type) || f.size > 512 * 1024) return toast(t("logoError"), "error");
    const reader = new FileReader();
    reader.onload = () =>
      save(async () => {
        const res = await setLogoAction(String(reader.result));
        if (res.ok) setLogo(String(reader.result));
        // Oversized or unsupported files get the client check's message; an SVG with scripts or outside references its own.
        return res.ok ? res : { ok: false, message: res.error === "unsafeSvg" ? t("logoUnsafe") : t("logoError") };
      });
    reader.readAsDataURL(f);
  };

  const swatches = (value: string, set: (v: string) => void, label: string, def: string, id: string) => (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-caption font-semibold">{label}</span>
        <input type="color" value={value} onChange={(e) => set(e.target.value)} aria-label={label} className="size-9 cursor-pointer rounded-md border border-line pointer-coarse:size-11" />
        <Input id={id} value={value} onChange={(e) => set(e.target.value)} className="h-9 w-28 font-mono text-caption pointer-coarse:h-11" aria-label={t("hexCode", { colour: label })} />
        <TextButton size="tab" onClick={() => set(def)}>
          {t("default")}
        </TextButton>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BRAND_PALETTE.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => set(c.toLowerCase())} className={cn("size-7 rounded-full border-2 pointer-coarse:size-11", value.toLowerCase() === c.toLowerCase() ? "border-ink" : "border-transparent")} style={{ background: c }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        <Card>
          <CardHeader title={t("nameLogo")} description={t("nameLogoBody")} />
          <CardBody className="grid gap-4">
            <Field label={t("displayName")} htmlFor="b-name">
              <Input id="b-name" value={n} onChange={(e) => setN(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t("logo")} htmlFor="b-logo">
              <div
                className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-line-strong bg-sunken p-5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) upload(f);
                }}
              >
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logo ? <img src={logo} alt="" className="size-full object-contain" /> : <ImageUp className="size-7 text-ink-subtle" />}
                </span>
                <div className="grid min-w-40 flex-1 gap-0.5">
                  <p className="text-caption font-semibold">{t("dropTitle")}</p>
                  <p className="text-tab text-ink-subtle">{t("logoHint")}</p>
                </div>
                <input
                  id="b-logo"
                  ref={file}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" icon={<ImageUp />} onClick={() => file.current?.click()}>
                    {logo ? t("replace") : t("upload")}
                  </Button>
                  {logo ? (
                    <Button size="icon-sm" variant="ghost" aria-label={t("removeLogo")} title={t("removeLogo")} onClick={() => save(async () => (setLogo(null), setLogoAction(null)))}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </div>
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("colours")} description={t("coloursBody")} />
          <CardBody className="grid gap-5">
            {swatches(primary, setPrimary, t("primary"), "#4f46e5", "b-primary")}
            {swatches(accent, setAccent, t("accent"), "#ff7a1a", "b-accent")}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("sender")} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("senderName")} htmlFor="b-sn">
              <Input id="b-sn" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </Field>
            <Field label={t("senderDomain")} htmlFor="b-sd" hint={t("senderHint")}>
              <Input id="b-sd" dir="ltr" value={senderDomain} onChange={(e) => setSenderDomain(e.target.value)} placeholder="agency.gov.az" />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("domainProof")} description={t("domainProofBody")} />
          <CardBody className="grid gap-4">
            {proof && lapsing && proof.domain === domain ? (
              <Notice tone="warn" icon={<ShieldAlert />}>
                {t("proofLapsing", { domain: proof.domain, since: lapsing.since, date: lapsing.endsOn })}
              </Notice>
            ) : proof ? (
              <Notice tone="safe" icon={<ShieldCheck />}>
                {t("proven", { domain: proof.domain, date: proof.verifiedOn })}
              </Notice>
            ) : (
              <Notice tone="warn">{t("notProven")}</Notice>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("domain")} htmlFor="b-domain">
                <Input id="b-domain" dir="ltr" value={proofDomain} onChange={(e) => setProofDomain(e.target.value)} placeholder="agency.gov.az" autoComplete="off" spellCheck={false} />
              </Field>
              <Field label={t("txtRecord")} htmlFor="b-txt" hint={t("txtHint")}>
                <div className="flex gap-2">
                  <Input id="b-txt" value={record} readOnly className="font-mono text-caption" />
                  <Button variant="secondary" size="icon" aria-label={tc("copy")} disabled={!record} onClick={() => copy(record)}>
                    <Copy />
                  </Button>
                </div>
              </Field>
            </div>
            <Button variant="secondary" className="w-fit" disabled={checking || !proofDomain.trim()} onClick={checkDomain}>
              {t("check")}
            </Button>
          </CardBody>
        </Card>
        <SaveBar pending={pending} onSave={() => save(() => saveBrandingAction({ name: n, primary, accent, senderName, senderDomain }), { name: "b-name", primary: "b-primary", accent: "b-accent", senderName: "b-sn", senderDomain: "b-sd" })} />
      </div>
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-caption font-semibold text-ink-muted">{t("preview")}</p>
          <p className="text-tab text-ink-subtle">{t("previewBody")}</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-raised">
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="h-7 w-auto max-w-32 object-contain" /> : <span className="size-7 shrink-0 rounded-sm" style={{ background: primary }} />}
            <span className="min-w-0 truncate text-caption font-semibold">{n}</span>
            <Pill tone="reward" className="ms-auto">
              <Flame />5
            </Pill>
          </div>
          <div className="p-4">
            <div className="rounded-xl p-4" style={{ background: primary, color: readableOn(primary) }}>
              <p className="text-tab font-semibold opacity-80">▶ {t("sampleContinue")}</p>
              <p className="mt-1 text-title-sm font-bold">{t("sampleModule")}</p>
              <p className="mt-1 text-tab opacity-80">{t("sampleSubtitle")}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-1.5 flex-1 rounded-pill bg-white/30">
                  <span className="block h-full w-2/5 rounded-pill bg-white" />
                </span>
                <span className="text-tab font-semibold tabular-nums">{tc("units.percent", { value: 40 })}</span>
              </div>
              <span className="mt-3 inline-block rounded-pill px-3 py-1 text-tab font-bold" style={{ background: accent, color: readableOn(accent) }}>
                {t("sampleContinue")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-1 rounded-pill px-3 py-1 text-tab font-bold" style={{ background: `color-mix(in oklab, ${accent} 16%, white)`, color: "#ab4f0d" }}>
                <Zap className="size-3.5" />
                {t("xpToday", { xp: 120 })}
              </p>
              <Pill tone="brand" className="px-3 text-tab">
                <BookOpen />
                {t("sampleLearn")}
              </Pill>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ───────── languages ───────── */

/** `timeZones` comes from the server: the browser's own list can differ and would not hydrate. */
export function LanguagesTab({ defaultLocale, locales, timeZone, timeZones }: { defaultLocale: string; locales: string[]; timeZone: string; timeZones: readonly string[] }) {
  const t = useTranslations("settings.languages");
  const tc = useTranslations("common");
  const { pending, save } = useSave();
  const [def, setDef] = useState(defaultLocale);
  const [on, setOn] = useState(new Set(locales));
  const [zone, setZone] = useState(timeZone);
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title={t("yourTitle")} description={t("yourBody")} action={<LanguageSwitcher locales={locales} />} className="pb-5 sm:pb-6" />
      </Card>
      <Card>
        <CardHeader title={t("defaultTitle")} description={t("defaultBody")} />
        <CardBody>
          <Select id="lg-default" value={def} onChange={(e) => setDef(e.target.value)} className="max-w-xs" aria-label={t("defaultTitle")}>
            {LOCALES.filter((l) => on.has(l)).map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("availableTitle")} description={t("availableBody")} action={<Pill tone="brand">{t("onCount", { count: on.size, total: LOCALES.length })}</Pill>} />
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LOCALES.map((l) => (
            <label key={l} className={cn("flex items-start gap-3 rounded-lg border p-3.5", on.has(l) ? "border-brand-300 bg-brand-50/50" : "border-line")}>
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-(--brand)"
                disabled={l === def}
                checked={on.has(l)}
                onChange={(e) => setOn((s) => (e.target.checked ? new Set(s).add(l) : new Set([...s].filter((x) => x !== l))))}
              />
              <span className="flex flex-wrap items-center gap-2 text-body-sm font-semibold">
                <span {...langAttrs(l)}>{LOCALE_NAMES[l]}</span>
                {l === def ? (
                  <Pill tone="brand">
                    <Star />
                    {tc("default")}
                  </Pill>
                ) : null}
              </span>
            </label>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("timeZoneTitle")} description={t("timeZoneBody")} />
        <CardBody>
          <Select id="lg-timezone" value={zone} onChange={(e) => setZone(e.target.value)} className="max-w-xs" aria-label={t("timeZoneTitle")}>
            {timeZones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </CardBody>
      </Card>
      <SaveBar
        pending={pending}
        onSave={() =>
          save(
            async () => {
              const res = await saveLanguagesAction(def, [...on]);
              return res.ok ? saveTimeZoneAction(zone) : res;
            },
            { defaultLocale: "lg-default", timeZone: "lg-timezone" },
          )
        }
      />
    </div>
  );
}

/* ───────── identity ───────── */

export function IdentityTab({
  identity,
  redirectUri,
  signInLink,
  testResult,
}: {
  identity: IdentityView;
  redirectUri: string;
  signInLink: string;
  /** Result of the last test sign-in (/api/sso/start?test=1 returns here with it). */
  testResult: "ok" | "failed" | null;
}) {
  const t = useTranslations("settings.identity");
  const tc = useTranslations("common");
  const tp = useTranslations("admin.person");
  const { pending, save } = useSave();
  const stepUpError = useStepUpError();
  // Re-pointing the organisation's sign-in takes the actor's password (saveIdentityAction); the field appears once such a value differs from the saved one.
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwAsked, setPwAsked] = useState(false);
  const [s, setS] = useState({
    requireAdmin2fa: identity.requireAdmin2fa,
    maxDevices: identity.maxDevices,
    ssoEnabled: identity.ssoEnabled,
    sso: {
      // Only OpenID Connect is connected: a stored "saml" moves to it on the next save.
      protocol: "oidc" as "oidc" | "saml",
      issuer: identity.sso?.issuer ?? "",
      clientId: identity.sso?.clientId ?? "",
      clientSecret: "",
      emailClaim: identity.sso?.emailClaim ?? "email",
      autoCreate: identity.sso?.autoCreate ?? true,
      samlEntryPoint: identity.sso?.samlEntryPoint ?? "",
      samlCertificate: identity.sso?.samlCertificate ?? "",
    },
    ldap: {
      url: identity.ldap?.url ?? "",
      bindDn: identity.ldap?.bindDn ?? "",
      password: "",
      caCertificate: identity.ldap?.caCertificate ?? "",
      certificatePin: identity.ldap?.certificatePin ?? "",
      searchBase: identity.ldap?.searchBase ?? "",
      filter: identity.ldap?.filter ?? "(&(objectCategory=person)(objectClass=user)(mail=*))",
      departmentSource: identity.ldap?.departmentSource ?? "attribute",
      departmentAttribute: identity.ldap?.departmentAttribute ?? "department",
      syncManagers: identity.ldap?.syncManagers ?? true,
      syncLanguage: identity.ldap?.syncLanguage ?? false,
      schedule: identity.ldap?.schedule ?? "off",
      passwordSignIn: identity.ldap?.passwordSignIn ?? false,
      matchByEmail: identity.ldap?.matchByEmail ?? true,
    },
  });
  const [initial, setInitial] = useState(s);
  const sso = s.sso;
  const ldap = s.ldap;
  const trustChanged =
    sso.issuer !== initial.sso.issuer ||
    sso.clientId !== initial.sso.clientId ||
    sso.emailClaim !== initial.sso.emailClaim ||
    sso.autoCreate !== initial.sso.autoCreate ||
    s.ssoEnabled !== initial.ssoEnabled ||
    (initial.requireAdmin2fa && !s.requireAdmin2fa);
  const needsPassword = trustChanged || pwAsked;
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast(tc("copied")));
  const [checked, setChecked] = useState<boolean | null>(null);
  const checkSettings = () => {
    let ok = false;
    try {
      ok = new URL(sso.issuer).protocol === "https:" && sso.clientId.trim() !== "";
    } catch {
      ok = false;
    }
    setChecked(ok);
  };
  const setSso = (patch: Partial<typeof sso>) => {
    setS({ ...s, sso: { ...sso, ...patch } });
    if ("issuer" in patch || "clientId" in patch) setChecked(null);
  };
  // A stored secret is not kept for a different server (saveIdentityAction): say so before saving.
  const ssoReenter = !!identity.sso?.hasClientSecret && !sso.clientSecret && endpointKey(identity.sso.issuer) !== endpointKey(sso.issuer);
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title={t("ssoTitle")} description={t("ssoBody")} action={<Pill tone={s.ssoEnabled ? "safe" : "neutral"}>{s.ssoEnabled ? tc("on") : tc("off")}</Pill>} />
        <CardBody>
          <Notice tone="brand" icon={<ShieldCheck />}>
            {t("adminNote")}
          </Notice>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<Step n={1}>{t("step1Title")}</Step>} description={t("step1Body")} />
        <CardBody className="grid gap-2">
          <p className="text-caption text-ink-muted">{t("oidcHint")}</p>
          {identity.sso?.protocol === "saml" ? <Notice tone="warn">{t("samlNotConnected")}</Notice> : null}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<Step n={2}>{t("step2Title")}</Step>} description={t("step2Body")} />
        <CardBody>
          <Field label={t("redirectUri")} htmlFor="i-redirect">
            <div className="flex gap-2">
              <Input id="i-redirect" value={redirectUri} readOnly className="font-mono text-caption" />
              <Button variant="secondary" size="icon" aria-label={tc("copy")} onClick={() => copy(redirectUri)}>
                <Copy />
              </Button>
            </div>
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<Step n={3}>{t("step3Title")}</Step>} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("issuer")} htmlFor="i-issuer" className="sm:col-span-2">
            <Input id="i-issuer" dir="ltr" value={sso.issuer} onChange={(e) => setSso({ issuer: e.target.value })} placeholder="https://login.example.az/realms/staff" />
          </Field>
          <Field label={t("clientId")} htmlFor="i-client">
            <Input id="i-client" dir="ltr" value={sso.clientId} onChange={(e) => setSso({ clientId: e.target.value })} />
          </Field>
          <Field label={t("clientSecret")} htmlFor="i-secret" hint={ssoReenter ? t("secretReenter") : identity.sso?.hasClientSecret ? t("secretSet") : t("secretHint")}>
            <Input id="i-secret" type="password" autoComplete="new-password" value={sso.clientSecret} onChange={(e) => setSso({ clientSecret: e.target.value })} />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<Step n={4}>{t("step4Title")}</Step>} />
        <CardBody className="grid gap-5">
          <Field label={t("emailClaim")} htmlFor="i-claim" hint={t("emailClaimHint")}>
            <Input id="i-claim" className="max-w-sm" value={sso.emailClaim} onChange={(e) => setSso({ emailClaim: e.target.value })} placeholder="email" />
          </Field>
          <Switch label={t("autoCreate")} description={t("autoCreateBody")} checked={sso.autoCreate} onChange={(e) => setSso({ autoCreate: e.target.checked })} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<Step n={5}>{t("step5Title")}</Step>} />
        <CardBody className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={checkSettings}>
              {t("checkSettings")}
            </Button>
            <ButtonAnchor href={`${signInLink}&test=1`} variant="secondary" aria-describedby="i-test-hint">
              {t("openTest")}
            </ButtonAnchor>
          </div>
          <p id="i-test-hint" className="text-caption text-ink-subtle">
            {t("testSignInHint")}
          </p>
          <div role="status" className="grid gap-2">
            {checked !== null ? <Notice tone={checked ? "safe" : "risk"}>{checked ? t("checkOk") : t("checkFailed")}</Notice> : null}
            {testResult ? <Notice tone={testResult === "ok" ? "safe" : "risk"}>{testResult === "ok" ? t("testOk") : t("testFailed")}</Notice> : null}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={<Step n={6}>{t("step6Title")}</Step>} />
        <CardBody className="grid gap-5">
          <Switch label={t("use")} checked={s.ssoEnabled} onChange={(e) => setS({ ...s, ssoEnabled: e.target.checked })} />
          <Field label={t("signInLink")} htmlFor="i-link">
            <div className="flex gap-2">
              <Input id="i-link" value={signInLink} readOnly className="font-mono text-caption" />
              <Button variant="secondary" size="icon" aria-label={tc("copy")} onClick={() => copy(signInLink)}>
                <Copy />
              </Button>
            </div>
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("otherTitle")} />
        <CardBody className="grid gap-5">
          <Switch label={t("require2fa")} description={t("require2faBody")} checked={s.requireAdmin2fa} onChange={(e) => setS({ ...s, requireAdmin2fa: e.target.checked })} />
          <Field label={t("maxDevices")} htmlFor="i-devices">
            <Select id="i-devices" className="max-w-48" value={s.maxDevices ?? ""} onChange={(e) => setS({ ...s, maxDevices: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("noLimit")}</option>
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>
      {needsPassword ? (
        <Card>
          <CardBody>
            <Field label={tp("confirmPassword")} htmlFor="i-password" hint={t("confirmHint")} error={pwError} className="max-w-sm">
              <Input id="i-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={pwError ? true : undefined} aria-describedby={pwError ? "i-password-error" : "i-password-hint"} />
            </Field>
          </CardBody>
        </Card>
      ) : null}
      <SaveBar
        pending={pending || (needsPassword && !password)}
        onSave={() =>
          save(
            async () => {
              const res = await saveIdentityAction(
                {
                  requireAdmin2fa: s.requireAdmin2fa,
                  maxDevices: s.maxDevices,
                  ssoEnabled: s.ssoEnabled,
                  sso: { ...sso, clientSecret: sso.clientSecret || undefined },
                  ldap: { ...ldap, password: ldap.password || undefined },
                },
                needsPassword ? password : undefined,
              );
              const refused = stepUpError(res.error);
              setPwError(refused);
              if (refused) setPwAsked(true);
              // What was just saved is the new baseline, so the password is not asked again until trust changes once more.
              if (res.ok) {
                setPassword("");
                setPwAsked(false);
                setInitial(s);
              }
              return refused ? { ...res, field: "password", message: refused } : res.error === "secretRequired" ? { ...res, message: t("secretReenter") } : res;
            },
            {
              maxDevices: "i-devices",
              "sso.issuer": "i-issuer",
              "sso.clientId": "i-client",
              "sso.clientSecret": "i-secret",
              "sso.emailClaim": "i-claim",
              password: "i-password",
            },
          )
        }
      />
    </div>
  );
}

/* ───────── email ───────── */

export function EmailTab({ email, viewerEmail, outbox, failedCount }: { email: EmailView; viewerEmail: string; outbox: { id: string; to: string; subject: string; status: string; createdAt: string; error: string | null; resendable: boolean; cancelled: boolean }[]; failedCount: number }) {
  const t = useTranslations("settings.email");
  const tb = useTranslations("settings.branding");
  const tc = useTranslations("common");
  const { pending, save } = useSave();
  const [resending, startResend] = useTransition();
  const resend = (id?: string) =>
    startResend(async () => {
      const res = await resendFailedMailAction(id);
      toast(res.ok ? t("resent", { count: res.count }) : t("resendFailed"), res.ok ? "success" : "error");
    });
  const [s, setS] = useState({ host: email.host ?? "", port: email.port ?? 587, secure: email.secure ?? false, user: email.user ?? "", password: "", fromName: email.fromName ?? "", fromAddress: email.fromAddress ?? "", replyTo: email.replyTo ?? "", helpdesk: email.helpdesk ?? "", simulationFromAddress: email.simulationFromAddress ?? "", enabled: email.enabled });
  const [to, setTo] = useState(viewerEmail);
  const [testing, startTest] = useTransition();
  // Look-alike domain of the simulation sender: proven with the same TXT record as the organisation's domain (Branding).
  const [simDomain, setSimDomain] = useState(email.simulationDomain ?? "");
  const [record, setRecord] = useState("");
  const [checking, startCheck] = useTransition();
  useEffect(() => {
    domainProofRecordAction().then(
      (r) => setRecord(r.record),
      () => setRecord(""),
    );
  }, []);
  const checkSimulationDomain = () =>
    startCheck(async () => {
      const res = await verifySimulationDomainAction(s.simulationFromAddress);
      if (!res.ok) return toast(res.error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.invalidField", { field: t("simulationFrom") }), "error");
      if (res.found && res.domain) setSimDomain(res.domain);
      toast(res.found ? tb("checkOk") : tb("checkMissing"), res.found ? "success" : "error");
    });
  // The stored password is not kept for a different host or port (saveEmailAction); 587 is the default port.
  const passwordReenter = email.hasPassword && !s.password && endpointKey(email.host, email.port ?? 587) !== endpointKey(s.host, s.port || 587);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid content-start gap-5">
        <Card>
          <CardHeader title={t("delivery")} description={t("deliveryBody")} />
          <CardBody className="grid gap-4">
            <Pill tone={email.enabled ? "safe" : "neutral"} className="w-fit">
              {email.enabled ? t("ready") : t("notSet")}
            </Pill>
            <Switch label={t("sendLinks")} description={t("sendLinksBody")} checked={s.enabled} disabled={!email.testedAt} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("server")} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("host")} htmlFor="e-host">
              <Input id="e-host" dir="ltr" value={s.host} onChange={(e) => setS({ ...s, host: e.target.value })} placeholder="smtp.example.az" />
            </Field>
            <Field label={t("security")} htmlFor="e-sec">
              <Segmented name="sec" ariaLabel={t("security")} value={s.secure ? "ssl" : "starttls"} onChange={(v) => setS({ ...s, secure: v === "ssl", port: v === "ssl" ? 465 : 587 })} options={[{ value: "starttls", label: "STARTTLS" }, { value: "ssl", label: "SSL/TLS" }]} />
            </Field>
            <Field label={t("port")} htmlFor="e-port" hint={t("portHint", { ports: DESTINATION_PORTS.smtp.join(", ") })}>
              <Input id="e-port" type="number" value={s.port} onChange={(e) => setS({ ...s, port: Number(e.target.value) })} />
            </Field>
            <Field label={t("user")} htmlFor="e-user">
              <Input id="e-user" dir="ltr" value={s.user} onChange={(e) => setS({ ...s, user: e.target.value })} autoComplete="off" />
            </Field>
            <Field label={t("password")} htmlFor="e-pw" hint={passwordReenter ? t("passwordReenter") : email.hasPassword ? t("passwordSet") : undefined}>
              <Input id="e-pw" type="password" value={s.password} onChange={(e) => setS({ ...s, password: e.target.value })} autoComplete="new-password" />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("senderTitle")} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fromName")} htmlFor="e-fn">
              <Input id="e-fn" value={s.fromName} onChange={(e) => setS({ ...s, fromName: e.target.value })} />
            </Field>
            <Field label={t("fromAddress")} htmlFor="e-fa">
              <Input id="e-fa" type="email" value={s.fromAddress} onChange={(e) => setS({ ...s, fromAddress: e.target.value })} placeholder="no-reply@example.az" />
            </Field>
            <Field label={t("replyTo")} htmlFor="e-rt">
              <Input id="e-rt" type="email" value={s.replyTo} onChange={(e) => setS({ ...s, replyTo: e.target.value })} />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("simulationTitle")} description={t("simulationBody")} />
          <CardBody className="grid gap-4">
            {simDomain ? (
              <Notice tone="safe" icon={<ShieldCheck />}>
                {t("simulationProven", { domain: simDomain })}
              </Notice>
            ) : (
              <Notice tone="warn">{t("simulationNotProven")}</Notice>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("simulationFrom")} htmlFor="e-sf" hint={t("simulationFromHint")}>
                <Input id="e-sf" type="email" dir="ltr" value={s.simulationFromAddress} onChange={(e) => setS({ ...s, simulationFromAddress: e.target.value })} placeholder="accounts@ofis-techizat.example" autoComplete="off" spellCheck={false} />
              </Field>
              <Field label={tb("txtRecord")} htmlFor="e-txt" hint={tb("txtHint")}>
                <div className="flex gap-2">
                  <Input id="e-txt" value={record} readOnly className="font-mono text-caption" />
                  <Button variant="secondary" size="icon" aria-label={tc("copy")} disabled={!record} onClick={() => navigator.clipboard.writeText(record).then(() => toast(tc("copied")))}>
                    <Copy />
                  </Button>
                </div>
              </Field>
            </div>
            <Button variant="secondary" className="w-fit" disabled={checking || !s.simulationFromAddress.includes("@")} onClick={checkSimulationDomain}>
              {tb("check")}
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("helpdeskTitle")} />
          <CardBody>
            <Field label={t("helpdesk")} htmlFor="e-hd">
              <Input id="e-hd" type="email" className="max-w-sm" value={s.helpdesk} onChange={(e) => setS({ ...s, helpdesk: e.target.value })} />
            </Field>
          </CardBody>
        </Card>
        <SaveBar
          pending={pending}
          onSave={() =>
            save(async () => {
              const res = await saveEmailAction({ ...s, password: s.password || undefined, port: s.port || undefined });
              return res.error === "secretRequired" ? { ...res, message: t("passwordReenter") } : res;
            }, { host: "e-host", port: "e-port", user: "e-user", password: "e-pw", fromName: "e-fn", fromAddress: "e-fa", replyTo: "e-rt", helpdesk: "e-hd", simulationFromAddress: "e-sf" })}
        />
        <Card>
          <CardHeader
            title={t("outbox")}
            description={t("outboxBody")}
            action={
              failedCount ? (
                <Button size="sm" variant="secondary" icon={<Send />} disabled={resending} onClick={() => resend()}>
                  {t("resendAll", { count: failedCount })}
                </Button>
              ) : undefined
            }
          />
          <CardBody className="pt-3">
            {outbox.length ? (
              <ul className="divide-y divide-line">
                {outbox.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-caption">
                    <Pill tone={m.status === "sent" ? "safe" : m.status === "failed" ? "risk" : m.status === "queued" ? "warn" : "neutral"}>{t(`status.${m.status as "sent"}`)}</Pill>
                    <span className="min-w-0 flex-1 truncate">
                      <b>{m.subject}</b> <span className="inline-block rtl:-scale-x-100">→</span> <bdi>{m.to}</bdi>
                    </span>
                    <RelativeTime date={m.createdAt} className="text-ink-subtle" />
                    {m.cancelled ? (
                      <span className="text-ink-subtle">{t("campaignCancelled")}</span>
                    ) : m.resendable ? (
                      <Button size="sm" variant="ghost" disabled={resending} onClick={() => resend(m.id)} title={m.error && t.has(`testErrors.${m.error as "send_failed"}`) ? t(`testErrors.${m.error as "send_failed"}`) : undefined}>
                        {t("resend")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{t("outboxEmpty")}</p>
            )}
          </CardBody>
        </Card>
      </div>
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader icon={<Mail />} title={t("test")} description={t("testBody")} />
          <CardBody className="grid gap-3">
            <Field label={t("sendTo")} htmlFor="e-to">
              <Input id="e-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <div>
              <Button
                className="w-full"
                icon={<Send />}
                disabled={!email.host || !to || testing}
                onClick={() =>
                  startTest(async () => {
                    const res = await testEmailAction(to);
                    toast(res.ok ? t("testOk") : res.error === "rateLimited" ? tc("errors.rateLimited") : t("testFailed", { error: t(`testErrors.${(res.error ?? "send_failed") as "send_failed"}`) }), res.ok ? "success" : "error");
                  })
                }
              >
                {t("sendTest")}
              </Button>
              {!email.host ? <p className="mt-2 text-center text-tab text-ink-subtle">{t("saveFirst")}</p> : null}
            </div>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

/* ───────── notifications ───────── */

const KIND_PILLS = [
  ["assignment", Mail],
  ["reminder", AlarmClock],
  ["overdue", CalendarClock],
  ["manager", Users],
  ["welcome", UserPlus],
] as const;

/** Preview of one template paragraph with its **bold**, _italic_ and http(s) links. */
function MarkupText({ text }: { text: string }) {
  return parseEmailMarkup(text).map((tok, i) =>
    tok.kind === "bold" ? (
      <b key={i}>{tok.text}</b>
    ) : tok.kind === "italic" ? (
      <i key={i}>{tok.text}</i>
    ) : tok.kind === "link" ? (
      <a key={i} href={tok.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
        {tok.text}
      </a>
    ) : (
      <Fragment key={i}>{tok.text}</Fragment>
    ),
  );
}

/** The first edited template the server would refuse, so the tab can switch to it and say why. */
function templateProblem(templates: NonNullable<TenantSettings["notifications"]["templates"]>): { kind: TemplateKind; lang: string; field: "subject" | "body"; error: "templateEmpty" | "templateNoLink" } | null {
  for (const [kind, byLang] of Object.entries(templates) as [TemplateKind, Record<string, { subject: string; body: string }> | undefined][]) {
    for (const [lang, tpl] of Object.entries(byLang ?? {})) {
      if (!tpl.subject.trim()) return { kind, lang, field: "subject", error: "templateEmpty" };
      if (!tpl.body.trim()) return { kind, lang, field: "body", error: "templateEmpty" };
      if (!/\{\{\s*link\s*\}\}/.test(tpl.body)) return { kind, lang, field: "body", error: "templateNoLink" };
    }
  }
  return null;
}

/** Sample values for the template preview, in the template's language (not the admin's). */
const PREVIEW_VARS: Record<string, { name: string; to: string; module: string; dueDate: string; person: string; reason: string }> = {
  az: { name: "Aysel", to: "Aysel Hüseynova", module: "Fişinqi tapın", dueDate: "30 oktyabr 2026", person: "Elvin Məmmədov", reason: "Son 30 gündə 2 simulyasiyada riskli addım" },
  en: { name: "Aysel", to: "Aysel Huseynova", module: "Spot the phish", dueDate: "October 30, 2026", person: "Elvin Mammadov", reason: "2 simulations with risky actions in the last 30 days" },
  ru: { name: "Айсель", to: "Айсель Гусейнова", module: "Найдите фишинг", dueDate: "30 октября 2026 г.", person: "Эльвин Мамедов", reason: "2 симуляции с рискованными действиями за 30 дней" },
  tr: { name: "Ayşe", to: "Ayşe Yılmaz", module: "Oltalamayı fark edin", dueDate: "30 Ekim 2026", person: "Mehmet Demir", reason: "Son 30 günde 2 simülasyonda riskli adım" },
  ro: { name: "Ioana", to: "Ioana Popescu", module: "Recunoașteți phishingul", dueDate: "30 octombrie 2026", person: "Andrei Ionescu", reason: "2 simulări cu acțiuni riscante în ultimele 30 de zile" },
  ka: { name: "ნინო", to: "ნინო ბერიძე", module: "ამოიცანით ფიშინგი", dueDate: "30 ოქტომბერი, 2026", person: "გიორგი კაპანაძე", reason: "ბოლო 30 დღეში 2 სიმულაციაში სარისკო ქმედება" },
  uk: { name: "Олена", to: "Олена Коваленко", module: "Розпізнайте фішинг", dueDate: "30 жовтня 2026 р.", person: "Андрій Шевченко", reason: "2 симуляції з ризикованими діями за 30 днів" },
  de: { name: "Anna", to: "Anna Schmidt", module: "Phishing erkennen", dueDate: "30. Oktober 2026", person: "Lukas Müller", reason: "2 Simulationen mit riskanten Aktionen in den letzten 30 Tagen" },
  fr: { name: "Camille", to: "Camille Martin", module: "Repérez l’hameçonnage", dueDate: "30 octobre 2026", person: "Julien Bernard", reason: "2 simulations avec des actions risquées au cours des 30 derniers jours" },
  ar: { name: "سارة", to: "سارة العتيبي", module: "اكتشف رسائل التصيد", dueDate: "30 أكتوبر 2026", person: "محمد القحطاني", reason: "محاكاتان تضمّنتا إجراءات خطرة خلال آخر 30 يومًا" },
};

export function NotificationsTab({ notifications, locales, emailReady, orgName }: { notifications: TenantSettings["notifications"]; locales: string[]; emailReady: boolean; orgName: string }) {
  const t = useTranslations("settings.notifications");
  const { pending, save } = useSave();
  const [n, setN] = useState({ ...notifications });
  const [kind, setKind] = useState<TemplateKind>("assignment");
  const [lang, setLang] = useState(locales[0] ?? "az");
  const [templates, setTemplates] = useState(notifications.templates ?? {});
  const current = templates[kind]?.[lang] ?? DEFAULT_TEMPLATES[kind][lang] ?? DEFAULT_TEMPLATES[kind].en;
  const setCurrent = (patch: Partial<{ subject: string; body: string }>) => setTemplates({ ...templates, [kind]: { ...(templates[kind] ?? {}), [lang]: { ...current, ...patch } } });
  const preview = useMemo(() => {
    const sample = PREVIEW_VARS[lang] ?? PREVIEW_VARS.en;
    const vars: Record<string, string> = { ...sample, link: "https://…", organisation: orgName };
    const fill = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
    return {
      subject: fill(current.subject),
      paragraphs: fill(current.body)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    };
  }, [current, orgName, lang]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  /** Wraps the selection in `before`/`after` (or replaces it), then puts the selection back. */
  const edit = (before: string, after = "", replace = false) => {
    const el = bodyRef.current;
    const body = current.body;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const selected = replace ? "" : body.slice(start, end);
    setCurrent({ body: body.slice(0, start) + before + selected + after + body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-sunken text-ink-muted [&_svg]:size-[1.1rem]">
          <Mail />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-body-sm font-semibold">
            {t("bannerTitle")} <Pill tone={emailReady ? "safe" : "neutral"}>{emailReady ? t("bannerReady") : t("bannerNotSetUp")}</Pill>
          </p>
          <p className="text-caption text-ink-muted">{emailReady ? t("bannerReadyBody") : t("banner")}</p>
        </div>
        <NextLink href="?tab=email" scroll={false} className={textButtonClass()}>
          {t("emailSettings")}
          <ArrowUpRight className="size-4" />
        </NextLink>
      </div>
      <Card>
        <CardHeader title={t("templates")} description={t("templatesBody")} />
        <CardBody className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {KIND_PILLS.map(([k, Icon]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-caption font-semibold pointer-coarse:min-h-11 [&_svg]:size-4",
                  kind === k ? "bg-brand-600 text-brand-on" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink",
                )}
              >
                <Icon aria-hidden />
                {t(`kinds.${k}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid content-start gap-3">
              <Field label={t("language")} htmlFor="n-lang">
                <Select id="n-lang" value={lang} onChange={(e) => setLang(e.target.value)} className="max-w-48">
                  {locales.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_NAMES[l as "az"]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("subject")} htmlFor="n-subject">
                <Input id="n-subject" {...langAttrs(lang)} value={current.subject} onChange={(e) => setCurrent({ subject: e.target.value })} maxLength={200} />
              </Field>
              <Field label={t("message")} htmlFor="n-body">
                <div className="grid gap-1.5">
                  <div role="toolbar" aria-label={t("message")} className="flex gap-0.5">
                    <Button size="icon-sm" variant="ghost" aria-label={t("fmtBold")} title={t("fmtBold")} onClick={() => edit("**", "**")}>
                      <Bold />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("fmtItalic")} title={t("fmtItalic")} onClick={() => edit("_", "_")}>
                      <Italic />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("fmtLink")} title={t("fmtLink")} onClick={() => edit("[", "](https://)")}>
                      <LinkIcon />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={t("fmtParagraph")} title={t("fmtParagraph")} onClick={() => edit("\n\n")}>
                      <Pilcrow />
                    </Button>
                  </div>
                  <Textarea ref={bodyRef} id="n-body" {...langAttrs(lang)} value={current.body} onChange={(e) => setCurrent({ body: e.target.value })} className="min-h-48" maxLength={5000} />
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ["name", t("varName")],
                    ["module", t("varModule")],
                    ["dueDate", t("varDueDate")],
                  ] as const
                ).map(([v, label]) => (
                  <Button key={v} size="sm" variant="secondary" onClick={() => edit(`{{${v}}}`, "", true)}>
                    {label} <code dir="ltr" className="font-mono text-tab text-ink-subtle">{`{{${v}}}`}</code>
                  </Button>
                ))}
                <Button size="sm" variant="secondary" onClick={() => edit("{{link}}", "", true)}>
                  {t("varLink")}
                </Button>
                <TextButton size="tab" className="ms-auto" onClick={() => setCurrent(DEFAULT_TEMPLATES[kind][lang] ?? DEFAULT_TEMPLATES[kind].en)}>
                  {t("resetTemplate")}
                </TextButton>
              </div>
            </div>
            <div>
              <p className="mb-2 text-caption font-semibold text-ink-muted">{t("preview")}</p>
              <div className="rounded-xl border border-line bg-canvas p-4">
                <dl className="grid gap-1 border-b border-line pb-3 text-tab">
                  <div className="flex min-w-0 gap-2">
                    <dt className="shrink-0 text-ink-subtle">{t("previewFrom")}</dt>
                    <dd className="min-w-0 truncate">
                      <span className="font-semibold text-ink">{orgName}</span> <span className="text-ink-subtle">no-reply@…</span>
                    </dd>
                  </div>
                  <div className="flex min-w-0 gap-2">
                    <dt className="shrink-0 text-ink-subtle">{t("previewTo")}</dt>
                    <dd className="min-w-0 truncate font-semibold text-ink">{(PREVIEW_VARS[lang] ?? PREVIEW_VARS.en).to}</dd>
                  </div>
                </dl>
                <p {...langAttrs(lang)} className="mt-3 text-body-sm font-bold">
                  {preview.subject}
                </p>
                <div {...langAttrs(lang)} className="mt-3 grid gap-3 text-caption">
                  {preview.paragraphs.map((p, i) =>
                    /^https?:\/\/\S+$/.test(p) ? (
                      <p key={i}>
                        <span className="inline-flex rounded-pill bg-brand-600 px-4 py-2 font-semibold text-brand-on">{emailButtonLabel(kind, lang)}</span>
                      </p>
                    ) : (
                      <p key={i} className="whitespace-pre-line">
                        <MarkupText text={p} />
                      </p>
                    ),
                  )}
                </div>
                {/* Real emails end with the organisation's name (notify.ts), whatever the template's language. */}
                <p className="mt-4 border-t border-line pt-3 text-tab text-ink-subtle">{orgName}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("reminders")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t("firstReminder")} htmlFor="n-first" hint={t("firstReminderBody")}>
            <Input id="n-first" type="number" min={1} max={60} value={n.firstReminderDays} onChange={(e) => setN({ ...n, firstReminderDays: Number(e.target.value) })} />
          </Field>
          <Field label={t("urgent")} htmlFor="n-urgent" hint={t("urgentBody")}>
            <Input id="n-urgent" type="number" min={1} max={240} value={n.urgentReminderHours} onChange={(e) => setN({ ...n, urgentReminderHours: Number(e.target.value) })} />
          </Field>
          <Switch label={t("overdueNotice")} checked={n.overdueNotice} onChange={(e) => setN({ ...n, overdueNotice: e.target.checked })} className="sm:col-span-2" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("managerAlerts")} description={t("managerAlertsBody")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Switch label={t("alertManagers")} checked={n.managerAlerts} onChange={(e) => setN({ ...n, managerAlerts: e.target.checked })} className="sm:col-span-2" />
          <Field label={t("failedSims")} htmlFor="n-failed" hint={t("failedSimsHint")}>
            <Input id="n-failed" type="number" min={1} max={20} value={n.failedSimulations} onChange={(e) => setN({ ...n, failedSimulations: Number(e.target.value) })} />
          </Field>
          <Field label={t("overdueFor")} htmlFor="n-over" hint={t("overdueForHint")}>
            <Input id="n-over" type="number" min={1} max={90} value={n.overdueDays} onChange={(e) => setN({ ...n, overdueDays: Number(e.target.value) })} />
          </Field>
        </CardBody>
      </Card>
      <SaveBar
        pending={pending}
        onSave={() => {
          // Same rules as the server: a template needs a subject and a message, and the message the {{link}} to the training.
          const problem = templateProblem(templates);
          if (problem) {
            setKind(problem.kind);
            setLang(problem.lang);
            toast(t(problem.error, { kind: t(`kinds.${problem.kind}`), language: LOCALE_NAMES[problem.lang as "az"] ?? problem.lang, token: "{{link}}" }), "error");
            requestAnimationFrame(() => markInvalid(problem.field === "subject" ? "n-subject" : "n-body"));
            return;
          }
          save(
            () =>
            saveNotificationsAction({
              firstReminderDays: n.firstReminderDays,
              urgentReminderHours: n.urgentReminderHours,
              overdueNotice: n.overdueNotice,
              managerAlerts: n.managerAlerts,
              failedSimulations: n.failedSimulations,
              overdueDays: n.overdueDays,
              templates: templates as never,
            }),
            { firstReminderDays: "n-first", urgentReminderHours: "n-urgent", failedSimulations: "n-failed", overdueDays: "n-over" },
          );
        }}
      />
    </div>
  );
}

/* ───────── attestation ───────── */

export function AttestationTab({ texts, locales }: { texts: Record<string, string>; locales: string[] }) {
  const t = useTranslations("settings.attestation");
  const { pending, save } = useSave();
  const [lang, setLang] = useState(locales[0] ?? "az");
  const [value, setValue] = useState(texts[lang] ?? DEFAULT_ATTESTATION[lang] ?? DEFAULT_ATTESTATION.en);
  const isDefault = value.trim() === (DEFAULT_ATTESTATION[lang] ?? "").trim();
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader title={t("title")} description={t("body")} />
        <CardBody className="grid gap-4">
          {isDefault ? <Pill className="w-fit">{t("defaultText")}</Pill> : null}
          <Field label={t("language")} htmlFor="a-lang">
            <Select
              id="a-lang"
              className="max-w-48"
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                setValue(texts[e.target.value] ?? DEFAULT_ATTESTATION[e.target.value] ?? "");
              }}
            >
              {locales.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NAMES[l as "az"]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("text")} htmlFor="a-text">
            <Textarea id="a-text" {...langAttrs(lang)} value={value} onChange={(e) => setValue(e.target.value)} maxLength={600} />
            <p className="text-end text-tab text-ink-subtle tabular-nums">{value.length} / 600</p>
          </Field>
          <SaveBar pending={pending} onSave={() => save(() => saveAttestationAction(lang, value), { text: "a-text" })} />
        </CardBody>
      </Card>
      <aside>
        <p className="mb-2 text-caption font-semibold text-ink-muted">{t("preview")}</p>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-raised">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600 [&_svg]:size-5">
              <PenLine />
            </span>
            <div className="min-w-0">
              <p className="text-body font-bold">{t("confirmModule")}</p>
              <p className="text-caption text-ink-muted">{t("sampleModule")}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-brand-50 p-4 text-body font-semibold">
            <p {...langAttrs(lang)}>{value}</p>
            <PenLine className="mt-3 size-4 text-ink-subtle" />
          </div>
          <span className="mt-4 flex h-12 items-center gap-3 rounded-pill border border-line-strong px-4 text-body font-semibold">
            <span className="size-6 rounded-full border-2 border-line-control" />
            {t("iConfirm")}
          </span>
        </div>
      </aside>
    </div>
  );
}

/* ───────── certificate ───────── */

/** Title and text are written per language (each learner's certificate is in their language); signature and sharing are shared. */
export function CertificateTab({ cert, orgName, logoUrl, locale, locales, verifyHost }: { cert: TenantSettings["certificate"]; orgName: string; logoUrl?: string | null; locale: string; locales: string[]; verifyHost: string }) {
  const t = useTranslations("settings.certificate");
  const tl = useTranslations("learner.certificate");
  const { pending, save } = useSave();
  const [s, setS] = useState({ title: { ...cert.title }, text: { ...cert.text }, signerName: cert.signerName ?? "", signerTitle: cert.signerTitle ?? "", publicLink: cert.publicLink });
  const [lang, setLang] = useState(locales.includes(locale) ? locale : (locales[0] ?? locale));
  const title = s.title[lang] ?? "";
  const own = s.text[lang] ?? "";
  const setText = (value: string) => setS({ ...s, text: { ...s.text, [lang]: value } });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const format = useClientFormat();
  const sampleDate = format.dateTime(new Date(), { day: "numeric", month: "numeric", year: "numeric" });
  const text = (own || DEFAULT_CERTIFICATE_TEXT[lang] || DEFAULT_CERTIFICATE_TEXT.en).replaceAll("{name}", t("sampleName")).replaceAll("{module}", t("sampleModule")).replaceAll("{date}", sampleDate);
  /** Inserts a placeholder where the cursor is in the Text field. */
  const insert = (placeholder: string) => {
    const el = textRef.current;
    const from = el?.selectionStart ?? own.length;
    const to = el?.selectionEnd ?? from;
    setText((own.slice(0, from) + placeholder + own.slice(to)).slice(0, 400));
    el?.focus();
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-5">
        <Card>
          <CardHeader title={t("textTitle")} description={t("textBody")} />
          <CardBody className="grid gap-4">
            {locales.length > 1 ? (
              <Field label={t("language")} htmlFor="c-lang">
                <Select id="c-lang" className="max-w-48" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {locales.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_NAMES[l as "az"] ?? l}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {!title && !own ? <Pill className="w-fit">{t("defaultText")}</Pill> : null}
            <Field label={t("title")} htmlFor="c-title" hint={t("titleHint")}>
              <Input id="c-title" {...langAttrs(lang)} value={title} onChange={(e) => setS({ ...s, title: { ...s.title, [lang]: e.target.value } })} maxLength={60} placeholder={lang === locale ? tl("title") : undefined} />
            </Field>
            <Field label={t("text")} htmlFor="c-text">
              <Textarea ref={textRef} id="c-text" {...langAttrs(lang)} value={own} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder={DEFAULT_CERTIFICATE_TEXT[lang]} />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["{name}", "phName"],
                    ["{module}", "phModule"],
                    ["{date}", "phDate"],
                  ] as const
                ).map(([placeholder, label]) => (
                  <Button key={placeholder} size="sm" variant="secondary" onClick={() => insert(placeholder)}>
                    <code dir="ltr" className="font-mono font-bold">{placeholder}</code> {t(label)}
                  </Button>
                ))}
              </div>
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("signature")} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("signerName")} htmlFor="c-sn">
              <Input id="c-sn" value={s.signerName} onChange={(e) => setS({ ...s, signerName: e.target.value })} />
            </Field>
            <Field label={t("signerTitle")} htmlFor="c-st">
              <Input id="c-st" value={s.signerTitle} onChange={(e) => setS({ ...s, signerTitle: e.target.value })} />
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("sharing")} />
          <CardBody>
            <Switch label={t("publicLink")} description={t("publicLinkBody")} checked={s.publicLink} onChange={(e) => setS({ ...s, publicLink: e.target.checked })} />
          </CardBody>
        </Card>
        <SaveBar pending={pending} onSave={() => save(() => saveCertificateAction(s), { title: "c-title", text: "c-text", signerName: "c-sn", signerTitle: "c-st" })} />
      </div>
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <p className="mb-2 text-caption font-semibold text-ink-muted">{t("preview")}</p>
        <div className="flex overflow-hidden rounded-2xl border border-line bg-surface shadow-raised">
          <div className="flex w-3 flex-col">
            <div className="flex-[3] bg-brand-600" />
            <div className="flex-1 bg-reward-500" />
          </div>
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logoUrl ? <img src={logoUrl} alt="" className="h-10 w-auto max-w-44 shrink-0 object-contain" /> : null}
                <span className="text-caption font-semibold text-ink-muted">{orgName}</span>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-reward-500 text-(--accent-on)">
                <ShieldCheck className="size-6" />
              </span>
            </div>
            <p {...(title ? langAttrs(lang) : {})} className="mt-4 text-tab font-bold tracking-[0.25em] text-brand-600 uppercase">
              {title || tl("title")}
            </p>
            <p className="mt-1 font-display text-headline font-bold">{t("sampleName")}</p>
            <span className="mt-2 block h-1 w-12 rounded-pill bg-reward-500" />
            <p {...langAttrs(lang)} className="mt-3 text-caption text-ink-muted">
              {text}
            </p>
            <Pill tone="brand" className="mt-3">
              {t("sampleModule")}
            </Pill>
            {s.signerName ? (
              <p className="mt-4 text-caption">
                <b className="italic">{s.signerName}</b>
                <span className="block text-ink-subtle">{s.signerTitle}</span>
              </p>
            ) : null}
            <div className="mt-4 grid gap-1 text-caption">
              <p>
                <span className="text-ink-subtle">{t("dateLabel")}</span> {sampleDate}
              </p>
              <p>
                <span className="text-ink-subtle">{t("serialLabel")}</span> {t("sampleSerial")}
              </p>
            </div>
            {s.publicLink ? <p dir="ltr" className="mt-3 font-mono text-tab text-ink-subtle">{verifyHost}/c/…</p> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ───────── learning ───────── */

export function LearningTab({ learning }: { learning: TenantSettings["learning"] }) {
  const t = useTranslations("settings.learning");
  const { pending, save } = useSave();
  const [s, setS] = useState(learning);
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader title={t("timeLimitsTitle")} description={t("timeLimitsCardBody")} />
        <CardBody>
          <Switch label={t("timeLimits")} description={t("timeLimitsBody")} checked={s.timeLimits} onChange={(e) => setS({ ...s, timeLimits: e.target.checked })} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("refresherTitle")} />
        <CardBody className="grid gap-5">
          <Switch label={t("refresher")} description={t("refresherBody")} checked={s.refresher} onChange={(e) => setS({ ...s, refresher: e.target.checked })} />
          <Divider />
          <div className="grid gap-2">
            <div className="flex items-end justify-between gap-3">
              <label htmlFor="l-threshold" className="text-body-sm font-semibold">
                {t("threshold")}
              </label>
              <span className="text-numeral font-bold tabular-nums">{s.riskThreshold}</span>
            </div>
            <input
              id="l-threshold"
              type="range"
              min={50}
              max={90}
              value={s.riskThreshold}
              onChange={(e) => setS({ ...s, riskThreshold: Number(e.target.value) })}
              aria-valuetext={String(s.riskThreshold)}
              aria-describedby="l-threshold-hint"
              className="accent-(--brand)"
              disabled={!s.refresher}
            />
            <div className="flex justify-between text-tab text-ink-subtle">
              <span>50</span>
              <span>90</span>
            </div>
            <p id="l-threshold-hint" className="text-caption text-ink-subtle">
              {t("thresholdHint")}
            </p>
          </div>
          <Divider />
          <Field label={t("dailyGoal")} htmlFor="l-goal" hint={t("dailyGoalBody")}>
            <Input id="l-goal" type="number" min={10} max={500} value={s.dailyGoalXp} onChange={(e) => setS({ ...s, dailyGoalXp: Number(e.target.value) })} className="max-w-40" />
          </Field>
        </CardBody>
      </Card>
      <SaveBar pending={pending} onSave={() => save(() => saveLearningAction(s), { riskThreshold: "l-threshold", dailyGoalXp: "l-goal" })} />
    </div>
  );
}

/* ───────── protection ───────── */

/** Stretches tiny brightness differences so the near-invisible watermark becomes legible. */
function enhanceWatermark(file: File, done: (dataUrl: string) => void) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    // Local contrast: compare each pixel with its neighbour 3 px to the left.
    const out = new Uint8ClampedArray(px.length);
    for (let i = 0; i < px.length; i += 4) {
      const j = Math.max(0, i - 12);
      const d = (px[i] - px[j] + px[i + 1] - px[j + 1] + px[i + 2] - px[j + 2]) * 12;
      const v = Math.max(0, Math.min(255, 128 + d));
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
    ctx.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
    done(canvas.toDataURL("image/png"));
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

export function ProtectionTab({ protection, retention }: { protection: TenantSettings["protection"]; retention: TenantSettings["retention"] }) {
  const t = useTranslations("settings.protection");
  const tc = useTranslations("common");
  const format = useClientFormat();
  const { pending, save } = useSave();
  const kept = useSave();
  const [s, setS] = useState({ ...protection, androidScreenBlock: protection.androidScreenBlock ?? false });
  // Kept as typed: an emptied field is refused by the server instead of silently becoming 0 (keep everything).
  const [r, setR] = useState({ auditMonths: String(retention.auditMonths), learningMonths: String(retention.learningMonths) });
  const months = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const [img, setImg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();

  // A picture pasted anywhere on the tab goes straight to the leak check.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files[0];
      if (f?.type.startsWith("image/")) {
        e.preventDefault();
        enhanceWatermark(f, setImg);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title={t("content")}
          description={t("contentBody")}
          action={
            <Pill tone={s.contentProtection ? "safe" : "neutral"}>
              <Dot tone={s.contentProtection ? "safe" : "neutral"} />
              {tc(s.contentProtection ? "on" : "off")}
            </Pill>
          }
        />
        <CardBody className="grid gap-6">
          <Switch label={t("copying")} description={t("copyingBody")} checked={s.contentProtection} onChange={(e) => setS({ ...s, contentProtection: e.target.checked })} />
          <Switch label={t("watermark")} description={t("watermarkBody")} checked={s.watermark} onChange={(e) => setS({ ...s, watermark: e.target.checked })} />
        </CardBody>
      </Card>
      <SaveBar pending={pending} onSave={() => save(() => saveProtectionAction(s.contentProtection, s.watermark, s.androidScreenBlock))} />
      <Card>
        <CardHeader title={t("leak")} description={t("leakBody")} icon={<KeyRound />} />
        <CardBody className="grid gap-5 md:grid-cols-2">
          <div className="grid content-start gap-3">
            <h3 className="text-body-sm font-semibold text-ink">
              <Step n={1}>{t("step1")}</Step>
            </h3>
            <label
              className="grid min-h-40 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-6 text-center has-focus-visible:ring-4 has-focus-visible:ring-brand-100"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.type.startsWith("image/")) enhanceWatermark(f, setImg);
              }}
            >
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && enhanceWatermark(e.target.files[0], setImg)} />
              <span className="grid justify-items-center gap-2">
                <ImageUp className="size-7 text-brand-600" />
                <span className="max-w-64 text-caption text-ink-muted">{t("dropHint")}</span>
              </span>
            </label>
            {img ? (
              <div>
                <p className="mb-2 text-tab text-ink-muted">{t("enhanced")}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="max-h-96 w-full rounded-lg border border-line object-contain" />
              </div>
            ) : null}
          </div>
          <div className="grid content-start gap-3">
            <h3 className="text-body-sm font-semibold text-ink">
              <Step n={2}>{t("step2")}</Step>
            </h3>
            <Field label={t("code")} htmlFor="p-code">
              <Input id="p-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" className="font-mono" maxLength={9} />
            </Field>
            <Button
              className="w-fit"
              disabled={checking || code.replace(/[^A-Z0-9]/g, "").length !== 8}
              onClick={() =>
                startCheck(async () => {
                  const res = await lookupWatermarkAction(code);
                  setResult(res.ok ? t("found", { name: res.name ?? "", email: res.email ?? "", date: format.dateTime(new Date(res.at!), { dateStyle: "medium", timeStyle: "short" }) }) : t("notFound"));
                })
              }
            >
              {t("check")}
            </Button>
            {result ? <Notice tone="brand">{result}</Notice> : null}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("retention")} description={t("retentionBody")} />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label={t("auditMonths")} htmlFor="p-audit-months" hint={t("auditMonthsHint")}>
            <Input id="p-audit-months" type="number" min={0} max={120} value={r.auditMonths} onChange={(e) => setR({ ...r, auditMonths: e.target.value })} className="max-w-40" />
          </Field>
          <Field label={t("learningMonths")} htmlFor="p-learning-months" hint={t("monthsHint")}>
            <Input id="p-learning-months" type="number" min={0} max={120} value={r.learningMonths} onChange={(e) => setR({ ...r, learningMonths: e.target.value })} className="max-w-40" />
          </Field>
        </CardBody>
      </Card>
      <SaveBar pending={kept.pending} onSave={() => kept.save(() => saveRetentionAction({ auditMonths: months(r.auditMonths), learningMonths: months(r.learningMonths) }), { auditMonths: "p-audit-months", learningMonths: "p-learning-months" })} />
    </div>
  );
}

/* ───────── security ───────── */

/** `allowedUntil`: the live grant's end, formatted on the server (null when there is none or it has passed). */
export function SecurityTab({ allowedUntil }: { allowedUntil: string | null }) {
  const t = useTranslations("settings.security");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>, message: string) => start(async () => void ((await fn()).ok && toast(message, "success")));
  return (
    <Card>
      <CardHeader title={t("title")} description={t("body")} icon={<LifeBuoy />} action={<Pill tone={allowedUntil ? "safe" : "neutral"}>{allowedUntil ? t("activeUntil", { date: allowedUntil }) : t("inactive")}</Pill>} />
      <CardBody className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run(grantSupportAccessAction, t("granted"))}>
          {t("grant")}
        </Button>
        {allowedUntil ? (
          <Button variant="secondary" disabled={pending} onClick={() => run(revokeSupportAccessAction, t("revoked"))}>
            {t("revoke")}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ───────── integrations ───────── */

const RECEIVER_HEADERS = [
  ["X-Cyclowareness-Signature", "hdrSignature"],
  ["X-Cyclowareness-Signature-Timestamped", "hdrTimestamped"],
  ["X-Cyclowareness-Timestamp", "hdrTimestamp"],
  ["X-Cyclowareness-Event", "hdrEvent"],
  ["X-Cyclowareness-Delivery", "hdrDelivery"],
] as const;

export function IntegrationsTab({ integrations, deliveries }: { integrations: IntegrationsView; deliveries: { id: string; event: string; target: string; status: string; responseCode: number | null; createdAt: string }[] }) {
  const t = useTranslations("settings.integrations");
  const tc = useTranslations("common");
  const { pending, save } = useSave();
  const [s, setS] = useState({
    webhookEnabled: integrations.webhookEnabled,
    webhookUrl: integrations.webhookUrl ?? "",
    webhookEvents: integrations.webhookEvents,
    syslogEnabled: integrations.syslogEnabled,
    syslogHost: integrations.syslogHost ?? "",
    syslogPort: integrations.syslogPort ?? SYSLOG_DEFAULT_PORT.tls,
    syslogTransport: integrations.syslogTransport ?? "tls",
    syslogFormat: integrations.syslogFormat ?? "cef",
  });
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const hasSecret = Boolean(integrations.hasWebhookSecret || secret);
  const toggleEvent = (e: string) => setS({ ...s, webhookEvents: s.webhookEvents.includes(e) ? s.webhookEvents.filter((x) => x !== e) : [...s.webhookEvents, e] });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-5">
        <Card>
          <CardHeader icon={<Webhook />} title={t("webhook")} description={t("webhookBody")} />
          <CardBody className="grid gap-4">
            <Pill tone={s.webhookEnabled ? "safe" : "neutral"} className="w-fit">
              {s.webhookEnabled ? tc("on") : tc("off")}
            </Pill>
            <Switch
              label={t("sendEvents")}
              description={hasSecret ? undefined : t("sendEventsHint")}
              checked={s.webhookEnabled}
              disabled={!hasSecret && !s.webhookEnabled}
              onChange={(e) => setS({ ...s, webhookEnabled: e.target.checked })}
            />
            <Field label={t("address")} htmlFor="w-url" hint={t("addressHint")}>
              <Input id="w-url" dir="ltr" value={s.webhookUrl} onChange={(e) => setS({ ...s, webhookUrl: e.target.value })} placeholder="https://siem.example.az/hooks/cyclowareness" />
            </Field>
            <div className="flex flex-wrap items-start gap-3 rounded-xl border border-line p-4">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-ink-muted" />
              <div className="min-w-48 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-body-sm font-semibold">
                  {t("secret")} <Pill tone={hasSecret ? "safe" : "neutral"}>{hasSecret ? t("secretSaved") : tc("notSet")}</Pill>
                </p>
                <p className="mt-0.5 text-caption text-ink-muted">{t("secretBody")}</p>
              </div>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => start(async () => setSecret((await rotateWebhookSecretAction()).secret ?? null))}>
                {t("createSecret")}
              </Button>
            </div>
            {secret ? (
              <Notice tone="warn">
                {t("secretShown")} <code className="font-mono break-all">{secret}</code>
              </Notice>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("syslog")} description={t("syslogBody")} />
          <CardBody className="grid gap-4">
            <Switch label={t("sendEvents")} checked={s.syslogEnabled} onChange={(e) => setS({ ...s, syslogEnabled: e.target.checked })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("server")} htmlFor="s-host">
                <Input id="s-host" dir="ltr" value={s.syslogHost} onChange={(e) => setS({ ...s, syslogHost: e.target.value })} placeholder="siem.example.local" />
              </Field>
              <Field label={t("port")} htmlFor="s-port" hint={t("portHint", { ports: DESTINATION_PORTS.syslog.join(", ") })}>
                <Input id="s-port" type="number" value={s.syslogPort} onChange={(e) => setS({ ...s, syslogPort: Number(e.target.value) })} />
              </Field>
              <Field label={t("transport")} htmlFor="s-tr">
                <Segmented name="tr" ariaLabel={t("transport")} value={s.syslogTransport} onChange={(v) => setS({ ...s, syslogTransport: v as "tls", syslogPort: SYSLOG_DEFAULT_PORT[v as "tls"] })} options={[{ value: "tls", label: "TLS" }, { value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }]} />
              </Field>
              <Field label={t("format")} htmlFor="s-fmt">
                <Segmented name="fmt" ariaLabel={t("format")} value={s.syslogFormat} onChange={(v) => setS({ ...s, syslogFormat: v as "cef" })} options={[{ value: "cef", label: "CEF" }, { value: "json", label: "JSON (RFC 5424)" }]} />
              </Field>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("eventsTitle")} />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((e) => (
              <Checkbox
                key={e}
                label={t(`eventNames.${e.replaceAll(".", "_") as "qr_scanned"}`)}
                description={<code className="font-mono text-tab">{e}</code>}
                checked={s.webhookEvents.includes(e)}
                onChange={() => toggleEvent(e)}
              />
            ))}
          </CardBody>
        </Card>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            icon={<Send />}
            disabled={busy || (!s.webhookUrl && !s.syslogHost)}
            onClick={() =>
              start(async () => {
                const res = await sendTestEventAction();
                toast(res.ok ? t("testQueued") : res.error === "no_target" ? t("testNoTarget") : tc("errors.generic"), res.ok ? "success" : "error");
              })
            }
          >
            {t("sendTest")}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              // Emptied fields go out as "", which tells the server to remove the stored value.
              save(() => saveIntegrationsAction({ ...s, webhookUrl: s.webhookUrl.trim(), syslogHost: s.syslogHost.trim(), webhookEvents: s.webhookEvents as never }), { webhookUrl: "w-url", syslogHost: "s-host", syslogPort: "s-port" })
            }
          >
            {tc("save")}
          </Button>
        </div>
        <Card>
          <CardHeader title={t("deliveries")} />
          <CardBody className="pt-3">
            {deliveries.length ? (
              <ul className="divide-y divide-line">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2 text-caption">
                    <Pill tone={d.status === "delivered" ? "safe" : d.status === "failed" ? "risk" : "warn"}>{t(`status.${d.status as "queued"}`)}</Pill>
                    <code className="font-mono">{d.event}</code>
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{d.target}</span>
                    {d.responseCode ? <span className="text-ink-subtle">HTTP {d.responseCode}</span> : null}
                    <RelativeTime date={d.createdAt} className="ms-auto text-ink-subtle" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-caption text-ink-muted">{t("deliveriesEmpty")}</p>
            )}
          </CardBody>
        </Card>
      </div>
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader icon={<ShieldCheck />} title={t("receiver")} />
          <CardBody className="grid gap-4">
            <dl className="grid gap-3">
              {RECEIVER_HEADERS.map(([header, key]) => (
                <div key={header}>
                  <dt className="font-mono text-caption font-semibold break-all text-ink">{header}</dt>
                  <dd className="text-caption text-ink-muted">{t(key)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-caption text-ink-muted">{t("receiverVerify")}</p>
            <details className="rounded-lg border border-line px-4 py-3">
              <summary className="cursor-pointer text-caption font-semibold text-ink">{t("recipe")}</summary>
              <p className="mt-2 text-caption text-ink-muted">{t("recipeBody")}</p>
            </details>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

