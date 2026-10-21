import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Operator console placeholder (tenants and demo requests share the shape): header with its action, the tabs and the rows. */
export default function OperatorLoading() {
  return (
    <PageSkeleton icon action>
      <TabsSkeleton count={3} />
      <RowsSkeleton count={4} className="h-28" />
    </PageSkeleton>
  );
}
