import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The "← back" link above a page header: PageHeader's `back`, and the copies that loading.tsx files and
 * pages without a PageHeader draw. On a coarse pointer it grows to a 44 px target; the negative margin
 * keeps the row where it was.
 */
export function BackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex w-fit items-center gap-1 text-caption font-semibold text-brand-700 hover:text-brand-900 pointer-coarse:-my-3 pointer-coarse:min-h-11", className)}>
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  );
}

/** H1 + context line + primary action, as in the original admin and learner pages. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: ReactNode };
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:mb-8", className)}>
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {icon ? <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-600 text-brand-on shadow-raised [&_svg]:size-6">{icon}</span> : null}
          <div className="min-w-0">
            <h1 className="text-headline font-bold text-balance text-ink">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-body-sm text-ink-muted">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon ? <span className="mb-4 grid size-16 place-items-center rounded-full bg-sunken text-ink-subtle [&_svg]:size-7">{icon}</span> : null}
      <p className="text-title-sm font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-body-sm text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** KPI tile (count-up happens client-side in <CountUp/>). */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "brand",
  trend,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "risk" | "safe" | "warn" | "reward" | "violet" | "cyan";
  trend?: ReactNode;
  className?: string;
}) {
  const iconTone = {
    brand: "bg-brand-50 text-brand-600",
    risk: "bg-risk-50 text-risk-600",
    safe: "bg-safe-50 text-safe-600",
    warn: "bg-warn-50 text-warn-700",
    reward: "bg-reward-100 text-reward-ink",
    violet: "bg-[#f3eefe] text-[#6d28d9]",
    cyan: "bg-[#e6f6fa] text-[#0b6a80]",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-raised", className)}>
      {icon ? <span className={cn("grid size-10 place-items-center rounded-sm [&_svg]:size-5", iconTone)}>{icon}</span> : null}
      <div>
        <p className="text-numeral font-bold text-ink tabular-nums">{value}</p>
        <p className="mt-1.5 text-caption font-medium text-ink-muted">{label}</p>
      </div>
      {hint || trend ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 text-tab text-ink-subtle">
          {trend}
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Horizontal tab bar of links (settings tabs, intel tabs, filters). "segmented" is the sunken strip
 * with a raised white active pill used by the settings tabs.
 */
export function TabsNav({
  items,
  className,
  label,
  variant = "pills",
}: {
  items: { href: string; label: ReactNode; active: boolean; count?: number; icon?: ReactNode }[];
  className?: string;
  label?: string;
  variant?: "pills" | "segmented";
}) {
  const segmented = variant === "segmented";
  return (
    <nav
      aria-label={label}
      // min-w-0 + max-w-full: the row scrolls inside its own box on phones instead of widening the page
      // (page grids use minmax(0, 1fr) tracks); as a flex item it still keeps the width of its pills.
      className={cn(segmented ? "scrollbar-none flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-pill bg-sunken p-1" : "scrollbar-none -mx-1 flex min-w-0 max-w-full gap-1.5 overflow-x-auto px-1 pb-1", className)}
    >
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-pill px-4 text-caption font-semibold transition-colors pointer-coarse:h-11 [&_svg]:size-4",
            segmented
              ? i.active
                ? "bg-surface text-ink shadow-xs"
                : "text-ink-muted hover:text-ink"
              : i.active
                ? "bg-ink text-white"
                : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink",
          )}
        >
          {i.icon}
          {i.label}
          {i.count !== undefined ? <span className={cn("rounded-pill px-1.5 text-tab-sm tabular-nums", i.active ? "bg-white/20" : "bg-sunken")}>{i.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Sortable table header cell: a link that sets the sort column/direction in the URL. On coarse pointers the
 * link grows to the 44 px touch target; the negative vertical margin lets it reach into the cell's own
 * padding instead of making the header row taller by the full amount.
 */
export function SortHeader({ label, active, dir, href, className }: { label: ReactNode; active: boolean; dir: "asc" | "desc"; href: string; className?: string }) {
  return (
    <th aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} className={className}>
      <Link href={href} scroll={false} className="inline-flex items-center gap-1 font-semibold hover:text-ink pointer-coarse:-my-2.5 pointer-coarse:min-h-11">
        {label}
        {active ? dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 text-ink-disabled" aria-hidden />}
      </Link>
    </th>
  );
}

export function Notice({ tone = "info", icon, title, children, action, className }: { tone?: "info" | "warn" | "risk" | "safe" | "brand"; icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const styles = {
    info: "border-[#bfe6f0] bg-[#eef9fc] text-[#0b5566]",
    warn: "border-warn-100 bg-warn-50 text-warn-700",
    risk: "border-risk-100 bg-risk-50 text-risk-700",
    safe: "border-safe-100 bg-safe-50 text-safe-700",
    brand: "border-brand-100 bg-brand-50 text-brand-700",
  }[tone];
  // The action moves under the text when both do not fit (phones), instead of forcing the row wider than the screen.
  return (
    <div className={cn("flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3.5 text-body-sm", styles, className)}>
      <div className="flex min-w-0 flex-[1_1_16rem] items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-5">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
