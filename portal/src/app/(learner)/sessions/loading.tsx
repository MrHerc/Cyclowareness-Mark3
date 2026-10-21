import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Live-sessions placeholder: header, the upcoming heading and session cards. */
export default async function SessionsLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="grid gap-1.5">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
