"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { TextButton } from "@/components/ui/button";

export type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; tone: "success" | "error" | "info"; message: string; action?: ToastAction };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, tone: Toast["tone"] = "success", ms = 4200, action?: ToastAction) {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message, action }].slice(-4);
  emit();
  // A toast with an action stays until dismissed, so a keyboard or screen-reader user can still reach the button (WCAG 2.2.1).
  if (!action) setTimeout(() => dismiss(id), ms);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const tc = useTranslations("common");
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-height)+var(--safe-bottom)+0.75rem)] z-80 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto relative flex w-full max-w-md animate-rise items-start gap-3 overflow-hidden rounded-lg border px-4 py-3 text-body-sm shadow-overlay",
            t.tone === "success" && "border-safe-100 bg-surface text-ink",
            t.tone === "error" && "border-risk-100 bg-risk-50 text-risk-700",
            t.tone === "info" && "border-line bg-surface text-ink",
          )}
        >
          {t.tone === "success" ? (
            <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-safe-500 to-transparent shadow-[0_0_0.75rem_0.125rem_color-mix(in_oklab,var(--color-safe-500)_45%,transparent)] print:hidden" />
          ) : null}
          {t.tone === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-safe-600" /> : t.tone === "error" ? <AlertTriangle className="mt-0.5 size-5 shrink-0" /> : <Info className="mt-0.5 size-5 shrink-0 text-brand-600" />}
          <p className="flex-1">{t.message}</p>
          {t.action ? (
            <TextButton
              tone="danger"
              className="shrink-0"
              onClick={() => {
                dismiss(t.id);
                t.action?.onClick();
              }}
            >
              {t.action.label}
            </TextButton>
          ) : null}
          <button type="button" onClick={() => dismiss(t.id)} className="text-ink-subtle hover:text-ink" aria-label={tc("close")}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
