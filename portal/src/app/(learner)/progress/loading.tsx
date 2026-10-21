import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Progress placeholder: title, the level block with its stat cards, started modules, the two charts and the badge grid. */
export default async function ProgressLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-9 w-40 rounded-md" />
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32 sm:col-span-2" />
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
