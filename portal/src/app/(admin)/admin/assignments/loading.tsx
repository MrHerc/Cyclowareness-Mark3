import { PageSkeleton, RowsSkeleton } from "@/components/ui/skeleton";

/** Assignments placeholder: header with the assign action and the assignment rows. */
export default function AssignmentsLoading() {
  return (
    <PageSkeleton action>
      <RowsSkeleton count={5} className="h-24" />
    </PageSkeleton>
  );
}
