import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/**
 * Closed loops placeholder: header, the tabs and the loop cards with their stage track. It lives in the
 * (index) group so its Suspense boundary covers /admin/loops only: above /admin/loops/[id] it would stream
 * before that page's notFound(), turning a missing loop into HTTP 200.
 */
export default function LoopsLoading() {
  return (
    <PageSkeleton icon>
      <TabsSkeleton count={3} />
      <RowsSkeleton count={3} className="h-40" />
    </PageSkeleton>
  );
}
