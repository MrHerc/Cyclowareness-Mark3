import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { Award, Check, ChevronLeft, Clock, Gauge, Layers, Play, RotateCcw, Zap } from "lucide-react";
import { db, t } from "@/server/db";
import { nextLesson } from "@/server/queries/catalog";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink, textLinkClass } from "@/components/ui/button";
import { ModuleArt } from "@/components/learner/module-icon";
import { AttestCard, CertificateLink, RateModule } from "./module-actions";
import { moduleForPage } from "./module";
import { DEFAULT_ATTESTATION } from "@/lib/tenant-defaults";
import { pick } from "@/i18n/config";
import { todayInBaku } from "@/lib/time";
import { cn } from "@/lib/cn";

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">) {
  const { m } = await moduleForPage((await params).slug);
  return { title: m.title };
}

export default async function ModulePage({ params, searchParams }: PageProps<"/learn/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { v, locale, m } = await moduleForPage(slug);
  const [tr, tc, tl, format] = await Promise.all([getTranslations("learner.module"), getTranslations("common"), getTranslations("learner.learn"), getFormatter()]);
  const next = nextLesson(m);
  // The orange marker follows the last opened lesson (as in the original), else the next one to do.
  const currentKey = m.lessons.some((l) => l.key === m.lastLessonKey) ? m.lastLessonKey : next?.key;
  const level = ({ Easy: 1, Medium: 2, Hard: 3 } as const)[m.difficulty];
  const stats = [
    { icon: Clock, label: tr("minutes"), value: m.minutes, tint: false, meter: false },
    { icon: Layers, label: tr("lessonsCount"), value: m.lessons.length, tint: false, meter: false },
    { icon: Zap, label: tr("xp"), value: m.xp, tint: true, meter: false },
    { icon: Gauge, label: tr("difficulty"), value: tc(`difficulty.${m.difficulty}`), tint: false, meter: true },
  ];
  const [cert] =
    m.status === "completed"
      ? await db()
          .select({ token: t.certificates.publicToken })
          .from(t.certificates)
          .where(and(eq(t.certificates.userId, v.user.id), eq(t.certificates.moduleId, m.id)))
          .orderBy(desc(t.certificates.issuedAt))
          .limit(1)
      : [];
  const attestText = v.tenant.settings.attestationText[locale] ?? pick(DEFAULT_ATTESTATION, locale);
  const overdue = !!m.due && m.due < todayInBaku() && m.status !== "completed";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="min-w-0">
        <Link href="/learn" className="inline-flex items-center gap-1 text-caption font-semibold text-ink-muted hover:text-ink pointer-coarse:-my-3 pointer-coarse:min-h-11">
          <ChevronLeft className="size-4" />
          {tr("back")}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill tone="brand">{tc(`categories.${m.category}`)}</Pill>
          {m.due ? <Pill tone={overdue ? "risk" : "neutral"}>{tr("due", { date: format.dateTime(new Date(`${m.due}T12:00:00`), { day: "numeric", month: "long" }) })}</Pill> : null}
        </div>
        <h1 className="mt-3 text-headline font-bold text-balance">{m.title}</h1>
        <p className="mt-2 text-lead text-ink-muted">{m.subtitle}</p>

        <h2 className="mt-8 mb-3 text-title-sm font-semibold">{tr("lessons")}</h2>
        <ol className="grid gap-2.5">
          {m.lessons.map((l, i) => {
            const isNext = m.status !== "completed" && l.key === currentKey;
            return (
              <li key={l.key}>
                <Link
                  href={`/learn/${m.slug}/${l.key}`}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border bg-surface p-4 shadow-xs transition-shadow hover:shadow-raised",
                    isNext ? "border-reward-400 ring-2 ring-reward-200" : "border-line",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-body-sm font-bold",
                      isNext ? "bg-reward-500 text-(--accent-on)" : l.completed ? "bg-safe-50 text-safe-600" : "bg-brand-50 text-brand-600",
                    )}
                  >
                    {l.completed && !isNext ? <Check className="size-5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">{l.title}</span>
                    <span className="mt-0.5 flex items-center gap-3 text-tab text-ink-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {tc("units.min", { count: l.minutes })}
                      </span>
                      {l.completed ? <span className="font-semibold text-safe-700">{tr("completed")}</span> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)] lg:self-start">
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
            <div className="flex items-center gap-3">
              <ProgressBar value={m.percent} tone="reward" label={tl("moduleProgress", { title: m.title })} />
              <span aria-hidden className="text-caption font-bold tabular-nums">
                {m.percent}%
              </span>
            </div>
            {m.status === "awaiting_attestation" ? (
              <AttestCard slug={m.slug} moduleTitle={m.title} text={attestText} autoOpen={sp.confirm === "1"} />
            ) : (
              <ButtonLink href={`/learn/${m.slug}/${next.key}`} size="lg" icon={m.status === "completed" ? <RotateCcw /> : <Play className="fill-current" />}>
                {m.status === "completed" ? tr("review") : m.percent ? tr("continue") : tr("start")}
              </ButtonLink>
            )}
            {m.percent > 0 && m.status !== "awaiting_attestation" ? (
              <Link href={`/learn/${m.slug}/${m.lessons[0].key}`} className={textLinkClass("inline-flex items-center justify-center gap-1.5 text-caption font-semibold text-ink-muted hover:text-ink")}>
                <RotateCcw className="size-4" />
                {tr("startOver")}
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
    </div>
  );
}
