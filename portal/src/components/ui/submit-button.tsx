"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import type { ReactNode } from "react";

/**
 * Submit button that shows a spinner and blocks double submits while the form action runs. A form
 * submitted through a transition instead of `<form action>` (so a rejected submit keeps what was
 * typed) is never pending for `useFormStatus`, so it passes its own `pending` instead.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  icon,
  className,
  disabled,
  name,
  value,
  pending: pendingProp,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      icon={pending ? <Loader2 className="animate-spin" /> : icon}
      name={name}
      value={value}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
