import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Closed-loop placeholder while it loads: the back link stays, the header, the stage track, the timeline and the side cards are grey blocks. */
export default async function LoopLoading() {
  const tn = await getTranslations("admin.nav");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/loops">{tn("loops")}</BackLink>
      <PageSkeleton icon action>
        <Skeleton className="h-28" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Skeleton className="h-80" />
          <div className="grid content-start gap-5">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </PageSkeleton>
    </div>
  );
}
