import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/** Loading placeholder: a sunken radius-xl block with a shimmer sweep, as in the original. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-xl bg-sunken before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent",
        className,
      )}
    />
  );
}

/**
 * Page placeholder for a loading.tsx: a busy status region with the PageHeader's shape (icon tile, title
 * and subtitle lines, action pill, each only where the page has one) above the page's own blocks.
 */
export function PageSkeleton({ icon, action, className, children }: { icon?: boolean; action?: boolean; className?: string; children: ReactNode }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" className={cn("grid gap-5", className)}>
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-4 sm:mb-3">
        <div className="flex min-w-0 items-center gap-4">
          {icon ? <Skeleton className="size-12 shrink-0 rounded-lg" /> : null}
          <div className="grid gap-2">
            <Skeleton className="h-9 w-56 max-w-full rounded-md" />
            <Skeleton className="h-4 w-72 max-w-full rounded-md" />
          </div>
        </div>
        {action ? <Skeleton className="h-11 w-40 rounded-pill" /> : null}
      </div>
      {children}
    </div>
  );
}

/** A TabsNav placeholder: a row of pills. */
export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-pill" />
      ))}
    </div>
  );
}

/** A list placeholder: `count` row blocks of the given height. */
export function RowsSkeleton({ count = 4, className = "h-20" }: { count?: number; className?: string }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
