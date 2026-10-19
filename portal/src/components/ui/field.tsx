import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line-strong bg-surface px-3.5 text-body-sm text-ink placeholder:text-ink-disabled transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-line-control focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-sunken disabled:text-ink-disabled aria-invalid:border-risk-500 aria-invalid:focus:ring-risk-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-11 appearance-none bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat pr-10",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6788' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-caption font-semibold text-ink", className)} {...props} />;
}

/** Label + control + hint + error, wired for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional ? <span className="text-tab-sm text-ink-subtle">{optional}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-caption text-risk-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-caption text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, label, description, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-body-sm", className)}>
      <input
        type="checkbox"
        className={"mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-xs border-2 border-line-control bg-surface bg-center bg-no-repeat transition-colors checked:border-brand-600 checked:bg-brand-600 checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E\")] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"}
        {...props}
      />
      <span className="grid gap-0.5">
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="text-caption text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Accessible on/off switch backed by a real checkbox (works without JavaScript inside forms). */
export function Switch({ className, label, description, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", className)}>
      <span className="grid gap-0.5">
        <span className="text-body-sm font-semibold text-ink">{label}</span>
        {description ? <span className="text-caption text-ink-muted">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-7 w-12 rounded-pill bg-line-strong transition-colors duration-(--duration-base) peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-white shadow-xs transition-transform duration-(--duration-base) ease-(--ease-out-expo) peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Segmented control from radio inputs (Cyclowareness "Full | Calm | Still"). */
export function Segmented({
  name,
  options,
  defaultValue,
  value,
  onChange,
  className,
  size = "md",
  fullWidth = false,
  ariaLabel,
}: {
  name: string;
  options: { value: string; label: ReactNode }[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-pill bg-sunken p-1", fullWidth && "flex w-full", className)}>
      {options.map((o) => (
        <label key={o.value} className={cn("relative", fullWidth && "flex-1")}>
          <input
            type="radio"
            name={name}
            value={o.value}
            className="peer sr-only"
            {...(value !== undefined ? { checked: value === o.value, onChange: () => onChange?.(o.value) } : { defaultChecked: defaultValue === o.value })}
          />
          <span
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-pill font-semibold text-ink-muted transition-all duration-(--duration-fast) peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-xs peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600 hover:text-ink",
              { sm: "h-8 px-3 text-tab", md: "h-9 px-4 text-caption", lg: "h-12 px-5 text-body" }[size],
            )}
          >
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}
