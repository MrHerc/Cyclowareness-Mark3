import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Home placeholder: greeting with the mascot, the continue card and the path timeline on the left, the goal, streak and XP cards on the right.
 * It lives in the (home) group so its Suspense boundary covers / only: at the learner root it would wrap every learner page and stream
 * before their feature and id checks, turning those 404s into HTTP 200.
 */
export default async function HomeLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="grid min-w-0 content-start gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-9 w-64 max-w-full rounded-md" />
            <Skeleton className="h-5 w-80 max-w-full rounded-md" />
          </div>
          <Skeleton className="size-32 shrink-0 rounded-full sm:size-40" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
