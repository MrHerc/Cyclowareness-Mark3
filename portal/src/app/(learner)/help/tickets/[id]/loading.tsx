import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Ticket placeholder while the conversation loads: the back link stays, the header and the message thread are grey blocks. */
export default async function TicketLoading() {
  const tr = await getTranslations("learner.help");
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <BackLink href="/help">{tr("back")}</BackLink>
      <PageSkeleton action>
        <Skeleton className="h-96" />
      </PageSkeleton>
    </div>
  );
}
