import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * A scrolling wrapper for a wide table (`axis="x"`, the default) or a capped-height list (`axis="y"`,
 * give it the max height). The scrolled-away part is otherwise out of reach, so the wrapper must be
 * reachable from the keyboard even when it holds no link or button (WCAG 2.1.1, axe
 * scrollable-region-focusable): it is focusable, exposed as a named region (`label`, translated,
 * usually the table's heading) and draws the focus ring inside its own edge so a parent card cannot
 * clip it. Usable from server and client components alike.
 */
export function ScrollRegion({ label, axis = "x", className, ...props }: Omit<ComponentProps<"div">, "role" | "tabIndex" | "aria-label"> & { label: string; axis?: "x" | "y" }) {
  return <div tabIndex={0} role="region" aria-label={label} className={cn(axis === "y" ? "overflow-y-auto" : "overflow-x-auto", "focus-visible:-outline-offset-2", className)} {...props} />;
}
