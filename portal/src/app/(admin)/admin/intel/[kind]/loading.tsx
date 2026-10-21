import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Intel feed placeholder: header, the status tabs and the two-column grid of item cards. */
export default function IntelLoading() {
  return (
    <PageSkeleton icon>
      <TabsSkeleton count={5} />
      <div className="grid gap-4 lg:grid-cols-2">
        <RowsSkeleton count={2} className="h-64" />
        <RowsSkeleton count={2} className="h-64" />
      </div>
    </PageSkeleton>
  );
}
