"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Check, ChevronDown, ChevronRight, Clock, Compass, Layers, Zap } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { moduleIcon } from "@/components/learner/module-icon";
import type { Category } from "@/lib/domain/catalog";
import { cn } from "@/lib/cn";

export type PathItem = {
  slug: string;
  category: Category;
  title: string;
  subtitle: string;
  minutes: number;
  lessons: number;
  xp: number;
  percent: number;
  status: "not_started" | "in_progress" | "awaiting_attestation" | "completed";
  assigned: boolean;
  due: string | null;
  current: boolean;
};

const VISIBLE = 4;

/** Vertical "Your path" timeline from the original Home page. */
export function PathTimeline({ items }: { items: PathItem[] }) {
  const t = useTranslations("learner.home");
  const tc = useTranslations("common");
  const format = useFormatter();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, VISIBLE);
  return (
    <div>
      <ol className="relative grid gap-3">
        <span aria-hidden className="absolute top-6 bottom-6 left-[1.4rem] border-l-2 border-dashed border-line-strong" />
        {shown.map((m) => {
          const Icon = moduleIcon(m.slug, m.category);
          const done = m.status === "completed";
          return (
            <li key={m.slug} className="relative flex gap-4">
              <span
                className={cn(
                  "relative z-10 mt-3 grid size-11 shrink-0 place-items-center rounded-full border-2",
                  done ? "border-safe-500 bg-safe-500 text-white" : m.current ? "border-reward-500 bg-reward-500 text-(--accent-on)" : "border-line-strong bg-surface text-ink-subtle",
                )}
              >
                {done ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
              </span>
              <Link
                href={`/learn/${m.slug}`}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-4 transition-shadow",
                  m.current ? "border-reward-400 bg-surface shadow-xs ring-2 ring-reward-200 hover:shadow-raised" : "border-transparent hover:bg-surface",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold">{m.title}</p>
                  <p className="text-caption text-ink-muted">{m.subtitle}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-tab text-ink-subtle">
                    {done ? (
                      <Pill tone="safe">
                        <Check />
                      </Pill>
                    ) : m.status === "in_progress" || m.status === "awaiting_attestation" ? (
                      <Pill tone="reward">{t("complete", { percent: m.percent })}</Pill>
                    ) : m.assigned ? (
                      <Pill tone="brand">{t("assigned")}</Pill>
                    ) : (
                      <Pill>
                        <Compass />
                        {t("forYou")}
                      </Pill>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {tc("units.min", { count: m.minutes })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3.5" />
                      {tc("units.lessons", { count: m.lessons })}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-reward-ink">
                      <Zap className="size-3.5 fill-current" />
                      {tc("units.xp", { count: m.xp })}
                    </span>
                    {m.due && !done ? (
                      <span className={cn("font-semibold", m.due < new Date().toISOString().slice(0, 10) ? "text-risk-600" : "text-ink-muted")}>
                        {tc("time.due", { date: format.dateTime(new Date(`${m.due}T12:00:00`), { day: "numeric", month: "short" }) })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
              </Link>
            </li>
          );
        })}
      </ol>
      {items.length > VISIBLE ? (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-3 text-caption font-semibold text-ink shadow-xs hover:bg-sunken"
        >
          <ChevronDown className={cn("size-4 transition-transform", all && "rotate-180")} />
          {all ? tc("showLess") : t("showAll", { count: items.length })}
        </button>
      ) : null}
    </div>
  );
}
