import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Profile placeholder: the photo header, then the certificate, policy, account, security and data cards in one column. */
export default async function ProfileLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="mx-auto grid max-w-3xl gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i}>
          <Skeleton className="mb-2.5 h-5 w-32 rounded-md" />
          <Skeleton className="h-36" />
        </div>
      ))}
    </div>
  );
}
