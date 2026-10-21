import { PageSkeleton, Skeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Risk profiles placeholder: header, the band summary card, the explainer notice, the band tabs and the people table. */
export default function RiskProfilesLoading() {
  return (
    <PageSkeleton icon>
      <Skeleton className="h-28" />
      <Skeleton className="h-14" />
      <TabsSkeleton count={4} />
      <Skeleton className="h-96" />
    </PageSkeleton>
  );
}
