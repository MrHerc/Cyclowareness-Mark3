import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Sandbox placeholder: header, the submit panel and the recent-analyses card. It lives in the (index) group
 * so its Suspense boundary covers /admin/sandbox only: above /admin/sandbox/[id] it would stream before that
 * page's notFound(), turning a missing analysis into HTTP 200.
 */
export default function SandboxLoading() {
  return (
    <PageSkeleton icon>
      <Skeleton className="h-56" />
      <Skeleton className="h-96" />
    </PageSkeleton>
  );
}
