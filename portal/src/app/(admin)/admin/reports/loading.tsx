import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Reports placeholder: header, the period and department filters, the report cards, then the feedback and schedule cards. */
export default function ReportsLoading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-11 rounded-pill" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </PageSkeleton>
  );
}
