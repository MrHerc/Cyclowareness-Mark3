"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useClientFormat } from "@/lib/client-format";
import { Send } from "lucide-react";
import { replyTicketAction } from "@/server/actions/engage";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type ThreadMessage = { id: string; authorName: string; mine: boolean; staff: boolean; body: string; at: string };

export function TicketThread({ ticketId, messages, closed }: { ticketId: string; messages: ThreadMessage[]; closed: boolean }) {
  const t = useTranslations("learner.help");
  const format = useClientFormat();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4">
      <ol className="grid gap-3">
        {messages.map((m) => (
          <li key={m.id} className={cn("flex gap-3", m.mine && "flex-row-reverse")}>
            <Avatar name={m.authorName} size="sm" />
            <div className={cn("min-w-0 max-w-[80%] rounded-2xl px-4 py-3 [overflow-wrap:anywhere]", m.mine ? "rounded-tr-sm bg-brand-600 text-brand-on" : "rounded-tl-sm bg-surface shadow-xs ring-1 ring-line")}>
              <p className={cn("text-tab font-semibold", m.mine ? "opacity-80" : "text-brand-700")}>
                {m.mine ? t("you") : m.staff ? `${m.authorName} · ${t("team")}` : m.authorName}
              </p>
              {/* Pasted links and other long tokens wrap inside the bubble instead of widening the page. */}
              <p className="mt-0.5 text-body-sm whitespace-pre-wrap">{m.body}</p>
              <p className={cn("mt-1 text-tab-sm", m.mine ? "opacity-70" : "text-ink-subtle")}>{format.dateTime(new Date(m.at), { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          </li>
        ))}
      </ol>
      {!closed ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await replyTicketAction(ticketId, body);
              if (res.ok) setBody("");
            });
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("replyPlaceholder")} aria-label={t("reply")} maxLength={5000} />
          <div className="flex justify-end">
            <Button type="submit" icon={<Send />} disabled={!body.trim() || pending}>
              {t("send")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
