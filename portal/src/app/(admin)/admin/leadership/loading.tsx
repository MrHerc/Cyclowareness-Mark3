import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Leadership placeholder: header with the print action, the trend card beside the KPI column, then the department and top-risk cards. */
export default function LeadershipLoading() {
  return (
    <PageSkeleton icon action className="gap-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Skeleton className="h-80" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </PageSkeleton>
  );
}
