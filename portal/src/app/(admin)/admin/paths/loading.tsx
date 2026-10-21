import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Learning paths placeholder: header with the new-path action and the path cards. */
export default function PathsLoading() {
  return (
    <PageSkeleton icon action className="gap-6">
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    </PageSkeleton>
  );
}
