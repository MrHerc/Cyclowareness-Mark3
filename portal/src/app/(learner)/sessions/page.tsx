import { getFormatter, getTranslations } from "next-intl/server";
import { asc, count, eq } from "drizzle-orm";
import { Calendar, Clock, MapPin, Radio, User } from "lucide-react";
import { db, t } from "@/server/db";
import { requireFeature } from "@/server/auth/viewer";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { SessionButton } from "./session-button";

export async function generateMetadata() {
  const tr = await getTranslations("learner.sessions");
  return { title: tr("title") };
}

export default async function SessionsPage() {
  const v = await requireFeature("live_sessions");
  const [tr, format] = await Promise.all([getTranslations("learner.sessions"), getFormatter()]);
  const [sessions, regs, counts] = await Promise.all([
    db().select().from(t.liveSessions).where(eq(t.liveSessions.tenantId, v.tenant.id)).orderBy(asc(t.liveSessions.startsAt)),
    db().select().from(t.sessionRegistrations).where(eq(t.sessionRegistrations.userId, v.user.id)),
    db().select({ sessionId: t.sessionRegistrations.sessionId, n: count() }).from(t.sessionRegistrations).groupBy(t.sessionRegistrations.sessionId),
  ]);
  const mine = new Map(regs.map((r) => [r.sessionId, r]));
  const taken = new Map(counts.map((c) => [c.sessionId, Number(c.n)]));
  const now = new Date();
  const upcoming = sessions.filter((s) => s.startsAt >= now);
  const past = sessions.filter((s) => s.startsAt < now).reverse();

  const card = (s: (typeof sessions)[number], isPast: boolean) => {
    const reg = mine.get(s.id);
    const left = s.capacity ? s.capacity - (taken.get(s.id) ?? 0) : null;
    return (
      <Card key={s.id} className="flex flex-wrap items-start gap-4 p-5">
        <div className="grid w-16 shrink-0 place-items-center rounded-lg bg-brand-50 py-2 text-brand-700">
          <span className="text-tab-sm font-bold uppercase">{format.dateTime(s.startsAt, { month: "short" })}</span>
          <span className="text-title font-bold">{format.dateTime(s.startsAt, { day: "numeric" })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold">{s.title}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4" />
              {format.dateTime(s.startsAt, { weekday: "long", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              {tr("minutes", { count: s.durationMin })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {s.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" />
              {tr("host", { name: s.host })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isPast ? (
            reg?.attended ? <Pill tone="safe">{tr("attended")}</Pill> : null
          ) : (
            <>
              {left !== null ? <span className="text-tab text-ink-subtle">{left > 0 ? tr("spots", { count: left }) : tr("full")}</span> : null}
              <SessionButton id={s.id} registered={!!reg} full={left !== null && left <= 0} />
            </>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("sub")} icon={<Radio />} />
      <section className="grid gap-3">
        <h2 className="text-title-sm font-semibold">{tr("upcoming")}</h2>
        {upcoming.length ? upcoming.map((s) => card(s, false)) : <Card><EmptyState icon={<Radio />} title={tr("none")} /></Card>}
      </section>
      {past.length ? (
        <section className="grid gap-3">
          <h2 className="text-title-sm font-semibold">{tr("past")}</h2>
          {past.map((s) => card(s, true))}
        </section>
      ) : null}
    </div>
  );
}
