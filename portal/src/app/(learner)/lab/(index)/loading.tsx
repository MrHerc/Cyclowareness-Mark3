import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Lab placeholder: header with its icon, the info notice and the grid of game and machine-lab cards. */
export default async function LabLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-6 flex items-center gap-4 sm:mb-8">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-9 w-40 max-w-full rounded-md" />
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="h-14" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </div>
  );
}
