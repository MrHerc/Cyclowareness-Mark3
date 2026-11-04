"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * A side panel on a native modal <dialog> (as the admin menu): focus trap, Escape, an inert page and focus
 * returning to the button that opened it come with the platform. It slides in from its side in the reading
 * direction (`start`: left in LTR, right in RTL); Still and the OS setting shorten the transition to nothing.
 */
export function Drawer({ open, onClose, side, title, children }: { open: boolean; onClose: () => void; side: "start" | "end"; title: string; children: ReactNode }) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "inset-y-0 m-0 h-dvh max-h-none w-[min(22rem,90vw)] max-w-none overflow-y-auto overscroll-contain border-0 bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/30 backdrop:backdrop-blur-sm",
        "transition-[translate] duration-(--duration-slow) ease-(--ease-out-expo)",
        side === "start" ? "start-0 end-auto starting:open:-translate-x-full rtl:starting:open:translate-x-full" : "start-auto end-0 starting:open:translate-x-full rtl:starting:open:-translate-x-full",
      )}
    >
      {open ? (
        <div className="flex min-h-full flex-col pt-(--safe-top) pb-(--safe-bottom)">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line/60 bg-surface px-5 py-3">
            <h2 className="min-w-0 flex-1 text-title-sm font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label={t("close")} className="-me-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink pointer-coarse:size-11">
              <X className="size-5" />
            </button>
          </header>
          <div className="flex-1 px-5 py-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
