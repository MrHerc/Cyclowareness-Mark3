import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="grid gap-2">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
