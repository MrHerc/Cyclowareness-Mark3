"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Modal built on the native <dialog> element: focus trap, Escape and inert background for free.
 * Closing by clicking the backdrop is supported; the blur matches the original overlay.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useTranslations("common");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-rise",
        { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size],
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[min(88dvh,56rem)] flex-col">
          <header className="flex items-start gap-4 px-6 pt-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-title font-semibold">{title}</h2>
              {description ? <p className="mt-1.5 text-body-sm text-ink-muted">{description}</p> : null}
            </div>
            <button type="button" onClick={onClose} aria-label={t("close")} className="-mt-1 -mr-2 grid size-10 place-items-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink">
              <X className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
