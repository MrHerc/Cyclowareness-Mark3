"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { RetryButton } from "@/components/retry-button";

/** Error boundary for every page below the root layout. Details stay in the server log. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-risk-50 text-risk-600">
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="text-title font-bold">{tc("errors.errorTitle")}</h1>
        <p className="text-body-sm text-ink-muted">{tc("errors.errorBody")}</p>
        {error.digest ? <p className="font-mono text-tab text-ink-subtle">{error.digest}</p> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <RetryButton label={tc("retry")} onRetry={reset} />
          <Link href="/" className="inline-flex h-11 items-center rounded-pill px-5 font-semibold text-ink-muted ring-1 ring-line hover:bg-sunken hover:text-ink">
            {tc("errors.goHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
