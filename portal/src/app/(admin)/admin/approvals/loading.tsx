import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Approvals placeholder: header, the queue tabs and the material cards awaiting a decision. */
export default function ApprovalsLoading() {
  return (
    <PageSkeleton icon>
      <TabsSkeleton count={3} />
      <RowsSkeleton count={2} className="h-60" />
    </PageSkeleton>
  );
}
