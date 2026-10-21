import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Departments placeholder: header and the department tree. */
export default function DepartmentsLoading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-[28rem]" />
    </PageSkeleton>
  );
}
