"use client";

import { useSyncExternalStore } from "react";
import { useClientFormat } from "@/lib/client-format";

const subscribe = () => () => {};

/**
 * "6 saat öncə" rendered only after hydration: the server's clock and ICU data differ from the
 * browser's, so formatting a relative time during SSR produces a hydration mismatch.
 */
export function RelativeTime({ date, className }: { date: Date | string | number; className?: string }) {
  const format = useClientFormat();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={new Date(date).toISOString()} className={className}>
      {hydrated ? format.relativeTime(new Date(date)) : null}
    </time>
  );
}
