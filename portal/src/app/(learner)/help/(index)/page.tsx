import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { ChevronRight, LifeBuoy, MessageSquareHeart, Ticket } from "lucide-react";
import { db, t } from "@/server/db";
import { requireViewer } from "@/server/auth/viewer";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Pill } from "@/components/ui/pill";
import { ReportButton } from "@/components/learner/report-button";
import { FeedbackForm, NewTicket } from "../help-forms";

export async function generateMetadata() {
  const tr = await getTranslations("learner.help");
  return { title: tr("title") };
}

export default async function HelpPage() {
  const v = await requireViewer();
  const [tr, format] = await Promise.all([getTranslations("learner.help"), getFormatter()]);
  const tickets = await db().select().from(t.supportTickets).where(eq(t.supportTickets.userId, v.user.id)).orderBy(desc(t.supportTickets.updatedAt));
  const faq = tr.raw("faqItems") as { q: string; a: string }[];
  return (
    <div className="grid gap-6">
      <PageHeader title={tr("title")} subtitle={tr("sub")} icon={<LifeBuoy />} actions={<><ReportButton variant="full" /><NewTicket /></>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title={tr("tickets")} icon={<Ticket />} />
            <CardBody>
              {tickets.length ? (
                <ul className="divide-y divide-line">
                  {tickets.map((tk) => {
                    const late = tk.status !== "closed" && tk.status !== "answered" && tk.slaDueAt < new Date();
                    return (
                      <li key={tk.id}>
                        <Link href={`/help/tickets/${tk.id}`} className="flex items-center gap-3 py-3 hover:text-brand-700">
                          <span className="shrink-0 font-mono text-tab text-ink-subtle">#{tk.number}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm font-semibold">{tk.subject}</span>
                            <span className={late ? "text-tab text-risk-600" : "text-tab text-ink-subtle"}>
                              {late ? tr("slaLate") : tr("sla", { date: format.dateTime(tk.slaDueAt, { dateStyle: "medium", timeStyle: "short" }) })}
                            </span>
                          </span>
                          <Pill tone={tk.status === "answered" ? "safe" : tk.status === "closed" ? "neutral" : tk.status === "in_progress" ? "warn" : "brand"}>{tr(`status.${tk.status}`)}</Pill>
                          <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<Ticket />} title={tr("noTickets")} />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tr("faq")} />
            <CardBody className="grid gap-2">
              {faq.map((f) => (
                <details key={f.q} className="group rounded-lg border border-line px-4 py-3 open:bg-sunken/60">
                  <summary className="cursor-pointer list-none text-body-sm font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {f.q}
                      <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90 rtl:group-open:-rotate-90" />
                    </span>
                  </summary>
                  <p className="mt-2 text-body-sm text-ink-muted">{f.a}</p>
                </details>
              ))}
            </CardBody>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title={tr("feedback")} description={tr("feedbackBody")} icon={<MessageSquareHeart />} />
          <CardBody>
            <FeedbackForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
