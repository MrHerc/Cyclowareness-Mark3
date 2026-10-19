import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Module page placeholder: back link, category pill, title and lessons on the left, the sticky card on the right. */
export default async function ModuleLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="min-w-0">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="mt-4 h-6 w-16 rounded-pill" />
        <Skeleton className="mt-3 h-12 w-80 max-w-full rounded-md" />
        <Skeleton className="mt-8 mb-3 h-6 w-24 rounded-md" />
        <div className="grid gap-2.5">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
      <Skeleton className="h-[30rem]" />
    </div>
  );
}
