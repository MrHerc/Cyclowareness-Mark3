import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Award, Check, ChevronLeft, ChevronRight, Clock, Gauge, Layers, Lock, MousePointerClick, Play, RotateCcw, Route, Zap } from "lucide-react";
import { db, t } from "@/server/db";
import { allowed, hasFeature } from "@/server/auth/viewer";
import { nextLesson } from "@/server/queries/catalog";
import { getPaths, labBestShares } from "@/server/queries/paths";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink, textLinkClass } from "@/components/ui/button";
import { ModuleArt } from "@/components/learner/module-icon";
import { LAB_ICON, LAB_TINT } from "@/components/learner/lab-visual";
import { AttestCard, CertificateLink, RateModule } from "./module-actions";
import { moduleForPage } from "./module";
import { DEFAULT_ATTESTATION } from "@/lib/tenant-defaults";
import { labPassed, labsForModule } from "@/lib/domain/labs";
import { miniLabXp } from "@/lib/content/lab-scenario";
import { modulePractice } from "@/components/lab/model/labs";
import { labScenario } from "@/server/lab/scenarios";
import { learningPoints } from "@/lib/content/learning-points";
import { pickLessonContent } from "@/lib/content/lesson-locale";
import { safePath } from "@/lib/safe-path";
import { langAttrs, pick } from "@/i18n/config";
import { dayAt, todayIn } from "@/lib/time";
import { cn } from "@/lib/cn";

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">) {
  const { m } = await moduleForPage((await params).slug);
  return { title: m.title };
}

export default async function ModulePage({ params, searchParams }: PageProps<"/learn/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { v, locale, m } = await moduleForPage(slug);
  const practice = hasFeature(v, "lab") ? labsForModule(m.slug) : [];
  const mini = hasFeature(v, "lab") ? labScenario(m.slug, locale) : null;
  const [tr, tc, tl, tp, tlab, format, certs, recaps, paths, best] = await Promise.all([
    getTranslations("learner.module"),
    getTranslations("common"),
    getTranslations("learner.learn"),
    getTranslations("learner.paths"),
    getTranslations("learner.lab"),
    getFormatter(),
    m.status === "completed"
      ? db()
          .select({ token: t.certificates.publicToken })
          .from(t.certificates)
          .where(and(eq(t.certificates.userId, v.user.id), eq(t.certificates.moduleId, m.id)))
          .orderBy(desc(t.certificates.issuedAt))
          .limit(1)
      : [],
    // Only the recap points of every stored language, not the whole scenes, for "What you will learn".
    m.lessons.length
      ? db()
          .select({ lessonId: t.lessonContents.lessonId, locale: t.lessonContents.locale, points: sql<unknown>`jsonb_path_query_array(${t.lessonContents.scenes}, '$[*] ? (@.type == "recap").points[*]')` })
          .from(t.lessonContents)
          .where(inArray(t.lessonContents.lessonId, m.lessons.map((l) => l.id)))
      : [],
    hasFeature(v, "paths") ? getPaths(v, locale, allowed(v, "studio.write")) : [],
    practice.length || mini ? labBestShares(v.user.id) : new Map<string, number>(),
  ]);
  const cert = certs[0];
  const points = learningPoints(
    m.lessons.map((l) => {
      const c = pickLessonContent(recaps.filter((r) => r.lessonId === l.id), locale);
      return { title: l.title, points: c?.points, lang: c && c.locale !== locale ? c.locale : undefined };
    }),
  );
  // Continue reopens the last opened lesson while it is unfinished, else the first one still to do; the orange marker follows it.
  const resume = m.lessons.find((l) => l.key === m.lastLessonKey && !l.completed) ?? nextLesson(m);
  const resumeIndex = m.lessons.indexOf(resume);
  const studying = m.status === "not_started" || m.status === "in_progress";
  const level = ({ Easy: 1, Medium: 2, Hard: 3 } as const)[m.difficulty];
  const stats = [
    { icon: Clock, label: tr("duration"), value: tc("units.min", { count: m.minutes }), tint: false, meter: false },
    { icon: Layers, label: tr("lessonsCount"), value: m.lessons.length, tint: false, meter: false },
    { icon: Zap, label: tr("xp"), value: m.xp, tint: true, meter: false },
    { icon: Gauge, label: tr("difficulty"), value: tc(`difficulty.${m.difficulty}`), tint: false, meter: true },
  ];
  const attestText = v.tenant.settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale);
  const overdue = !!m.due && m.due < todayIn(v.tenant.settings.timeZone) && m.status !== "completed";
  const done = m.lessons.filter((l) => l.completed).length;
  const { open: practiceOpen, items: practiceItems } = modulePractice(m.slug, m.status, practice, mini && { title: mini.scenario.title, lang: mini.lang, xp: miniLabXp(mini.scenario) }, locale);

  // Path context: arriving from a path (?from=/paths/<key>) links back to it and on to its next module; without one,
  // the next module comes from a path assigned to the viewer. Only the viewer's own paths match, so links use their keys.
  const inPaths = paths.filter((p) => p.modules.some((x) => x.slug === m.slug));
  const fromKey = /^\/paths\/([^/?#]+)$/.exec(safePath(sp.from, ""))?.[1];
  const fromPath = inPaths.find((p) => p.key === fromKey);
  const context = fromPath ?? inPaths.find((p) => p.assigned);
  const nextInPath = context?.modules[context.modules.findIndex((x) => x.slug === m.slug) + 1];
  const keepFrom = fromPath ? `from=${encodeURIComponent(`/paths/${fromPath.key}`)}` : "";
  const here = `/learn/${m.slug}${keepFrom ? `?${keepFrom}` : ""}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-8">
      {/* Phones read the header, then the card with the main action, then the course outline; wide screens keep the card beside both. */}
      <header className="min-w-0">
        <Link href={fromPath ? `/paths/${fromPath.key}` : "/learn"} className="inline-flex items-center gap-1 text-caption font-semibold text-ink-muted hover:text-ink pointer-coarse:-my-3 pointer-coarse:min-h-11">
          <ChevronLeft className="size-4" />
          {fromPath ? fromPath.title : tr("back")}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="brand">{tc(`categories.${m.category}`)}</Pill>
          {m.status === "completed" ? (
            <Pill tone="safe">
              <Check />
              {tl("completed")}
            </Pill>
          ) : m.status === "awaiting_attestation" ? (
            <Pill tone="reward">
              <Award />
              {tl("awaiting")}
            </Pill>
          ) : m.status === "in_progress" ? (
            <Pill tone="neutral">{tl("complete", { percent: m.percent })}</Pill>
          ) : null}
          {m.due ? <Pill tone={overdue ? "risk" : "neutral"}>{tr("due", { date: format.dateTime(dayAt(m.due, v.tenant.settings.timeZone), { day: "numeric", month: "long" }) })}</Pill> : null}
        </div>
        <h1 className="mt-3 text-headline font-bold text-balance">{m.title}</h1>
        <p className="mt-2 text-lead text-ink-muted">{m.subtitle}</p>
      </header>

      <aside className="lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <Card className="overflow-hidden">
          <div className="grid gap-5 p-5">
            <div className="grid place-items-center rounded-lg bg-brand-50 py-4">
              <ModuleArt tone="light" slug={m.slug} category={m.category} className="w-36" />
            </div>
            <ul className="grid grid-cols-2 gap-2.5">
              {stats.map(({ icon: Icon, label, value, tint, meter }) => (
                <li key={label} className={cn("flex items-center gap-2.5 rounded-md px-3 py-2.5", tint ? "bg-reward-100" : "bg-sunken")}>
                  <Icon aria-hidden className={cn("size-4.5 shrink-0", tint ? "text-reward-500" : "text-ink-subtle")} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-body font-bold">
                      {meter ? (
                        <span aria-hidden className="inline-flex items-end gap-0.5">
                          {(["h-1.5", "h-2", "h-2.5"] as const).map((h, i) => (
                            <span key={h} className={cn("w-1 rounded-full", h, i < level ? "bg-brand-600" : "bg-brand-200")} />
                          ))}
                        </span>
                      ) : null}
                      {value}
                    </span>
                    <span className="block text-tab text-ink-subtle">{label}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <div className="flex items-center gap-3">
                <ProgressBar value={m.percent} tone="reward" label={tl("moduleProgress", { title: m.title })} />
                <span aria-hidden className="text-caption font-bold tabular-nums">
                  {tc("units.percent", { value: format.number(m.percent) })}
                </span>
              </div>
              <p className="mt-1.5 text-tab text-ink-subtle">{tr("lessonsDone", { done, total: m.lessons.length })}</p>
            </div>
            {m.status === "awaiting_attestation" ? (
              <AttestCard slug={m.slug} moduleTitle={m.title} text={attestText} autoOpen={sp.confirm === "1"} returnHref={here} />
            ) : (
              <div className="grid gap-2">
                <ButtonLink href={`/learn/${m.slug}/${resume.key}`} size="lg" icon={m.status === "completed" ? <RotateCcw /> : <Play className="fill-current" />}>
                  {m.status === "completed" ? tr("review") : m.percent || m.lastLessonKey ? tr("continue") : tr("start")}
                </ButtonLink>
                {studying ? <p className="text-center text-tab text-ink-subtle">{tr("resumeAt", { n: resumeIndex + 1, title: resume.title })}</p> : null}
              </div>
            )}
            {m.percent > 0 && m.status !== "awaiting_attestation" ? (
              <Link href={`/learn/${m.slug}/${m.lessons[0].key}`} className={textLinkClass("inline-flex items-center justify-center gap-1.5 text-caption font-semibold text-ink-muted hover:text-ink")}>
                <RotateCcw className="size-4" />
                {tr("startOver")}
              </Link>
            ) : null}
            {context && nextInPath ? (
              <Link
                href={`/learn/${nextInPath.slug}?from=${encodeURIComponent(`/paths/${context.key}`)}`}
                className="flex items-center gap-3 rounded-lg border border-line p-3 transition-shadow hover:shadow-raised"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600">
                  <Route className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-tab font-semibold text-ink-subtle">{tr("nextInPath", { path: context.title })}</span>
                  <span className="block text-body-sm font-semibold">{nextInPath.title}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-subtle" />
              </Link>
            ) : null}
            <div className="flex items-start gap-3 border-t border-line pt-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-reward-500 text-(--accent-on)">
                <Award className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-semibold">{tr("certificate")}</p>
                <p className="mt-0.5 text-caption text-ink-muted">{cert ? tr("certificateReady") : tr("certificateLocked")}</p>
                {cert ? <CertificateLink token={cert.token} /> : null}
              </div>
            </div>
            {m.status === "completed" ? (
              <div className="border-t border-line pt-4">
                <RateModule slug={m.slug} />
              </div>
            ) : null}
          </div>
        </Card>
      </aside>

      <div className="min-w-0 lg:col-start-1">
        {points.length ? (
          <section aria-labelledby="module-learn" className="mb-8">
            <h2 id="module-learn" className="mb-3 text-title-sm font-semibold">
              {tr("learn")}
            </h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {points.map((p) => (
                <li key={p.text} {...(p.lang ? langAttrs(p.lang) : {})} className="flex items-start gap-3 rounded-xl bg-surface p-4 shadow-xs ring-1 ring-line">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-safe-50 text-safe-600">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-body-sm">{p.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="module-lessons">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="module-lessons" className="text-title-sm font-semibold">
              {tr("lessons")}
            </h2>
            <p className="text-caption text-ink-subtle">
              {tc("units.lessons", { count: m.lessons.length })} · {tc("units.min", { count: m.minutes })}
            </p>
          </div>
          <ol className="grid gap-2.5">
            {m.lessons.map((l, i) => {
              const current = studying && l.key === resume.key;
              return (
                <li key={l.key}>
                  <Link
                    href={`/learn/${m.slug}/${l.key}`}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border bg-surface p-4 shadow-xs transition-shadow hover:shadow-raised",
                      current ? "border-reward-400 ring-2 ring-reward-200" : "border-line",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full text-body-sm font-bold",
                        current ? "bg-reward-500 text-(--accent-on)" : l.completed ? "bg-safe-50 text-safe-600" : "bg-brand-50 text-brand-600",
                      )}
                    >
                      {l.completed && !current ? <Check className="size-5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold">{l.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-tab text-ink-subtle">
                        <span className="inline-flex items-center gap-1">
                          <Clock aria-hidden className="size-3.5" />
                          {tc("units.min", { count: l.minutes })}
                        </span>
                        {l.completed ? (
                          <span className="font-semibold text-safe-700">{tr("completed")}</span>
                        ) : current ? (
                          <span className="font-semibold text-reward-ink">{l.key === m.lastLessonKey ? tr("inProgress") : tr("upNext")}</span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              );
            })}
            {/* The confirmation that completes the module, after the last lesson. */}
            <li>
              {m.status === "awaiting_attestation" ? (
                <Link
                  href={`${here}${keepFrom ? "&" : "?"}confirm=1`}
                  aria-current="step"
                  className="flex items-center gap-4 rounded-xl border border-reward-400 bg-surface p-4 shadow-xs ring-2 ring-reward-200 transition-shadow hover:shadow-raised"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-reward-500 text-(--accent-on)">
                    <Award className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">{tr("confirmTitle")}</span>
                    <span className="mt-0.5 block text-tab font-semibold text-reward-ink">{tl("awaiting")}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-subtle" />
                </Link>
              ) : (
                <div className={cn("flex items-center gap-4 rounded-xl border p-4", m.status === "completed" ? "border-line bg-surface shadow-xs" : "border-dashed border-line-strong bg-sunken")}>
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", m.status === "completed" ? "bg-safe-50 text-safe-600" : "bg-surface text-ink-disabled")}>
                    {m.status === "completed" ? <Check className="size-5" strokeWidth={3} /> : <Lock className="size-4.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-body-sm font-semibold", m.status !== "completed" && "text-ink-muted")}>{tr("confirmTitle")}</span>
                    <span className="mt-0.5 block text-tab text-ink-subtle">{m.status === "completed" ? <span className="font-semibold text-safe-700">{tr("completed")}</span> : tr("confirmLocked")}</span>
                  </span>
                </div>
              )}
            </li>
          </ol>
        </section>

        {practiceItems.length ? (
          <section aria-labelledby="module-practice" className="mt-8">
            <h2 id="module-practice" className="text-title-sm font-semibold">
              {tr("practice")}
            </h2>
            <p className="mt-1 mb-3 text-caption text-ink-muted">{practiceOpen ? tr("practiceHint") : tr("practiceLocked")}</p>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {practiceItems.map(({ id, href, lab, title, lang, xp }) => {
                const Icon = !practiceOpen ? Lock : lab ? LAB_ICON[lab] : MousePointerClick;
                const chip = lab ? LAB_TINT[lab].split(" ")[1] : "bg-brand-600";
                const b = best.get(id) ?? null;
                const body = (
                  <>
                    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-md", practiceOpen ? `${chip} text-white` : "bg-surface text-ink-disabled")}>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span {...(lang ? langAttrs(lang) : {})} className={cn("block text-body-sm font-semibold", !practiceOpen && "text-ink-muted")}>
                        {title ?? tlab(`games.${lab}.title`)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-tab text-ink-subtle">
                        <span className="inline-flex items-center gap-1">
                          <Zap aria-hidden className="size-3.5" />
                          {tc("units.xp", { count: xp })}
                        </span>
                        <span>{tr("optional")}</span>
                        {labPassed(b) ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-safe-700">
                            <Check aria-hidden className="size-3.5" strokeWidth={3} />
                            {tp("labPassed")}
                          </span>
                        ) : b !== null ? (
                          <span>{tp("labBest", { percent: Math.round(b * 100) })}</span>
                        ) : null}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={id}>
                    {practiceOpen ? (
                      <Link href={href} className="flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-raised">
                        {body}
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-subtle" />
                      </Link>
                    ) : (
                      <div className="flex h-full items-center gap-3 rounded-xl border border-dashed border-line-strong bg-sunken p-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {inPaths.length ? (
          <section aria-labelledby="module-paths" className="mt-8">
            <h2 id="module-paths" className="mb-3 text-title-sm font-semibold">
              {tr("inPaths")}
            </h2>
            <ul className="grid gap-2.5">
              {inPaths.map((p) => (
                <li key={p.id}>
                  <Link href={`/paths/${p.key}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs transition-shadow hover:shadow-raised">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-600">
                      <Route className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-body-sm font-semibold">{p.title}</span>
                        {p.assigned ? <Pill tone="brand">{tp("assigned")}</Pill> : null}
                      </span>
                      <span className="mt-0.5 block text-tab text-ink-subtle">
                        {tr("pathPosition", { n: p.modules.findIndex((x) => x.slug === m.slug) + 1, total: p.modules.length })} · {tp("progress", { done: p.done, total: p.modules.length })}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
