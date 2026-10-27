import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { eq, sql } from "drizzle-orm";
import { Gamepad2, Monitor, Play, Sparkles, Info } from "lucide-react";
import { db, t } from "@/server/db";
import { requireFeature } from "@/server/auth/viewer";
import { GAMES } from "@/server/lab/games";
import { LAB_MAX, VM_LAB_IDS, VM_LABS } from "@/components/lab/model/labs";
import { LAB_ICON as ICON, LAB_TINT as TINT } from "@/components/learner/lab-visual";
import { Notice, PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";

export async function generateMetadata() {
  const tr = await getTranslations("learner.lab");
  return { title: tr("title") };
}

export default async function LabPage() {
  const v = await requireFeature("lab");
  const tr = await getTranslations("learner.lab");
  const best = await db()
    .select({ exercise: t.labAttempts.exercise, score: sql<number>`max(${t.labAttempts.score})`, share: sql<number>`max(${t.labAttempts.score}::float / nullif(${t.labAttempts.max}, 0))` })
    .from(t.labAttempts)
    .where(eq(t.labAttempts.userId, v.user.id))
    .groupBy(t.labAttempts.exercise);
  const bestMap = new Map(best.map((b) => [b.exercise, Number(b.score)]));
  // Machine labs are scored in points out of 100; the share keeps older rows with another maximum comparable.
  const bestShare = new Map(best.map((b) => [b.exercise, Number(b.share)]));
  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("sub")} icon={<Gamepad2 />} />
      <Notice tone="info" icon={<Info />}>
        {tr("notice")}
      </Notice>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(GAMES) as (keyof typeof GAMES)[]).map((g) => {
          const Icon = ICON[g];
          const [from, chip] = TINT[g].split(" ");
          const b = bestMap.get(g);
          return (
            <li key={g}>
              <Link href={`/lab/${g}`} className={`group flex h-full flex-col rounded-xl border border-line bg-gradient-to-br ${from} to-surface to-45% p-5 shadow-xs transition-shadow hover:shadow-raised`}>
                <div className="flex items-start gap-3">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-md text-white shadow-raised ${chip}`}>
                    <Icon className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-bold">{tr(`games.${g}.title`)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill>{tr(`games.${g}.tag`)}</Pill>
                      <Pill tone="violet">
                        <Sparkles />
                        {tr("xp", { xp: GAMES[g].xp })}
                      </Pill>
                    </div>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-body-sm text-ink-muted">{tr(`games.${g}.body`)}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-caption text-ink-subtle">
                    {tr("tasks", { count: GAMES[g].max })}
                    {b !== undefined ? ` · ${tr("best", { score: b, max: GAMES[g].max })}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-600 px-3.5 py-2 text-caption font-semibold text-brand-on">
                    <Play className="size-3.5 fill-current" />
                    {tr("play")}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
        {VM_LAB_IDS.map((g) => {
          const Icon = ICON[g];
          const [from, chip] = TINT[g].split(" ");
          const b = bestShare.get(g);
          return (
            <li key={g}>
              <Link href={`/lab/${g}`} className={`group flex h-full flex-col rounded-xl border border-line bg-gradient-to-br ${from} to-surface to-45% p-5 shadow-xs transition-shadow hover:shadow-raised`}>
                <div className="flex items-start gap-3">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-md text-white shadow-raised ${chip}`}>
                    <Icon className="size-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-body font-bold">{tr(`games.${g}.title`)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill tone="cyan">
                        <Monitor />
                        {tr("vm.badge")}
                      </Pill>
                      <Pill>{tr(`games.${g}.tag`)}</Pill>
                      <Pill tone="violet">
                        <Sparkles />
                        {tr("xp", { xp: VM_LABS[g].xp })}
                      </Pill>
                    </div>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-body-sm text-ink-muted">{tr(`games.${g}.body`)}</p>
                {/* Wraps as a whole: when the longer "start lab" label leaves no room, the button moves under the meta line instead of breaking it. */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="text-caption text-ink-subtle">
                    {tr("vm.objectives", { count: VM_LABS[g].objectives })}
                    {b !== undefined && Number.isFinite(b) ? ` · ${tr("best", { score: Math.round(b * LAB_MAX), max: LAB_MAX })}` : ""}
                  </span>
                  <span className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-brand-600 px-3.5 py-2 text-caption font-semibold text-brand-on">
                    <Play className="size-3.5 fill-current" />
                    {tr("vm.start")}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
