import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Live sessions placeholder: header with the new-session action, the upcoming/past tabs and the session cards. */
export default function SessionsLoading() {
  return (
    <PageSkeleton icon action>
      <TabsSkeleton count={2} />
      <RowsSkeleton count={3} className="h-44" />
    </PageSkeleton>
  );
}
