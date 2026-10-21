import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Threat reports placeholder: header, the status tabs and the report rows. */
export default function ThreatsLoading() {
  return (
    <PageSkeleton icon>
      <TabsSkeleton count={5} />
      <RowsSkeleton count={4} className="h-28" />
    </PageSkeleton>
  );
}
