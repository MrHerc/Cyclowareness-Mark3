import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { localizeStandard } from "@/lib/standards";
import { Award, Check, ChevronRight, Lock, Repeat, Route, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { moduleIcon } from "@/components/learner/module-icon";
import { cn } from "@/lib/cn";
import { pathForPage } from "./path";

export async function generateMetadata({ params }: PageProps<"/paths/[key]">) {
  const { p } = await pathForPage((await params).key);
  return { title: p.title };
}

export default async function PathPage({ params }: PageProps<"/paths/[key]">) {
  const [{ p }, tr, tc, tl] = await Promise.all([
    pathForPage((await params).key),
    getTranslations("learner.paths"),
    getTranslations("common"),
    getTranslations("learner.learn"),
  ]);
  const locale = await getLocale();
  const firstOpen = p.modules.find((m) => m.status !== "completed");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <PageHeader title={p.title} subtitle={p.description} icon={<Route />} back={{ href: "/paths", label: tr("back") }} />
        <h2 className="mb-4 text-title-sm font-semibold">{tr("roadmap")}</h2>
        <ol className="relative grid gap-3">
          <span aria-hidden className="absolute top-6 bottom-6 left-[1.4rem] w-0.5 bg-line" />
          {p.modules.map((m, i) => {
            const Icon = moduleIcon(m.slug, m.category);
            const done = m.status === "completed";
            const current = firstOpen?.slug === m.slug;
            return (
              <li key={m.slug} className="relative flex gap-4">
                <span className={cn("relative z-10 mt-3 grid size-11 shrink-0 place-items-center rounded-full border-2", done ? "border-safe-500 bg-safe-500 text-white" : current ? "border-reward-500 bg-reward-500 text-(--accent-on)" : "border-line-strong bg-surface text-ink-subtle")}>
                  {done ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
                </span>
                <Link href={`/learn/${m.slug}`} className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-surface p-4 shadow-xs hover:shadow-raised", current ? "border-reward-400 ring-2 ring-reward-200" : "border-line")}>
                  <div className="min-w-0 flex-1">
                    <p className="text-tab font-semibold text-ink-subtle">
                      {i + 1}. {tc(`categories.${m.category}`)}
                    </p>
                    <p className="text-body-sm font-semibold">{m.title}</p>
                    <ProgressBar value={m.percent} size="sm" tone={done ? "safe" : "reward"} className="mt-2 max-w-48" label={tl("moduleProgress", { title: m.title })} />
                  </div>
                  <ChevronRight className="size-5 text-ink-subtle" />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      <aside className="grid content-start gap-4 lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)] lg:self-start">
        <Card className="p-5">
          <p className="text-caption font-semibold text-ink-muted">{tr("progress", { done: p.done, total: p.modules.length })}</p>
          <ProgressBar decorative value={p.modules.length ? (p.done / p.modules.length) * 100 : 0} className="mt-2" />
          {firstOpen ? (
            <ButtonLink href={`/learn/${firstOpen.slug}`} className="mt-4 w-full">
              {tc("continue")}
            </ButtonLink>
          ) : null}
          <dl className="mt-5 grid gap-3 text-caption">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 text-ink-subtle" />
              <div>
                <dt className="text-ink-muted">{tr("audience")}</dt>
                <dd className="font-semibold">{p.audience}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Repeat className="mt-0.5 size-4 text-ink-subtle" />
              <div>
                <dt className="text-ink-muted">{tr("recurrence")}</dt>
                <dd className="font-semibold">{p.recurrence}</dd>
              </div>
            </div>
          </dl>
          {p.mandatory ? <Pill tone="risk" className="mt-4">{tr("mandatory")}</Pill> : null}
        </Card>
        <Card>
          <CardHeader title={tr("standards")} />
          <CardBody className="flex flex-wrap gap-1.5 pt-3">
            {p.standards.map((s) => (
              <span key={s} className="rounded-xs bg-sunken px-2 py-1 font-mono text-tab text-ink">
                {localizeStandard(s, locale)}
              </span>
            ))}
          </CardBody>
        </Card>
        <Card className="p-5 text-center">
          <span className={cn("mx-auto grid size-16 place-items-center rounded-full", p.certificateToken ? "bg-reward-500 text-(--accent-on) shadow-raised" : "bg-sunken text-ink-disabled")}>
            {p.certificateToken ? <Award className="size-8" /> : <Lock className="size-7" />}
          </span>
          <p className="mt-3 text-body-sm font-semibold">{tr("badge")}</p>
          <p className="mt-1 text-caption text-ink-muted">{p.certificateToken ? tr("badgeEarned") : tr("badgeLocked")}</p>
          {p.certificateToken ? (
            <ButtonLink href={`/c/${p.certificateToken}`} size="sm" variant="secondary" className="mt-3">
              {tc("view")}
            </ButtonLink>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}
