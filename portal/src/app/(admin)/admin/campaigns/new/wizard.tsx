"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useClientFormat, useOrgTimeZone } from "@/lib/client-format";
import { Building2, Calendar, Check, Clock, Globe, Mail, MessageSquare, Usb } from "lucide-react";
import { saveCampaignAction } from "@/server/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import type { CampaignTemplate, Channel } from "@/lib/campaigns/templates";
import { cn } from "@/lib/cn";
import { fromZonedParts, zonedParts } from "@/lib/baku-clock";

const CHANNELS: { key: Channel; icon: typeof Mail }[] = [
  { key: "email", icon: Mail },
  { key: "sms", icon: MessageSquare },
  { key: "usb", icon: Usb },
];

/** A template as the wizard sees it, named in the viewer's language: the texts stay on the server (wizard-page.tsx). */
export type WizardTemplate = { key: string; name: string; channel: Channel; difficulty: CampaignTemplate["difficulty"] };
/** Previews rendered on the server by template-preview.tsx, by template key. */
export type WizardPreviews = Record<string, { compact: ReactNode; full: ReactNode }>;

/** A draft or scheduled campaign reopened for editing; the wizard starts on the review step. */
export type WizardInitial = { id: string; name: string; templateKey: string; template: WizardTemplate | null; channel: Channel; audience: "all" | "department"; departmentId: string | null; scheduledAt: string | null };

export function CampaignWizard({
  departments,
  smsVoice,
  templates: offered,
  previews,
  initial,
}: {
  departments: { id: string; name: string; people: number }[];
  smsVoice: boolean;
  /** The templates this organisation may send. */
  templates: WizardTemplate[];
  previews: WizardPreviews;
  initial?: WizardInitial;
}) {
  const t = useTranslations("admin.campaigns");
  const tw = useTranslations("admin.campaigns.wizard");
  const tc = useTranslations("common");
  const format = useClientFormat();
  const whenLabel = (d: Date) => format.dateTime(d, { day: "numeric", month: "numeric", year: "numeric", timeStyle: "short" });
  const router = useRouter();
  const [step, setStep] = useState(initial ? 5 : 1);
  const [channel, setChannel] = useState<Channel | null>(initial?.channel ?? null);
  const [templateKey, setTemplateKey] = useState<string | null>(initial?.templateKey ?? null);
  const [audience, setAudience] = useState<"all" | "department" | null>(initial?.audience ?? null);
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "");
  const [when, setWhen] = useState<"later" | "date" | null>(initial ? (initial.scheduledAt ? "date" : "later") : null);
  // The send time is entered in the organisation's time zone, the one it is listed in everywhere, not the browser's.
  const timeZone = useOrgTimeZone();
  const [date, setDate] = useState(() => (initial?.scheduledAt ? zonedParts(initial.scheduledAt, timeZone).date : ""));
  const [time, setTime] = useState(() => (initial?.scheduledAt ? zonedParts(initial.scheduledAt, timeZone).time : "10:00"));
  // Render must stay pure, so the clock is sampled when the schedule inputs change.
  const [now, setNow] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [pending, start] = useTransition();
  const templates = useMemo(() => offered.filter((x) => x.channel === channel), [offered, channel]);
  const tpl = offered.find((x) => x.key === templateKey) ?? (initial?.template?.key === templateKey ? initial.template : null);
  const dept = departments.find((d) => d.id === departmentId);
  const scheduledAt = when === "date" && date ? fromZonedParts(date, time || "10:00", timeZone) : null;

  const canNext = (s: number) =>
    s === 1 ? !!channel : s === 2 ? !!templateKey : s === 3 ? audience === "all" || (audience === "department" && !!departmentId) : s === 4 ? when === "later" || (when === "date" && !!date && !!scheduledAt && scheduledAt.getTime() > now) : true;

  const chips = [
    channel ? { step: 1, label: t("channelLabel"), value: t(`channel.${channel}`) } : null,
    tpl ? { step: 2, label: t("template"), value: tpl.name } : null,
    audience ? { step: 3, label: t("audience"), value: audience === "all" ? t("wholeOrg") : (dept?.name ?? "") } : null,
    when ? { step: 4, label: t("sendTime"), value: when === "later" ? tw("notYet") : scheduledAt ? whenLabel(scheduledAt) : "" } : null,
  ].filter(Boolean) as { step: number; label: string; value: string }[];

  const card = (active: boolean, disabled = false) =>
    cn("flex w-full items-start gap-4 rounded-xl border-2 bg-surface p-4 text-start transition-colors", active ? "border-brand-600 bg-brand-50/60" : "border-line hover:border-brand-300", disabled && "pointer-events-none opacity-50");

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="brand">{tw("step", { current: step })}</Pill>
        {chips.map((c) => (
          <button key={c.step} type="button" onClick={() => setStep(c.step)} className="rounded-pill bg-sunken px-3 py-1 text-tab font-semibold text-ink-muted hover:text-ink pointer-coarse:min-h-11">
            <span className="text-ink-subtle">{c.label}</span> <span className="text-ink">{c.value}</span>
          </button>
        ))}
      </div>

      {step === 1 ? (
        <section className="grid gap-3">
          <h2 className="text-title font-bold">{tw("q1")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHANNELS.map(({ key, icon: Icon }) => {
              const disabled = key === "sms" && !smsVoice;
              return (
                <button key={key} type="button" className={card(channel === key, disabled)} onClick={() => (setChannel(key), setTemplateKey(null))}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">{t(`channel.${key}`)}</span>
                    <span className="block text-caption text-ink-muted">{t(`channelBody.${key}`)}</span>
                    <span className="mt-1 block text-tab text-ink-subtle">{t("templates", { count: offered.filter((x) => x.channel === key).length })}</span>
                  </span>
                  {channel === key ? <Check className="size-5 text-brand-600" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="grid gap-3">
          <h2 className="text-title font-bold">{tw("q2")}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {templates.map((x) => (
              <button key={x.key} type="button" className={card(templateKey === x.key)} onClick={() => setTemplateKey(x.key)}>
                <span className="grid min-w-0 flex-1 gap-2">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold">{x.name}</span>
                    <Pill tone={x.difficulty === "Easy" ? "safe" : x.difficulty === "Medium" ? "warn" : "risk"}>{t("difficulty", { level: tc(`difficulty.${x.difficulty}`) })}</Pill>
                  </span>
                  {previews[x.key].compact}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="grid gap-3">
          <h2 className="text-title font-bold">{tw("q3")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={card(audience === "all")} onClick={() => setAudience("all")}>
              <Globe className="mt-0.5 size-5 text-brand-600" />
              <span>
                <span className="block text-body-sm font-semibold">{t("wholeOrg")}</span>
                <span className="block text-caption text-ink-muted">{tw("wholeOrgBody")}</span>
              </span>
            </button>
            <button type="button" className={card(audience === "department")} onClick={() => setAudience("department")}>
              <Building2 className="mt-0.5 size-5 text-brand-600" />
              <span>
                <span className="block text-body-sm font-semibold">{tw("oneDepartment")}</span>
                <span className="block text-caption text-ink-muted">{tw("oneDepartmentBody")}</span>
              </span>
            </button>
          </div>
          {audience === "department" ? (
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="max-w-sm" aria-label={tw("oneDepartment")}>
              <option value="">{tw("pickDepartment")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.people})
                </option>
              ))}
            </Select>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid gap-3">
          <h2 className="text-title font-bold">{tw("q4")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={card(when === "later")} onClick={() => setWhen("later")}>
              <Clock className="mt-0.5 size-5 text-brand-600" />
              <span>
                <span className="block text-body-sm font-semibold">{tw("notYet")}</span>
                <span className="block text-caption text-ink-muted">{tw("notYetBody")}</span>
              </span>
            </button>
            <button type="button" className={card(when === "date")} onClick={() => setWhen("date")}>
              <Calendar className="mt-0.5 size-5 text-brand-600" />
              <span>
                <span className="block text-body-sm font-semibold">{tw("onDate")}</span>
                <span className="block text-caption text-ink-muted">{tw("onDateBody")}</span>
              </span>
            </button>
          </div>
          {when === "date" ? (
            <div className="flex flex-wrap gap-3">
              <Field label={tw("date")} htmlFor="w-date">
                <Input id="w-date" type="date" value={date} onChange={(e) => (setDate(e.target.value), setNow(Date.now()))} className="w-48" />
              </Field>
              <Field label={tw("time")} htmlFor="w-time" hint={tc("time.zone", { zone: timeZone })}>
                <Input id="w-time" type="time" value={time} onChange={(e) => (setTime(e.target.value), setNow(Date.now()))} className="w-36" aria-describedby="w-time-hint" />
              </Field>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 5 && tpl ? (
        <section className="grid gap-4">
          <h2 className="text-title font-bold">{tw("q5")}</h2>
          <Field label={tw("name")} htmlFor="w-name" hint={tw("nameHint")}>
            <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} className="max-w-lg" placeholder={tpl.name} />
          </Field>
          <dl className="grid gap-2 rounded-xl border border-line bg-surface p-4 text-body-sm">
            {[
              [t("channelLabel"), t(`channel.${tpl.channel}`), 1],
              [t("template"), tpl.name, 2],
              [t("audience"), audience === "all" ? t("wholeOrg") : (dept?.name ?? ""), 3],
              [t("sendTime"), when === "later" ? tw("notYet") : scheduledAt ? whenLabel(scheduledAt) : "", 4],
            ].map(([k, val, s]) => (
              <div key={String(s)} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="flex min-w-0 items-center gap-3 text-end font-semibold">
                  <span className="min-w-0 break-words">{val}</span>
                  <button type="button" className="-mx-2 inline-flex min-h-10 shrink-0 items-center px-2 text-tab text-brand-600 hover:underline" onClick={() => setStep(Number(s))}>
                    {tw("change")}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          {previews[tpl.key].full}
          <p className="text-caption text-ink-muted">{when === "date" ? tw("scheduledNote") : tw("draftNote")}</p>
        </section>
      ) : null}

      <div className="flex justify-between gap-3 border-t border-line pt-4">
        <Button variant="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>
          {tw("back")}
        </Button>
        {step < 5 ? (
          <Button disabled={!canNext(step)} onClick={() => setStep(step + 1)}>
            {tw("next")}
          </Button>
        ) : (
          <Button
            disabled={pending || !tpl}
            onClick={() =>
              start(async () => {
                const res = await saveCampaignAction({
                  id: initial?.id,
                  name: name.trim() || tpl!.name,
                  templateKey: tpl!.key,
                  audience: audience ?? "all",
                  departmentId: audience === "department" ? departmentId : null,
                  scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
                });
                if (res.ok && res.id) {
                  toast(tw("saved"));
                  router.push(`/admin/campaigns/${res.id}`);
                } else if (res.reason === "past_date") {
                  // The planned time passed while the wizard was open: back to the schedule step.
                  toast(tw("pastDate"), "error");
                  setNow(Date.now());
                  setStep(4);
                } else toast(tc("errors.invalid"), "error");
              })
            }
          >
            {initial ? tw("update") : when === "date" ? tw("schedule") : tw("save")}
          </Button>
        )}
      </div>
    </div>
  );
}
