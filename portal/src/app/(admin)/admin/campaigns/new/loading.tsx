import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Wizard placeholder while the departments and their head counts load: the back link stays, the step card is a grey block. */
export default async function NewCampaignLoading() {
  const tr = await getTranslations("admin.campaigns");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/campaigns">{tr("allCampaigns")}</BackLink>
      <PageSkeleton>
        <Skeleton className="h-[28rem]" />
      </PageSkeleton>
    </div>
  );
}
