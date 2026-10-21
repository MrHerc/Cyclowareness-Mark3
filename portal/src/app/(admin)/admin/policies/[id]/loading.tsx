import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton, TabsSkeleton } from "@/components/ui/skeleton";

/** Policy placeholder while it loads: the back link stays, the header, the versions/sign-offs tabs and the two columns are grey blocks. */
export default async function PolicyLoading() {
  const tr = await getTranslations("admin.policies");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/policies">{tr("allPolicies")}</BackLink>
      <PageSkeleton action>
        <TabsSkeleton count={2} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      </PageSkeleton>
    </div>
  );
}
