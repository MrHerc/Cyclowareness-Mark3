import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Learning paths placeholder: header with its icon and the two-column grid of path cards. */
export default async function PathsLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-6 flex items-center gap-4 sm:mb-8">
        <Skeleton className="size-12 shrink-0 rounded-lg" />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-9 w-48 max-w-full rounded-md" />
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-60" />
        ))}
      </div>
    </div>
  );
}
