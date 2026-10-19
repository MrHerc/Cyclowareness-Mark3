"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Submits the surrounding form when one of its controls changes, so filters apply without an
 * Apply button. Selects submit at once; typed values (dates) wait until typing pauses.
 */
export function AutoSubmit({ children, className }: { children: ReactNode; className?: string }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div
      className={className}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => target.closest("form")?.requestSubmit(), target.tagName === "SELECT" ? 0 : 600);
      }}
    >
      {children}
    </div>
  );
}
