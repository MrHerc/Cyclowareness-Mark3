import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * My-security placeholder: header, the score hero, the next-step cards and the four cards below.
 * It lives in the (overview) group so its Suspense boundary covers /security only: above /security/sandbox it would
 * stream before that page's feature check, turning a tenant without the sandbox into HTTP 200 instead of 404.
 */
export default async function SecurityLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6 sm:gap-8">
      <span className="sr-only">{t("loading")}</span>
      <div className="grid gap-1.5">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-4 w-64 max-w-full rounded-md" />
      </div>
      <Skeleton className="h-96 md:h-64" />
      <div className="grid gap-4">
        <Skeleton className="h-5 w-40 rounded-md" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
