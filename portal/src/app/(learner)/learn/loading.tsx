import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Catalog placeholder while the modules load: title, search, view switches, category chips and cards. */
export default async function LearnLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <Skeleton className="h-12 w-full rounded-pill sm:w-96" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Skeleton className="h-11 w-44 rounded-pill" />
        <Skeleton className="h-11 w-44 rounded-pill" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-pill" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}
