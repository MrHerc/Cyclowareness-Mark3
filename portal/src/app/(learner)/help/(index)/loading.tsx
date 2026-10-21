import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Help placeholder: header with its two actions, the tickets and FAQ cards on the left, the feedback card on the right.
 * It lives in the (index) group so its Suspense boundary covers /help only: above /help/tickets/[id] it would stream
 * before that page's notFound(), turning a missing ticket into HTTP 200.
 */
export default async function HelpLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 w-40 rounded-pill" />
          <Skeleton className="h-11 w-36 rounded-pill" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-72 self-start" />
      </div>
    </div>
  );
}
