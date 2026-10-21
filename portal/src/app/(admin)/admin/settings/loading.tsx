import { PageSkeleton, Skeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Settings placeholder: header, the section tabs and the open section's form card. */
export default function SettingsLoading() {
  return (
    <PageSkeleton>
      <TabsSkeleton count={7} />
      <Skeleton className="h-[30rem]" />
    </PageSkeleton>
  );
}
