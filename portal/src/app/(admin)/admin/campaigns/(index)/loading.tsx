import { PageSkeleton, RowsSkeleton, Skeleton, TabsSkeleton } from "@/components/ui/skeleton";

/**
 * Campaigns placeholder: header with the new-campaign action, the summary card, the status tabs and the
 * campaign rows. It lives in the (index) group so its Suspense boundary covers /admin/campaigns only: the wizard
 * (new, edit/[id]) and the detail page have their own, under the layouts that run their 404 checks.
 */
export default function CampaignsLoading() {
  return (
    <PageSkeleton action>
      <Skeleton className="h-44" />
      <TabsSkeleton count={5} />
      <RowsSkeleton count={4} className="h-28" />
    </PageSkeleton>
  );
}
