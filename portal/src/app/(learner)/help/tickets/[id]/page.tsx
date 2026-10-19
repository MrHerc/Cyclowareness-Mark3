import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { and, asc, eq } from "drizzle-orm";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { TicketThread } from "@/components/support/ticket-thread";

export default async function TicketPage({ params }: PageProps<"/help/tickets/[id]">) {
  const { id } = await params;
  const v = await requireViewer();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [ticket] = await db().select().from(t.supportTickets).where(and(eq(t.supportTickets.id, id), eq(t.supportTickets.userId, v.user.id)));
  if (!ticket) notFound();
  const [tr, format] = await Promise.all([getTranslations("learner.help"), getFormatter()]);
  const messages = await db()
    .select({ id: t.ticketMessages.id, body: t.ticketMessages.body, at: t.ticketMessages.at, authorId: t.ticketMessages.authorId, name: t.users.name, role: t.users.role })
    .from(t.ticketMessages)
    .leftJoin(t.users, eq(t.users.id, t.ticketMessages.authorId))
    .where(eq(t.ticketMessages.ticketId, ticket.id))
    .orderBy(asc(t.ticketMessages.at));
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title={`#${ticket.number} · ${ticket.subject}`}
        subtitle={`${tr(`categories.${ticket.category}`)} · ${tr(`priorities.${ticket.priority}`)} · ${tr("sla", { date: format.dateTime(ticket.slaDueAt, { dateStyle: "medium", timeStyle: "short" }) })}`}
        back={{ href: "/help", label: tr("back") }}
        actions={<Pill tone={ticket.status === "answered" ? "safe" : ticket.status === "closed" ? "neutral" : "brand"}>{tr(`status.${ticket.status}`)}</Pill>}
      />
      <Card>
        <CardBody>
          <TicketThread
            ticketId={ticket.id}
            closed={ticket.status === "closed"}
            messages={messages.map((m) => ({
              id: m.id,
              authorName: m.name ?? "—",
              mine: m.authorId === v.user.id,
              staff: m.role !== "learner",
              body: m.body,
              at: m.at.toISOString(),
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
