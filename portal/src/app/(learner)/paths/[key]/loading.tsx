import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Path page placeholder: back link, header and the module roadmap on the left, the progress, standards and badge cards on the right. */
export default async function PathLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <span className="sr-only">{t("loading")}</span>
      <div className="min-w-0">
        <Skeleton className="h-4 w-20 rounded-md" />
        <div className="mt-4 mb-6 flex items-center gap-4 sm:mb-8">
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-9 w-72 max-w-full rounded-md" />
            <Skeleton className="h-4 w-80 max-w-full rounded-md" />
          </div>
        </div>
        <Skeleton className="mb-4 h-6 w-28 rounded-md" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="mt-3 size-11 shrink-0 rounded-full" />
              <Skeleton className="h-20 min-w-0 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-4">
        <Skeleton className="h-60" />
        <Skeleton className="h-32" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}
