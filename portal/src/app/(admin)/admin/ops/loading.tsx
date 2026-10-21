import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Ops center placeholder: header, the five counters, then the live and pipeline cards beside the side column. */
export default function OpsCenterLoading() {
  return (
    <PageSkeleton icon className="gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </PageSkeleton>
  );
}
