import { PageSkeleton, RowsSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

/**
 * Policies placeholder: header with the new-policy action, the tabs and the policy rows. It lives in the
 * (index) group so its Suspense boundary covers /admin/policies only: above /admin/policies/[id] it would
 * stream before that page's notFound(), turning a missing policy into HTTP 200.
 */
export default function PoliciesLoading() {
  return (
    <PageSkeleton action>
      <TabsSkeleton count={2} />
      <RowsSkeleton count={4} />
    </PageSkeleton>
  );
}
