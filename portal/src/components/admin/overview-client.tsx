"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, Check, Circle } from "lucide-react";
import { hideSetupAction, remindAwaitingAction, skipSetupStepAction } from "@/server/actions/admin-overview";
import { TextButton, textLinkClass } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Ring } from "@/components/ui/progress";
import { Pill } from "@/components/ui/pill";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

export function DepartmentFilter({ departments, label }: { departments: { id: string; name: string }[]; label: string }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <Select
        className="h-10 w-56"
        value={sp.get("d") ?? ""}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          if (e.target.value) q.set("d", e.target.value);
          else q.delete("d");
          router.push(`?${q.toString()}`, { scroll: false });
        }}
      >
        <option value="">{tc("allDepartments")}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

type Step = { key: string; done: boolean; href: string; skippable?: boolean; optional?: boolean };

export function SetupGuide({ steps, skipped, canEdit }: { steps: Step[]; skipped: string[]; canEdit: boolean }) {
  const t = useTranslations("admin.overview");
  const hide = useAction(hideSetupAction);
  const skip = useAction(skipSetupStepAction);
  const pending = hide.pending || skip.pending;
  const counted = steps.filter((s) => !s.optional);
  const done = counted.filter((s) => s.done || skipped.includes(s.key)).length;
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Ring value={done / counted.length} size={64} stroke={7} tone="brand" label={t("setupDone", { done, total: counted.length })}>
          <span className="text-caption font-bold">
            {done}/{counted.length}
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <h2 className="text-title-sm font-bold">{t("setupTitle")}</h2>
          <p className="text-caption text-ink-muted">{t("setupDone", { done, total: counted.length })}</p>
        </div>
        {canEdit ? (
          <button type="button" disabled={pending} onClick={() => hide.run(true)} className="rounded-pill px-3 py-1.5 text-caption font-semibold text-ink-muted hover:bg-sunken pointer-coarse:min-h-11">
            {t("hide")}
          </button>
        ) : null}
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        {steps.map((s) => {
          const isSkipped = skipped.includes(s.key);
          const ok = s.done || isSkipped;
          return (
            <li key={s.key} className={cn("flex items-start gap-3 rounded-lg border p-3.5", ok ? "border-line bg-sunken/50" : "border-line bg-surface")}>
              {ok ? <Check className="mt-0.5 size-5 shrink-0 rounded-full bg-safe-500 p-0.5 text-white" strokeWidth={3} /> : <Circle className="mt-0.5 size-5 shrink-0 text-line-strong" />}
              <div className="min-w-0 flex-1">
                <Link href={s.href} className={textLinkClass(cn("block text-body-sm font-semibold hover:underline", ok && "text-ink-muted"))}>
                  {t(`setup.${s.key as "people"}.title`)}
                </Link>
                <p className="text-tab text-ink-subtle">{t(`setup.${s.key as "people"}.body`)}</p>
                {s.skippable && !ok && canEdit ? (
                  <TextButton size="tab" className="mt-1" disabled={pending} onClick={() => skip.run(s.key)}>
                    {t("markNotNeeded")}
                  </TextButton>
                ) : null}
              </div>
              <Pill tone={s.done ? "safe" : isSkipped ? "neutral" : s.optional ? "neutral" : "warn"}>{s.done ? t("done") : isSkipped ? t("notNeeded") : s.optional ? t("optional") : t("todo")}</Pill>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RemindButton({ moduleId, moduleTitle, count }: { moduleId: string; moduleTitle: string; count: number }) {
  const t = useTranslations("admin.overview");
  const { run, pending } = useAction(remindAwaitingAction, { successToast: (res) => t("reminded", { count: res.count }) });
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("remindWaiting", { module: moduleTitle })}
      title={t("remindWaiting", { module: moduleTitle })}
      onClick={() => run(moduleId)}
      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-caption font-semibold text-reward-ink hover:bg-reward-100 pointer-coarse:min-h-11"
    >
      <Bell className="size-3.5" />
      {t("waitingPeople", { count })}
    </button>
  );
}

