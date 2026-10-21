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

/** Small sizes grow to a 44 px touch target on coarse pointers (phones, tablets), the size of `md` and `icon`. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-caption pointer-coarse:h-11",
  md: "h-11 px-5 text-body-sm",
  lg: "h-13 px-7 text-body",
  icon: "size-11 text-body",
  "icon-sm": "size-9 text-caption pointer-coarse:size-11",
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

export type TextButtonTone = "brand" | "muted" | "danger";

const textTones: Record<TextButtonTone, string> = {
  brand: "text-brand-600",
  muted: "text-ink-muted hover:text-ink",
  danger: "text-risk-600",
};

/**
 * A link-styled text button ("Remove photo", "Copy invite link"). Text alone is a 15–20 px line, so
 * on coarse pointers it grows to the 44 px touch target with min-height/min-width only: no padding or
 * negative margins, so it never bleeds past its container and call-site margins (ml-auto, mt-1) survive.
 */
export function textButtonClass(tone: TextButtonTone = "brand", size: "tab" | "caption" = "caption", className?: string) {
  return cn(
    "inline-flex items-center gap-1 font-semibold hover:underline disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center [&_svg]:shrink-0",
    size === "tab" ? "text-tab" : "text-caption",
    textTones[tone],
    className,
  );
}

export function TextButton({ tone, size, className, type = "button", ...props }: { tone?: TextButtonTone; size?: "tab" | "caption" } & ComponentProps<"button">) {
  return <button type={type} className={textButtonClass(tone, size, className)} {...props} />;
}

/**
 * Grows a text link or a checkbox label to the 44 px touch target on coarse pointers without moving
 * anything: block padding of (44 px − one line) / 2, given back by an equal negative block margin, so
 * the line, table row or card keeps its height and the text stays where it was. Fine pointers are
 * untouched, and so are browsers without the `lh` unit (the declarations are dropped). Use it on a
 * block, flex or inline-flex element (an inline <a> takes no vertical margin). On coarse pointers it
 * replaces the call site's vertical margins: a link that needs `mt-3` there restates it as
 * `pointer-coarse:mt-[calc(0.75rem_-_max(0px,calc((2.75rem_-_1lh)/2)))]`.
 */
export const coarseHitArea = "pointer-coarse:py-[max(0px,calc((2.75rem_-_1lh)/2))] pointer-coarse:-my-[max(0px,calc((2.75rem_-_1lh)/2))]";

/** A text link in running content ("All people", "View certificate", "SB-512" in a table cell), with that 44 px coarse hit area. */
export function textLinkClass(className?: string) {
  return cn(coarseHitArea, className);
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
