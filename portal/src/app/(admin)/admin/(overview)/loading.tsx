import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Overview placeholder: header with the department filter, the KPI strip, the tip card, then the charts and tables. */
export default function OverviewLoading() {
  return (
    <PageSkeleton action className="gap-6">
      <Skeleton className="h-32" />
      <Skeleton className="h-20" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </PageSkeleton>
  );
}
