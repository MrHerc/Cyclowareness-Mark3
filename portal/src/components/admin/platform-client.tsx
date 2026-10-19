"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Copy, Globe2, KeyRound, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { adminLinkAction, createTenantAction, deleteDemoAction, renameTenantAction, setDemoStatusAction, setTenantFeatureAction, setTenantPlanAction, verifyTenantDomainAction } from "@/server/actions/platform";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { LOCALES, LOCALE_NAMES } from "@/i18n/config";
import { cn } from "@/lib/cn";

const PLANS = ["essentials", "professional", "enterprise_hrm"] as const;

function CopyLink({ link }: { link: string }) {
  const tc = useTranslations("common");
  return (
    <div className="flex gap-2">
      <Input readOnly value={link} className="font-mono text-tab" onFocus={(e) => e.currentTarget.select()} />
      <Button variant="secondary" size="icon" aria-label={tc("copy")} onClick={() => navigator.clipboard.writeText(link).then(() => toast(tc("copied")))}>
        <Copy />
      </Button>
    </div>
  );
}

export function NewTenant() {
  const t = useTranslations("admin.platform");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", slug: "", plan: "enterprise_hrm" as (typeof PLANS)[number], locale: "az" as (typeof LOCALES)[number], adminName: "", adminEmail: "" });
  const close = () => {
    setOpen(false);
    setLink(null);
    setF({ name: "", slug: "", plan: "enterprise_hrm", locale: "az", adminName: "", adminEmail: "" });
  };
  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        {t("newTenant")}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t("newTenant")}
        size="lg"
        footer={
          link ? (
            <Button onClick={close}>{tc("done")}</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button
                disabled={pending || f.name.trim().length < 2 || f.slug.length < 3 || !f.adminEmail.includes("@") || f.adminName.trim().length < 2}
                onClick={() =>
                  start(async () => {
                    const res = await createTenantAction(f);
                    if (!res.ok) return toast(res.error === "taken" ? t("slugTaken") : tc("errors.invalid"), "error");
                    setLink(res.link ?? null);
                  })
                }
              >
                {t("create")}
              </Button>
            </>
          )
        }
      >
        {link ? (
          <div className="grid gap-3">
            <Notice tone="safe">{t("createdLink")}</Notice>
            <CopyLink link={link} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="nt-name">
              <Input
                id="nt-name"
                value={f.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const auto = autoSlug(name);
                  setF({ ...f, name, slug: f.slug && f.slug !== autoSlug(f.name) ? f.slug : auto });
                }}
                maxLength={120}
              />
            </Field>
            <Field label={t("slug")} htmlFor="nt-slug" hint={t("slugHint")}>
              <Input id="nt-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} maxLength={40} className="font-mono" />
            </Field>
            <Field label={t("plan")} htmlFor="nt-plan">
              <Select id="nt-plan" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as typeof f.plan })}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {t(`plans.${p}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("language")} htmlFor="nt-lang">
              <Select id="nt-lang" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value as typeof f.locale })}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("adminName")} htmlFor="nt-an">
              <Input id="nt-an" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} maxLength={120} />
            </Field>
            <Field label={t("adminEmail")} htmlFor="nt-ae">
              <Input id="nt-ae" type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} maxLength={254} />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}

function autoSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ə/g, "e")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function TenantControls({
  tenantId,
  name,
  domain,
  domainVerifiedAt,
  plan,
  overrides,
  planFeatures,
  allFeatures,
  admins,
}: {
  tenantId: string;
  name: string;
  domain: string | null;
  domainVerifiedAt: string | null;
  plan: (typeof PLANS)[number];
  overrides: Record<string, boolean>;
  planFeatures: string[];
  allFeatures: string[];
  admins: { id: string; name: string; email: string }[];
}) {
  const t = useTranslations("admin.platform");
  const tc = useTranslations("common");
  const format = useFormatter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"features" | "link" | "rename" | "domain" | null>(null);
  const [adminId, setAdminId] = useState(admins[0]?.id ?? "");
  const [link, setLink] = useState<string | null>(null);
  const [newName, setNewName] = useState(name);
  const [host, setHost] = useState(domain ?? "");
  const [force, setForce] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label={t("plan")} className="h-9 w-44" value={plan} disabled={pending} onChange={(e) => start(async () => void ((await setTenantPlanAction(tenantId, e.target.value)).ok && toast(t("saved"))))}>
        {PLANS.map((p) => (
          <option key={p} value={p}>
            {t(`plans.${p}`)}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="secondary" icon={<SlidersHorizontal />} onClick={() => setMode("features")}>
        {t("features")}
      </Button>
      <Button size="sm" variant="secondary" icon={<KeyRound />} onClick={() => setMode("link")}>
        {t("adminLink")}
      </Button>
      <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => (setNewName(name), setMode("rename"))}>
        {t("rename")}
      </Button>
      <Button size="sm" variant="secondary" icon={<Globe2 />} onClick={() => (setHost(domain ?? ""), setForce(false), setMode("domain"))}>
        {t("domain")}
      </Button>
      <Dialog
        open={mode === "rename"}
        onClose={() => setMode(null)}
        title={t("rename")}
        description={t("renameBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || newName.trim().length < 2}
              onClick={() =>
                start(async () => {
                  const res = await renameTenantAction(tenantId, newName);
                  if (!res.ok) return toast(tc("errors.invalid"), "error");
                  toast(t("renamed"));
                  setMode(null);
                })
              }
            >
              {tc("save")}
            </Button>
          </>
        }
      >
        <Field label={t("newName")} htmlFor={`rn-${tenantId}`}>
          <Input id={`rn-${tenantId}`} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} />
        </Field>
      </Dialog>
      <Dialog
        open={mode === "domain"}
        onClose={() => setMode(null)}
        title={t("domain")}
        description={t("domainBody")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || !host.trim()}
              onClick={() =>
                start(async () => {
                  const res = await verifyTenantDomainAction(tenantId, host, force);
                  if (!res.ok) return toast(tc("errors.invalid"), "error");
                  if (!res.verified) return toast(t("notFound"), "error");
                  toast(t("verified"));
                  setMode(null);
                })
              }
            >
              {t("verify")}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t("domainField")} htmlFor={`dm-${tenantId}`} hint={domainVerifiedAt ? t("domainVerified", { date: format.dateTime(new Date(domainVerifiedAt), { dateStyle: "medium" }) }) : t("domainUnverified")}>
            <Input id={`dm-${tenantId}`} value={host} onChange={(e) => setHost(e.target.value)} placeholder="agency.gov.az" maxLength={253} className="font-mono" />
          </Field>
          <Checkbox label={t("force")} checked={force} onChange={(e) => setForce(e.target.checked)} />
          <p className="text-caption text-ink-muted">{t("forceHint")}</p>
        </div>
      </Dialog>
      <Dialog open={mode === "features"} onClose={() => setMode(null)} title={t("features")} description={t("featuresBody")} size="lg">
        <ul className="grid gap-2 sm:grid-cols-2">
          {allFeatures.map((f) => {
            const state = f in overrides ? (overrides[f] ? "on" : "off") : "default";
            const inPlan = planFeatures.includes(f);
            return (
              <li key={f} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <span className="min-w-0 flex-1 text-caption">
                  <b className="block truncate">{t(`featureNames.${f}` as "featureNames.learning")}</b>
                  <span className={cn("text-tab", inPlan ? "text-safe-700" : "text-ink-subtle")}>
                    {t(`featureState.default`)}: {inPlan ? t("featureState.on") : t("featureState.off")}
                  </span>
                </span>
                <Select aria-label={t(`featureNames.${f}` as "featureNames.learning")} className="h-9 w-36" value={state} disabled={pending} onChange={(e) => start(async () => void ((await setTenantFeatureAction(tenantId, f, e.target.value as "on")).ok && toast(t("saved"))))}>
                  {(["default", "on", "off"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`featureState.${s}`)}
                    </option>
                  ))}
                </Select>
              </li>
            );
          })}
        </ul>
      </Dialog>
      <Dialog
        open={mode === "link"}
        onClose={() => {
          setMode(null);
          setLink(null);
        }}
        title={t("adminLink")}
        description={t("adminLinkBody")}
        footer={
          !link && admins.length ? (
            <Button
              disabled={pending || !adminId}
              onClick={() =>
                start(async () => {
                  const res = await adminLinkAction(tenantId, adminId);
                  if (!res.ok) return toast(tc("errors.generic"), "error");
                  setLink(res.link ?? null);
                })
              }
            >
              {t("makeLink")}
            </Button>
          ) : null
        }
      >
        {!admins.length ? (
          <p className="text-caption text-ink-muted">{t("noAdmins")}</p>
        ) : link ? (
          <div className="grid gap-2">
            <p className="text-caption font-semibold">{t("linkReady")}</p>
            <CopyLink link={link} />
          </div>
        ) : (
          <Field label={t("pickAdmin")} htmlFor={`adm-${tenantId}`}>
            <Select id={`adm-${tenantId}`} value={adminId} onChange={(e) => setAdminId(e.target.value)}>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.email}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Dialog>
    </div>
  );
}

export function DemoRowActions({ id, status }: { id: string; status: "new" | "contacted" | "won" | "lost" }) {
  const t = useTranslations("admin.platform.demo");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Select aria-label={tc("status")} className="h-9 w-40" value={status} disabled={pending} onChange={(e) => start(async () => void (await setDemoStatusAction(id, e.target.value)))}>
        {(["new", "contacted", "won", "lost"] as const).map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </Select>
      <Button size="icon-sm" variant="ghost" aria-label={t("delete")} onClick={() => setConfirm(true)}>
        <Trash2 />
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("delete")}
        description={t("deleteBody")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => start(async () => void ((await deleteDemoAction(id)).ok && (toast(t("deleted")), setConfirm(false))))}>
              {t("delete")}
            </Button>
          </>
        }
      />
    </div>
  );
}
