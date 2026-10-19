import Link from "next/link";
import { cn } from "@/lib/cn";

/** Product mark: the mascot shield + wordmark (as in the original rail and sign-in header). */
export function BrandMark({ className, href = "/", compact = false, label }: { className?: string; href?: string; compact?: boolean; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("inline-flex items-center gap-2.5 font-display text-title-sm font-bold tracking-tight text-ink", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon.svg" alt="" width={32} height={32} className="size-8 rounded-sm" />
      {compact ? <span className="sr-only">Cyclowareness</span> : <span>Cyclowareness</span>}
    </Link>
  );
}

export function TenantMark({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-8 w-auto max-w-40 shrink-0 object-contain" />
      ) : (
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-brand-600 text-tab font-bold text-brand-on">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="truncate text-body-sm font-semibold text-ink">{name}</span>
    </span>
  );
}
