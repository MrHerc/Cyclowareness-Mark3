"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useClientFormat } from "@/lib/client-format";
import { Bell, CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { cn } from "@/lib/cn";
import { coarseHitArea } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

export type NotificationItem = { id: string; title: string; body: string | null; href: string | null; createdAt: string; read: boolean };

export function NotificationsButton({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("common");
  const format = useClientFormat();
  const [open, setOpen] = useState(false);
  const { run: markRead, pending } = useAction(markNotificationsReadAction);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? t("notifications.buttonUnread", { count: unread }) : t("nav.notifications")}
        className="relative grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-muted hover:text-ink pointer-coarse:size-11"
      >
        <Bell className="size-[1.15rem]" />
        {unread ? <span className="absolute top-1.5 end-1.5 size-2.5 rounded-full border-2 border-surface bg-reward-500" /> : null}
      </button>
      {open ? (
        // Phones: pinned to the viewport under the top bar, since the bell is not at the header's right edge everywhere
        // (learner header) and a panel anchored to it would hang off the left side. From sm up it drops from the bell.
        <div
          role="dialog"
          aria-label={t("notifications.title")}
          className="fixed inset-x-4 top-[calc(var(--topbar-height)+var(--safe-top)+0.5rem)] z-50 animate-rise overflow-hidden rounded-xl border border-line bg-surface shadow-overlay sm:absolute sm:inset-x-auto sm:top-full sm:end-0 sm:mt-2 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-body-sm font-semibold">{t("notifications.title")}</p>
            {unread ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => markRead()}
                className={cn("inline-flex items-center gap-1 text-tab font-semibold text-brand-600 hover:underline disabled:opacity-50", coarseHitArea)}
              >
                <CheckCheck className="size-4" />
                {t("notifications.markAll")}
              </button>
            ) : null}
          </div>
          {items.length ? (
            <ul className="max-h-[min(24rem,calc(100dvh-var(--topbar-height)-var(--safe-top)-6rem))] divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <div className="flex gap-3 px-4 py-3">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-reward-500")} />
                    <div className="min-w-0">
                      <p className="text-caption font-semibold text-ink">{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-tab text-ink-muted">{n.body}</p> : null}
                      <p className="mt-1 text-tab-sm text-ink-subtle">{format.relativeTime(new Date(n.createdAt))}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)} className="block hover:bg-sunken">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-caption text-ink-muted">{t("notifications.empty")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
