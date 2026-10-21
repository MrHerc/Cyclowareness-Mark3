import { PageSkeleton, RowsSkeleton } from "@/components/ui/skeleton";

/** Department league placeholder: title with the month line, then the ranked department rows. */
export default function AdminLeagueLoading() {
  return (
    <PageSkeleton className="gap-6">
      <RowsSkeleton count={5} className="h-24" />
    </PageSkeleton>
  );
}
