import { asc, eq } from "drizzle-orm";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { LifeBuoy } from "lucide-react";
import { db, t } from "@/server/db";
import { peopleById } from "@/server/queries/secops";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { PageHeader } from "@/components/ui/layout";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketStatus } from "@/components/secops/service";
import { requestNow } from "@/lib/time";
import { pick } from "@/i18n/config";
import { ticketForPage } from "./ticket";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("support") };
}

export default async function SupportTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const { v, ticket } = await ticketForPage((await params).id);
  const locale = await getLocale();
  const [tr, tc, format] = await Promise.all([getTranslations("secops.support"), getTranslations("common"), getFormatter()]);
  const [messages, mod] = await Promise.all([
    db()
      .select({ id: t.ticketMessages.id, body: t.ticketMessages.body, at: t.ticketMessages.at, authorId: t.ticketMessages.authorId, name: t.users.name, role: t.users.role })
      .from(t.ticketMessages)
      .leftJoin(t.users, eq(t.users.id, t.ticketMessages.authorId))
      .where(eq(t.ticketMessages.ticketId, ticket.id))
      .orderBy(asc(t.ticketMessages.at)),
    ticket.moduleId ? db().select({ title: t.modules.title }).from(t.modules).where(eq(t.modules.id, ticket.moduleId)) : Promise.resolve([]),
  ]);
  const people = await peopleById(v.tenant.id, [ticket.userId]);
  const who = people.get(ticket.userId);
  const late = (ticket.status === "open" || ticket.status === "in_progress") && ticket.slaDueAt.getTime() < requestNow().getTime();

  return (
    <div className="grid gap-5">
      <PageHeader
        back={{ href: "/admin/support", label: tr("back") }}
        title={`#${ticket.number} · ${ticket.subject}`}
        subtitle={`${tr(`category.${ticket.category}`)} · ${tr(`priority.${ticket.priority}`)}${mod[0] ? ` · ${pick(mod[0].title, locale)}` : ""}`}
        icon={<LifeBuoy />}
        actions={<TicketStatus id={ticket.id} status={ticket.status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardBody>
            <TicketThread
              ticketId={ticket.id}
              closed={ticket.status === "closed"}
              messages={messages.map((m) => ({ id: m.id, authorName: m.name ?? "—", mine: m.authorId === v.user.id, staff: m.authorId !== ticket.userId, body: m.body, at: m.at.toISOString() }))}
            />
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title={tr("requester")} />
          <CardBody className="grid gap-2 pt-3 text-caption">
            <p>
              <b className="text-body-sm">{who?.name ?? "—"}</b>
              <span className="block text-ink-muted">{who?.email}</span>
              <span className="block text-ink-muted">{who?.departmentName ?? tc("noDepartment")}</span>
            </p>
            <p className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="font-semibold">{tr("sla")}:</span>
              <span>{format.dateTime(ticket.slaDueAt, { dateStyle: "medium", timeStyle: "short" })}</span>
              {late ? <Pill tone="risk">{tr("overdue")}</Pill> : null}
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
