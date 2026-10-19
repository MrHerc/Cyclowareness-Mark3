import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Admin page placeholder while the server render finishes. */
export default async function AdminLoading() {
  const tc = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{tc("loading")}</span>
      <div className="grid gap-2">
        <Skeleton className="h-10 w-56 max-w-full rounded-lg" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
