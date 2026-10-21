import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** League placeholder: header with the days-left pill, the podium and ranked rows on the left, the how-it-works card on the right. */
export default async function LeagueLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-wrap items-end justify-between gap-4 lg:col-span-2">
        <div className="grid gap-1.5">
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-8 w-32 rounded-pill" />
      </div>
      <div className="grid min-w-0 gap-6">
        <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
          <Skeleton className="h-44 rounded-t-xl rounded-b-none" />
          <Skeleton className="h-56 rounded-t-xl rounded-b-none" />
          <Skeleton className="h-36 rounded-t-xl rounded-b-none" />
        </div>
        <div className="grid gap-2.5">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
      <Skeleton className="h-72 lg:self-start" />
    </div>
  );
}
