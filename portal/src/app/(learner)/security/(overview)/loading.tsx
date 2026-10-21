import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * My-security placeholder: header with the report button, notice, three stats, the open-risks list and the cards below.
 * It lives in the (overview) group so its Suspense boundary covers /security only: above /security/sandbox it would
 * stream before that page's feature check, turning a tenant without the sandbox into HTTP 200 instead of 404.
 */
export default async function SecurityLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1.5">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-11 w-40 rounded-pill" />
      </div>
      <Skeleton className="h-14" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-36" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-20" />
        </div>
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
