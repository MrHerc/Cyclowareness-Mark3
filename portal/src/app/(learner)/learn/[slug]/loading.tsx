import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Module page placeholder, in the page's order: back link, pills, title and subtitle; the card with the main action
 * (beside the rest on wide screens); "What you will learn", the lessons and the practice labs.
 */
export default async function ModuleLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="min-w-0">
        <Skeleton className="h-4 w-20 rounded-md" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-pill" />
          <Skeleton className="h-6 w-24 rounded-pill" />
        </div>
        <Skeleton className="mt-3 h-12 w-80 max-w-full rounded-md" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full rounded-md" />
      </div>
      <Skeleton className="h-[34rem] lg:col-start-2 lg:row-span-2 lg:row-start-1" />
      <div className="min-w-0 lg:col-start-1">
        <Skeleton className="mb-3 h-6 w-40 rounded-md" />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="mt-8 mb-3 h-6 w-24 rounded-md" />
        <div className="grid gap-2.5">
          <Skeleton className="h-18" />
          <Skeleton className="h-18" />
          <Skeleton className="h-18" />
        </div>
        <Skeleton className="mt-8 mb-3 h-6 w-28 rounded-md" />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Skeleton className="h-18" />
          <Skeleton className="h-18" />
        </div>
      </div>
    </div>
  );
}
