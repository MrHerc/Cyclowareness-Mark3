import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/ui/layout";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Sandbox analysis placeholder while it loads: the back link stays, the header and the verdict card are grey blocks. */
export default async function AnalysisLoading() {
  const tn = await getTranslations("admin.nav");
  return (
    <div className="grid gap-4">
      <BackLink href="/admin/sandbox">{tn("sandbox")}</BackLink>
      <PageSkeleton icon action>
        <Skeleton className="h-96" />
      </PageSkeleton>
    </div>
  );
}
