import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Incident placeholder while it loads: the back link stays, the header, the case cards and the side panel are grey blocks. */
export default async function IncidentLoading() {
  const tn = await getTranslations("admin.nav");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/incidents">{tn("incidents")}</BackLink>
      <PageSkeleton icon action>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <Skeleton className="h-40" />
            <Skeleton className="h-72" />
          </div>
          <div className="grid content-start gap-5">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </PageSkeleton>
    </div>
  );
}
