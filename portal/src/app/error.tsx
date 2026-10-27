"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { RetryButton } from "@/components/retry-button";
import { isAppPath } from "@/lib/app-paths";

/** Error boundary for every page below the root layout. Details stay in the server log. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tc = useTranslations("common");
  const pathname = usePathname();
  // The proxy sends anyone without a session away from app paths, so an error there means a signed-in
  // visitor (the session cookie is httpOnly, so the path is what a client component can go by). Home is
  // the app for them and the public site anywhere else (site, sign-in, public links).
  const home = isAppPath(pathname) ? "/app" : "/";
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
          <Link href={home} className="inline-flex h-11 items-center rounded-pill px-5 font-semibold text-ink-muted ring-1 ring-line hover:bg-sunken hover:text-ink">
            {tc("errors.goHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
