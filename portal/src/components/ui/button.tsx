import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "danger-soft" | "safe";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out-quart) active:scale-[.98] disabled:pointer-events-none aria-disabled:pointer-events-none [&_svg]:size-[1.15em] [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-brand-on shadow-xs hover:bg-brand-700 disabled:bg-sunken disabled:text-ink-disabled disabled:shadow-none aria-disabled:bg-sunken aria-disabled:text-ink-disabled aria-disabled:shadow-none",
  accent: "bg-reward-500 text-(--accent-on) shadow-xs hover:bg-reward-600 disabled:bg-sunken disabled:text-ink-disabled disabled:shadow-none aria-disabled:bg-sunken aria-disabled:text-ink-disabled aria-disabled:shadow-none",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken disabled:opacity-50 aria-disabled:opacity-50",
  ghost: "text-ink-muted hover:bg-sunken hover:text-ink disabled:opacity-50 aria-disabled:opacity-50",
  danger: "bg-risk-600 text-white hover:bg-risk-700 disabled:bg-sunken disabled:text-ink-disabled disabled:shadow-none aria-disabled:bg-sunken aria-disabled:text-ink-disabled aria-disabled:shadow-none",
  "danger-soft": "border border-risk-100 bg-risk-50 text-risk-600 hover:bg-risk-100 disabled:opacity-50 aria-disabled:opacity-50",
  safe: "bg-safe-600 text-white hover:bg-safe-700 disabled:bg-sunken disabled:text-ink-disabled disabled:shadow-none aria-disabled:bg-sunken aria-disabled:text-ink-disabled aria-disabled:shadow-none",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-caption",
  md: "h-11 px-5 text-body-sm",
  lg: "h-13 px-7 text-body",
  icon: "size-11 text-body",
  "icon-sm": "size-9 text-caption",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; iconRight?: ReactNode };

export function Button({ variant, size, icon, iconRight, className, children, type = "button", ...props }: Common & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconRight, className, children, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

/** Plain anchor for downloads and route handlers (no client-side navigation). */
export function ButtonAnchor({ variant, size, icon, iconRight, className, children, ...props }: Common & ComponentProps<"a">) {
  return (
    <a className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
      {iconRight}
    </a>
  );
}
