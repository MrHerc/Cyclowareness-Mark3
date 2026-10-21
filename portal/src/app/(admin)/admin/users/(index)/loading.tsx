import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * People placeholder: header with its actions, the filter bar and the people table. It lives in the (index)
 * group so its Suspense boundary covers /admin/users only, not /admin/users/[id] (which has its own).
 */
export default function PeopleLoading() {
  return (
    <PageSkeleton action>
      <Skeleton className="h-11 rounded-pill" />
      <Skeleton className="h-[28rem]" />
    </PageSkeleton>
  );
}
