"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Mail, MessageSquareText, Play } from "lucide-react";
import { startDrillAction } from "@/server/actions/drill";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Segmented, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

export type DrillTemplateOption = {
  key: string;
  name: string;
  channel: "email" | "sms";
  difficulty: "Easy" | "Medium" | "Hard";
  harvest: boolean;
  senderName: string;
  senderAddress: string;
  subject: string;
};

type Reach = { all: number; sms: number };

const DIFFICULTY_TONE = { Easy: "safe", Medium: "warn", Hard: "risk" } as const;

export function DrillSetup({
  templates,
  departments,
  audience,
  everyone,
  simHours,
}: {
  templates: DrillTemplateOption[];
  departments: { id: string; name: string }[];
  audience: { all: Reach; departments: Record<string, Reach> };
  everyone: number;
  simHours: number;
}) {
  const t = useTranslations("admin.drill");
  const router = useRouter();
  const id = useId();
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [scope, setScope] = useState<"all" | "department">("all");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [speed, setSpeed] = useState<"quick" | "standard">("quick");
  const { run, pending } = useAction(startDrillAction, { onSuccess: (res) => router.push(`/admin/drill/${res.id}`), errorMap: (res) => t(`errors.${res.reason}`) });
  const tpl = templates.find((x) => x.key === templateKey);
  const reach = scope === "all" ? audience.all : (audience.departments[departmentId] ?? { all: 0, sms: 0 });
  const count = tpl?.channel === "sms" ? reach.sms : scope === "all" ? everyone : reach.all;

  const submit = () => run({ templateKey, audience: scope, departmentId: scope === "department" ? departmentId : null, speed });

  return (
    <Card>
      <CardHeader title={t("setupTitle")} description={t("setupBody")} icon={<Play />} />
      <CardBody className="grid gap-6">
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-caption font-semibold text-ink">{t("scenario")}</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {templates.map((x) => {
              const Icon = x.channel === "sms" ? MessageSquareText : Mail;
              return (
                <label key={x.key} className="relative">
                  <input type="radio" name={`${id}-template`} value={x.key} checked={templateKey === x.key} onChange={() => setTemplateKey(x.key)} className="peer sr-only" />
                  <span
                    className={cn(
                      "flex h-full cursor-pointer flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-line-strong",
                      "peer-checked:border-brand-600 peer-checked:shadow-[0_0_0_1px_var(--color-brand-600)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600 [&_svg]:size-4">
                        <Icon aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-body-sm leading-snug font-semibold text-ink">{x.name}</span>
                    </span>
                    <span className="line-clamp-2 text-caption text-ink-muted italic">{x.subject}</span>
                    <span className="truncate text-tab text-ink-subtle" dir="auto">
                      {t("from", { name: x.senderName })} · <span dir="ltr">{x.senderAddress}</span>
                    </span>
                    <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      <Pill tone={DIFFICULTY_TONE[x.difficulty]}>{t(`difficulty.${x.difficulty}`)}</Pill>
                      <Pill>{t(`channel.${x.channel}`)}</Pill>
                      {x.harvest ? (
                        <Pill tone="neutral">
                          <KeyRound aria-hidden />
                          {t("harvest")}
                        </Pill>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <p id={`${id}-audience`} className="text-caption font-semibold text-ink">
              {t("audience")}
            </p>
            <Segmented
              name={`${id}-scope`}
              ariaLabel={t("audience")}
              value={scope}
              onChange={(value) => setScope(value as "all" | "department")}
              options={[
                { value: "all", label: t("audienceAll") },
                ...(departments.length ? [{ value: "department", label: t("audienceDepartment") }] : []),
              ]}
            />
            {scope === "department" ? (
              <Field label={t("department")} htmlFor={`${id}-department`}>
                <Select id={`${id}-department`} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <p className="text-caption text-ink-muted" aria-live="polite">
              {t("audienceCount", { count })}
            </p>
          </div>
          <div className="grid content-start gap-3">
            <p className="text-caption font-semibold text-ink">{t("speed")}</p>
            <Segmented
              name={`${id}-speed`}
              ariaLabel={t("speed")}
              value={speed}
              onChange={(value) => setSpeed(value as "quick" | "standard")}
              options={[
                { value: "quick", label: t("speeds.quick") },
                { value: "standard", label: t("speeds.standard") },
              ]}
            />
            <p className="text-caption text-ink-muted">{t("speedHint", { hours: simHours })}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button size="lg" icon={<Play />} disabled={pending || !tpl || count === 0} onClick={submit}>
            {pending ? t("starting") : t("start")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
