import { notFound } from "next/navigation";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarClock, MapPin, Radio, UserRound } from "lucide-react";
import { hasFeature, requirePermission } from "@/server/auth/viewer";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { EmptyState, PageHeader, TabsNav } from "@/components/ui/layout";
import { AttendanceToggle, DeleteSession, SessionEditor } from "@/components/secops/service";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("sessions") };
}

const VIEWS = ["upcoming", "past"] as const;

export default async function SessionsAdminPage({ searchParams }: PageProps<"/admin/sessions">) {
  const v = await requirePermission("sessions.write");
  if (!hasFeature(v, "live_sessions")) notFound();
  const sp = await searchParams;
  const view = VIEWS.includes(sp.view as "past") ? (sp.view as (typeof VIEWS)[number]) : "upcoming";
  const [tr, tn, format] = await Promise.all([getTranslations("secops.sessions"), getTranslations("admin.nav"), getFormatter()]);
  const now = new Date();
  const all = await db().select().from(t.liveSessions).where(eq(t.liveSessions.tenantId, v.tenant.id)).orderBy(view === "upcoming" ? asc(t.liveSessions.startsAt) : desc(t.liveSessions.startsAt));
  const ends = (s: (typeof all)[number]) => new Date(s.startsAt.getTime() + s.durationMin * 60_000);
  const list = all.filter((s) => (view === "upcoming" ? ends(s) >= now : ends(s) < now));
  const regs = list.length ? await db().select().from(t.sessionRegistrations).where(inArray(t.sessionRegistrations.sessionId, list.map((s) => s.id))) : [];
  const people = await peopleById(v.tenant.id, regs.map((r) => r.userId));

  return (
    <div className="grid gap-5">
      <PageHeader title={tn("sessions")} subtitle={tr("subtitle")} icon={<Radio />} actions={<SessionEditor initial={null} />} />
      <TabsNav items={VIEWS.map((k) => ({ href: `?view=${k}`, label: tr(k), active: view === k, count: all.filter((s) => (k === "upcoming" ? ends(s) >= now : ends(s) < now)).length }))} />
      {list.length ? (
        <ul className="grid gap-4">
          {list.map((s) => {
            const mine = regs.filter((r) => r.sessionId === s.id).sort((a, b) => (people.get(a.userId)?.name ?? "").localeCompare(people.get(b.userId)?.name ?? ""));
            const attended = mine.filter((r) => r.attended).length;
            const started = s.startsAt <= now;
            return (
              <li key={s.id}>
                <Card>
                  <CardBody className="grid gap-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-semibold">{s.title}</p>
                        {s.description ? <p className="mt-1 text-caption text-ink-muted">{s.description}</p> : null}
                        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="size-4" />
                            {format.dateTime(s.startsAt, { dateStyle: "medium", timeStyle: "short" })} · {s.durationMin}′
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-4" />
                            {s.location}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="size-4" />
                            {s.host}
                          </span>
                        </p>
                      </div>
                      <Pill tone={s.capacity && mine.length >= s.capacity ? "warn" : "brand"}>
                        {tr("registered", { count: mine.length })}
                        {s.capacity ? ` ${tr("capacity", { capacity: s.capacity })}` : ""}
                      </Pill>
                      {started ? <Pill tone="safe">{tr("attended", { count: attended })}</Pill> : null}
                      <SessionEditor
                        initial={{ id: s.id, title: s.title, description: s.description ?? "", startsAt: s.startsAt.toISOString(), durationMin: s.durationMin, location: s.location, host: s.host, capacity: s.capacity }}
                      />
                      <DeleteSession id={s.id} />
                    </div>
                    {mine.length ? (
                      <details className="group rounded-lg border border-line" open={view === "past"}>
                        <summary className="cursor-pointer list-none px-4 py-2.5 text-caption font-semibold text-ink-muted hover:text-ink">
                          {tr("attendance")} · {mine.length}
                        </summary>
                        <ul className="grid gap-1 border-t border-line p-3 sm:grid-cols-2">
                          {mine.map((r) => (
                            <li key={r.userId} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-caption hover:bg-sunken">
                              {started ? <AttendanceToggle sessionId={s.id} userId={r.userId} attended={r.attended} label={`${tr("present")}: ${people.get(r.userId)?.name ?? ""}`} /> : null}
                              <span className="min-w-0 flex-1 truncate">
                                <b>{people.get(r.userId)?.name ?? "—"}</b>
                                <span className="text-ink-subtle"> · {people.get(r.userId)?.departmentName ?? ""}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <p className="text-caption text-ink-muted">{tr("noRegistrations")}</p>
                    )}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Radio />} title={tr("empty")} />
      )}
    </div>
  );
}
