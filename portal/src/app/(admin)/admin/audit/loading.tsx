import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Audit log placeholder: header, the action and date filters, and the log table. */
export default function AuditLoading() {
  return (
    <PageSkeleton>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-72 max-w-full rounded-lg" />
        <Skeleton className="h-11 w-44 rounded-lg" />
        <Skeleton className="h-11 w-44 rounded-lg" />
      </div>
      <Skeleton className="h-[30rem]" />
    </PageSkeleton>
  );
}
