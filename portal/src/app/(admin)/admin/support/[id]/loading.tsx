import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Ticket placeholder while it loads: the back link stays, the header, the message thread and the requester card are grey blocks. */
export default async function TicketLoading() {
  const tr = await getTranslations("secops.support");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/support">{tr("back")}</BackLink>
      <PageSkeleton icon action>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-48" />
        </div>
      </PageSkeleton>
    </div>
  );
}
