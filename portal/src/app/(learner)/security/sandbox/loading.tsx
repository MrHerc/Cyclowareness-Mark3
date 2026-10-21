import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Sandbox placeholder: back link and header, the mode notice, the submission panel and the recent analyses. */
export default async function LearnerSandboxLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-6 grid gap-4 sm:mb-8">
        <Skeleton className="h-4 w-24 rounded-md" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-9 w-56 max-w-full rounded-md" />
            <Skeleton className="h-4 w-80 max-w-full rounded-md" />
          </div>
        </div>
      </div>
      <Skeleton className="h-20" />
      <Skeleton className="h-72" />
      <Skeleton className="h-64" />
    </div>
  );
}
