import Link from "next/link";
import { cn } from "@/lib/cn";

/** The company behind the product; a brand name, so it is not translated. */
export const VENDOR = "Safarov Industries";

/** The vendor's wordmark as the demo tenant's logo (scripts/seed.ts) and a small copy for the sidebar lockup. */
const VENDOR_LOGO = "/brand/safarov-industries-wordmark.png";
const VENDOR_LOGO_SMALL = "/brand/safarov-industries-wordmark-sm.png";

/** The tenant's logo is the vendor's wordmark, which the sidebar lockup already shows: the header leaves it out. */
export function isVendorLogo(logoUrl: string | null | undefined): boolean {
  return logoUrl === VENDOR_LOGO || logoUrl === VENDOR_LOGO_SMALL;
}

/**
 * Product mark: AI Sel's cat head + wordmark (as in the original rail and sign-in header).
 * `byline` adds the two-line lockup used in the sidebars: "Cyclowareness" over the Safarov Industries wordmark.
 */
export function BrandMark({ className, href = "/", compact = false, byline = false, label }: { className?: string; href?: string; compact?: boolean; byline?: boolean; label?: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("inline-flex items-center gap-2.5 font-display text-title-sm font-bold tracking-tight text-ink", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon.svg" alt="" width={32} height={32} className={cn("shrink-0 rounded-sm", byline ? "size-9" : "size-8")} />
      {compact ? (
        <span className="sr-only">Cyclowareness</span>
      ) : byline ? (
        <span className="flex min-w-0 flex-col">
          <span className="leading-tight">Cyclowareness</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={VENDOR_LOGO_SMALL} alt={VENDOR} width={480} height={50} className="mt-1 h-3.5 w-auto max-w-full self-start object-contain" />
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
        <img src={logoUrl} alt="" className="h-8 w-auto min-w-8 max-w-32 shrink object-contain object-left rtl:object-right sm:h-10 sm:max-w-64" />
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
