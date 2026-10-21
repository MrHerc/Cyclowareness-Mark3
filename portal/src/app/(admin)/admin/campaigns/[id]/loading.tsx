import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Campaign placeholder while the results load: the back link stays, the header, funnel, details and recipients are grey blocks. */
export default async function CampaignLoading() {
  const tr = await getTranslations("admin.campaigns");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/campaigns">{tr("allCampaigns")}</BackLink>
      <PageSkeleton action>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <div className="grid content-start gap-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-32" />
          </div>
        </div>
        <Skeleton className="h-96" />
      </PageSkeleton>
    </div>
  );
}
