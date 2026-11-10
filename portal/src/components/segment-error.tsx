"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { RetryButton } from "@/components/retry-button";

/**
 * Error boundary body for a signed-in segment: it replaces only the page, so the shell's navigation stays usable.
 * A server error's details are in the server log under the digest shown here; a client one goes to the console.
 */
export function SegmentError({ error, reset, home }: { error: Error & { digest?: string }; reset: () => void; home: string }) {
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[50dvh] place-items-center text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-risk-50 text-risk-600">
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="text-title font-bold">{tc("errors.errorTitle")}</h1>
        <p className="text-body-sm text-ink-muted">{tc("errors.sectionBody")}</p>
        {error.digest ? <p className="font-mono text-tab text-ink-subtle">{error.digest}</p> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <RetryButton label={tc("retry")} onRetry={reset} />
          <Link href={home} className="inline-flex h-11 items-center rounded-pill px-5 font-semibold text-ink-muted ring-1 ring-line hover:bg-sunken hover:text-ink">
            {tc("errors.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
