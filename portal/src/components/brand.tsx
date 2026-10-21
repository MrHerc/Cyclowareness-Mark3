import Link from "next/link";
import { cn } from "@/lib/cn";

/** The company behind the product; a brand name, so it is not translated. */
export const VENDOR = "Safarov Industries";

/**
 * Product mark: the mascot shield + wordmark (as in the original rail and sign-in header).
 * `byline` adds the two-line lockup "Cyclowareness / by Safarov Industries" used in the sidebars.
 */
export function BrandMark({ className, href = "/", compact = false, byline = false, label }: { className?: string; href?: string; compact?: boolean; byline?: boolean; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("inline-flex items-center gap-2.5 font-display text-title-sm font-bold tracking-tight text-ink", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon.svg" alt="" width={32} height={32} className={cn("rounded-sm", byline ? "size-9" : "size-8")} />
      {compact ? (
        <span className="sr-only">Cyclowareness</span>
      ) : byline ? (
        <span className="flex flex-col">
          <span className="leading-tight">Cyclowareness</span>
          <span className="mt-0.5 font-sans text-tab-sm font-medium tracking-normal text-ink-subtle">
            by <span className="font-semibold text-ink-muted">{VENDOR}</span>
          </span>
        </span>
      ) : (
        <span>Cyclowareness</span>
      )}
    </Link>
  );
}

export function TenantMark({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-8 w-auto min-w-8 max-w-32 shrink object-contain object-left sm:h-10 sm:max-w-64" />
      ) : (
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-brand-600 text-tab font-bold text-brand-on">
          {name.slice(0, 1)}
        </span>
      )}
      {/* A logo identifies the organisation on its own (it usually contains the name); the name stays in the accessibility tree. */}
      <span className={cn("text-body-sm font-semibold text-ink", logoUrl ? "sr-only" : "truncate")}>{name}</span>
    </span>
  );
}
