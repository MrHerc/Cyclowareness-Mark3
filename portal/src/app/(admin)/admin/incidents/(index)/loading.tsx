import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/**
 * Incidents placeholder: header with the new-incident action, the status tabs and the incident rows. It lives
 * in the (index) group so its Suspense boundary covers /admin/incidents only: above /admin/incidents/[id] it
 * would stream before that page's notFound(), turning a missing incident into HTTP 200.
 */
export default function IncidentsLoading() {
  return (
    <PageSkeleton icon action>
      <TabsSkeleton count={4} />
      <RowsSkeleton count={4} className="h-24" />
    </PageSkeleton>
  );
}
