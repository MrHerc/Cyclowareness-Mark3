import { PageSkeleton, RowsSkeleton, Skeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Feedback placeholder: header, the average and per-module cards, the topic tabs and the comments. */
export default function FeedbackLoading() {
  return (
    <PageSkeleton icon>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <TabsSkeleton count={5} />
      <RowsSkeleton count={3} className="h-24" />
    </PageSkeleton>
  );
}
