"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, Clock, Compass, Layers, Search, Zap } from "lucide-react";
import { Segmented } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { ModuleIcon } from "@/components/learner/module-icon";
import { Spotlight } from "@/components/ui/light";
import { CATEGORIES, type Category } from "@/lib/domain/catalog";
import { cn } from "@/lib/cn";

export type CatalogCard = {
  slug: string;
  category: Category;
  audiences: string[];
  title: string;
  subtitle: string;
  minutes: number;
  lessons: number;
  xp: number;
  percent: number;
  status: "not_started" | "in_progress" | "awaiting_attestation" | "completed";
  forYou: boolean;
  pathRank: number;
  catalogRank: number;
  custom: boolean;
};

/**
 * Search key that ignores case and accents in every UI language: "insan" finds "İnsan" (İ lowercases to
 * i plus a combining dot, ı folds to i), "е" finds "ё".
 */
const fold = (s: string) => s.toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "");

export function CatalogView({ modules }: { modules: CatalogCard[] }) {
  const t = useTranslations("learner.learn");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"path" | "catalog">("path");
  const [audience, setAudience] = useState<"everyone" | "leaders" | "it">("everyone");
  const [category, setCategory] = useState<"all" | Category>("all");

  const list = useMemo(() => {
    const needle = fold(q.trim());
    return modules
      // "My path" always keeps what is assigned to the person, whatever audience the module is written for.
      .filter((m) => (view === "path" && m.forYou) || m.audiences.includes(audience))
      .filter((m) => category === "all" || m.category === category)
      .filter((m) => !needle || fold(`${m.title} ${m.subtitle}`).includes(needle))
      .sort((a, b) => (view === "path" ? a.pathRank - b.pathRank : a.catalogRank - b.catalogRank));
  }, [modules, q, view, audience, category]);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline font-bold">{t("title")}</h1>
          <p className="mt-1.5 text-body-sm text-ink-muted">{t("count", { count: list.length })}</p>
        </div>
        <label className="relative w-full sm:w-96">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 start-4 size-4.5 -translate-y-1/2 text-ink-subtle" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            className="h-12 w-full rounded-pill border border-line bg-surface pe-4 ps-11 text-body-sm shadow-xs placeholder:text-ink-disabled focus:border-brand-600 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </label>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          name="view"
          ariaLabel={t("view")}
          value={view}
          onChange={(v) => setView(v as "path" | "catalog")}
          options={[
            { value: "path", label: t("myPath") },
            { value: "catalog", label: t("catalog") },
          ]}
        />
        <Segmented
          name="audience"
          ariaLabel={t("audience")}
          value={audience}
          onChange={(v) => setAudience(v as typeof audience)}
          options={[
            { value: "everyone", label: tc("audiences.everyone") },
            { value: "leaders", label: tc("audiences.leaders") },
            { value: "it", label: tc("audiences.it") },
          ]}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t("category")}>
        {(["all", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-4 text-caption font-semibold transition-colors pointer-coarse:h-11",
              category === c ? "bg-ink text-white" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink",
            )}
          >
            {category === c && c === "all" ? <Check className="size-4" /> : null}
            {tc(`categories.${c}`)}
          </button>
        ))}
      </div>

      {list.length ? (
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {list.map((m) => (
            <li key={m.slug}>
              <Link href={`/learn/${m.slug}`} className="group relative isolate flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-raised">
                <Spotlight />
                <ModuleIcon slug={m.slug} category={m.category} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-sm font-semibold">{m.title}</p>
                    {m.custom ? <Pill tone="violet">{t("custom")}</Pill> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-caption text-ink-muted">{m.subtitle}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-tab text-ink-subtle">
                    {m.status === "completed" ? (
                      <Pill tone="safe">
                        <Check />
                        {t("completed")}
                      </Pill>
                    ) : m.status === "awaiting_attestation" ? (
                      <Pill tone="reward">{t("awaiting")}</Pill>
                    ) : m.status === "in_progress" ? (
                      <Pill tone="reward">{t("complete", { percent: m.percent })}</Pill>
                    ) : m.forYou ? (
                      <Pill>
                        <Compass />
                        {t("forYou")}
                      </Pill>
                    ) : null}
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
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-body-sm text-ink-muted">{t("noResults")}</p>
      )}
    </div>
  );
}
