import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Game placeholder: back link, the game's title and description, and the play area. */
export default async function GameLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-busy="true" className="grid gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="mb-6 grid gap-4 sm:mb-8">
        <Skeleton className="h-4 w-20 rounded-md" />
        <div className="grid gap-1.5">
          <Skeleton className="h-9 w-64 max-w-full rounded-md" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="h-[28rem]" />
    </div>
  );
}
