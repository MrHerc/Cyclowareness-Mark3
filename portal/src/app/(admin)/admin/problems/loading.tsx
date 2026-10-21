import { PageSkeleton, RowsSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Problem reports placeholder: header, the four status counters and the report rows. */
export default function ProblemsLoading() {
  return (
    <PageSkeleton>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <RowsSkeleton count={4} className="h-24" />
    </PageSkeleton>
  );
}
