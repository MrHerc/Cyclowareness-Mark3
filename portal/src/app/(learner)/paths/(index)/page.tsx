import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeCheck, ChevronRight, Route, Users, Repeat } from "lucide-react";
import { requireFeature } from "@/server/auth/viewer";
import { getPaths } from "@/server/queries/paths";
import { PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";

export async function generateMetadata() {
  const tr = await getTranslations("learner.paths");
  return { title: tr("title") };
}

export default async function PathsPage() {
  const v = await requireFeature("paths");
  const locale = await getLocale();
  const [tr, paths] = await Promise.all([getTranslations("learner.paths"), getPaths(v, locale)]);
  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("sub")} icon={<Route />} />
      <ul className="grid gap-4 md:grid-cols-2">
        {paths.map((p) => (
          <li key={p.id}>
            <Link href={`/paths/${p.key}`} className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-xs transition-shadow hover:shadow-raised">
              <div className="flex flex-wrap items-center gap-2">
                {p.mandatory ? <Pill tone="risk">{tr("mandatory")}</Pill> : null}
                {p.assigned ? <Pill tone="brand">{tr("assigned")}</Pill> : null}
                {p.certificateToken ? (
                  <Pill tone="safe">
                    <BadgeCheck />
                    {tr("badgeEarned")}
                  </Pill>
                ) : null}
              </div>
              <p className="mt-3 text-title-sm font-bold">{p.title}</p>
              <p className="mt-1 flex-1 text-body-sm text-ink-muted">{p.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-subtle">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" />
                  {p.audience}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Repeat className="size-4" />
                  {p.recurrence}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar decorative value={p.modules.length ? (p.done / p.modules.length) * 100 : 0} tone={p.done === p.modules.length ? "safe" : "brand"} />
                <span className="shrink-0 text-caption font-semibold">{tr("progress", { done: p.done, total: p.modules.length })}</span>
                <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.standards.map((s) => (
                  <span key={s} className="rounded-xs bg-sunken px-2 py-0.5 font-mono text-tab-sm text-ink-muted">
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
