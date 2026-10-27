import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { localizeStandard } from "@/lib/standards";
import { Award, CalendarClock, Check, ChevronRight, Clock, Layers, Lock, Repeat, Route, Users, Zap } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { moduleIcon } from "@/components/learner/module-icon";
import { LAB_ICON } from "@/components/learner/lab-visual";
import { LAB_XP } from "@/lib/domain/gamification";
import { todayInBaku } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { CatalogModule } from "@/server/queries/catalog";
import { pathForPage } from "./path";

export async function generateMetadata({ params }: PageProps<"/paths/[key]">) {
  const { p } = await pathForPage((await params).key);
  return { title: p.title };
}

export default async function PathPage({ params }: PageProps<"/paths/[key]">) {
  const [{ p }, tr, tc, tl, tm, tlab, format] = await Promise.all([
    pathForPage((await params).key),
    getTranslations("learner.paths"),
    getTranslations("common"),
    getTranslations("learner.learn"),
    getTranslations("learner.module"),
    getTranslations("learner.lab"),
    getFormatter(),
  ]);
  const locale = await getLocale();
  const firstOpen = p.modules.find((m) => m.status !== "completed");
  // The module page links back here and offers the next module of this path.
  const from = `from=${encodeURIComponent(`/paths/${p.key}`)}`;
  // A module whose lessons are all done waits for its confirmation: its row and Continue open the confirm dialog.
  const moduleHref = (m: CatalogModule) => `/learn/${m.slug}?${from}${m.status === "awaiting_attestation" ? "&confirm=1" : ""}`;
  const today = todayInBaku();
  const day = (d: string) => format.dateTime(new Date(`${d}T12:00:00+04:00`), { day: "numeric", month: "long" });
  const titleOf = new Map(p.modules.map((m) => [m.slug, m.title]));
  const labsPassed = p.labs.filter((l) => l.passed).length;
  // Once every module is done, Continue goes on to the first open lab that is not passed yet.
  const nextLab = firstOpen ? undefined : p.labs.find((l) => l.unlocked && !l.passed);
  const minutes = p.modules.reduce((n, m) => n + m.minutes, 0);
  const lessons = p.modules.reduce((n, m) => n + m.lessons.length, 0);
  const xp = p.modules.reduce((n, m) => n + m.xp, 0);
  const overdue = !!p.due && p.due < today && p.done < p.modules.length;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <PageHeader title={p.title} subtitle={p.description} icon={<Route />} back={{ href: "/paths", label: tr("back") }} />
        <h2 className="mb-4 text-title-sm font-semibold">{tr("roadmap")}</h2>
        <h3 className="mb-3 text-body font-semibold">{tr("lessonsHeading")}</h3>
        <ol className="relative grid gap-3">
          <span aria-hidden className="absolute top-6 bottom-6 start-[1.4rem] w-0.5 bg-line" />
          {p.modules.map((m, i) => {
            const Icon = moduleIcon(m.slug, m.category);
            const done = m.status === "completed";
            const current = firstOpen?.slug === m.slug;
            return (
              <li key={m.slug} className="relative flex gap-4">
                <span className={cn("relative z-10 mt-3 grid size-11 shrink-0 place-items-center rounded-full border-2", done ? "border-safe-500 bg-safe-500 text-white" : current ? "border-reward-500 bg-reward-500 text-(--accent-on)" : "border-line-strong bg-surface text-ink-subtle")}>
                  {done ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
                </span>
                <Link
                  href={moduleHref(m)}
                  aria-current={current ? "step" : undefined}
                  className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-surface p-4 shadow-xs hover:shadow-raised", current ? "border-reward-400 ring-2 ring-reward-200" : "border-line")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-tab font-semibold text-ink-subtle">
                      {i + 1}. {tc(`categories.${m.category}`)}
                    </p>
                    <p className="text-body-sm font-semibold">{m.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-tab text-ink-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden className="size-3.5" />
                        {tc("units.min", { count: m.minutes })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers aria-hidden className="size-3.5" />
                        {tc("units.lessons", { count: m.lessons.length })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Zap aria-hidden className="size-3.5" />
                        {tc("units.xp", { count: m.xp })}
                      </span>
                      {m.due && !done ? <span className={cn("font-semibold", m.due < today ? "text-risk-700" : "text-ink-muted")}>{tm("due", { date: day(m.due) })}</span> : null}
                    </p>
                    {m.status === "awaiting_attestation" ? (
                      <Pill tone="reward" className="mt-2">
                        <Award />
                        {tr("confirmHint")}
                      </Pill>
                    ) : (
                      <ProgressBar value={m.percent} size="sm" tone={done ? "safe" : "reward"} className="mt-2 max-w-48" label={tl("moduleProgress", { title: m.title })} />
                    )}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            );
          })}
        </ol>
        {p.labs.length ? (
          <section id="labs" aria-labelledby="path-labs" className="mt-8 scroll-mt-[calc(var(--topbar-height)+1.5rem)]">
            <h3 id="path-labs" className="text-body font-semibold">
              {tr("labsHeading")}
            </h3>
            <p className="mt-1 mb-3 text-caption text-ink-muted">{tr("labsHint")}</p>
            <ol className="relative grid gap-3" start={p.modules.length + 1}>
              <span aria-hidden className="absolute top-6 bottom-6 start-[1.4rem] w-0.5 bg-line" />
              {p.labs.map((l, i) => {
                const Icon = LAB_ICON[l.id];
                const body = (
                  <div className="min-w-0 flex-1">
                    <p className="text-tab font-semibold text-ink-subtle">
                      {p.modules.length + i + 1}. {tlab(`games.${l.id}.tag`)}
                    </p>
                    <p className={cn("text-body-sm font-semibold", !l.unlocked && "text-ink-muted")}>{tlab(`games.${l.id}.title`)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-tab text-ink-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Zap aria-hidden className="size-3.5" />
                        {tc("units.xp", { count: LAB_XP[l.id] })}
                      </span>
                      {l.best !== null ? <span>{tr("labBest", { percent: Math.round(l.best * 100) })}</span> : null}
                    </p>
                    {l.passed ? (
                      <Pill tone="safe" className="mt-2">
                        <Check />
                        {tr("labPassed")}
                      </Pill>
                    ) : null}
                    {l.unlocked ? null : (
                      <p className="mt-2 flex items-start gap-1.5 text-caption text-ink-muted">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        {tr("labLocked", { modules: format.list(l.after.map((s) => titleOf.get(s) ?? s), { type: "conjunction" }) })}
                      </p>
                    )}
                  </div>
                );
                return (
                  <li key={l.id} className="relative flex gap-4">
                    <span
                      className={cn(
                        "relative z-10 mt-3 grid size-11 shrink-0 place-items-center rounded-full border-2",
                        l.passed ? "border-safe-500 bg-safe-500 text-white" : l.unlocked ? "border-brand-600 bg-brand-600 text-brand-on" : "border-line-strong bg-surface text-ink-disabled",
                      )}
                    >
                      {l.passed ? <Check className="size-5" strokeWidth={3} /> : l.unlocked ? <Icon className="size-5" /> : <Lock className="size-5" />}
                    </span>
                    {l.unlocked ? (
                      <Link href={`/lab/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs hover:shadow-raised">
                        {body}
                        <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-dashed border-line-strong bg-sunken p-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </div>
      <aside className="grid content-start gap-4 lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)] lg:self-start">
        <Card className="p-5">
          <p className="text-caption font-semibold text-ink-muted">{tr("progress", { done: p.done, total: p.modules.length })}</p>
          <ProgressBar decorative value={p.modules.length ? (p.done / p.modules.length) * 100 : 0} className="mt-2" />
          {p.labs.length ? (
            <>
              <p className="mt-4 text-caption font-semibold text-ink-muted">{tr("labsProgress", { done: labsPassed, total: p.labs.length })}</p>
              <ProgressBar decorative value={(labsPassed / p.labs.length) * 100} tone="safe" className="mt-2" />
            </>
          ) : null}
          {firstOpen ? (
            <ButtonLink href={moduleHref(firstOpen)} className="mt-4 w-full">
              {tc("continue")}
            </ButtonLink>
          ) : nextLab ? (
            <ButtonLink href={`/lab/${nextLab.id}`} className="mt-4 w-full">
              {tc("continue")}
            </ButtonLink>
          ) : null}
          <dl className="mt-5 grid gap-3 text-caption">
            {p.due ? (
              <div className="flex items-start gap-2">
                <CalendarClock className={cn("mt-0.5 size-4", overdue ? "text-risk-600" : "text-ink-subtle")} />
                <div>
                  <dt className="text-ink-muted">{tr("dueLabel")}</dt>
                  <dd className={cn("font-semibold", overdue && "text-risk-700")}>{day(p.due)}</dd>
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 text-ink-subtle" />
              <div>
                <dt className="text-ink-muted">{tr("totals")}</dt>
                <dd className="font-semibold">{[tc("units.min", { count: minutes }), tc("units.lessons", { count: lessons }), tc("units.xp", { count: xp })].join(" · ")}</dd>
              </div>
            </div>
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
