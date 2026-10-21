import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/**
 * Support desk placeholder: header, the status tabs and the ticket rows. It lives in the (index) group so its
 * Suspense boundary covers /admin/support only: above /admin/support/[id] it would stream before that page's
 * notFound(), turning a missing ticket into HTTP 200.
 */
export default function SupportLoading() {
  return (
    <PageSkeleton icon>
      <TabsSkeleton count={4} />
      <RowsSkeleton count={5} />
    </PageSkeleton>
  );
}
