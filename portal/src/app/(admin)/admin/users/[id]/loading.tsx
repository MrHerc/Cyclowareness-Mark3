import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Person page placeholder while the profile loads: the back link stays, the cards are grey blocks. */
export default async function PersonLoading() {
  const [tr, tc] = await Promise.all([getTranslations("admin.person"), getTranslations("common")]);
  return (
    <div className="grid gap-6">
      <Link href="/admin/users" className="inline-flex w-fit items-center gap-1 text-caption font-semibold text-brand-600 hover:text-brand-700">
        <ArrowLeft className="size-4" />
        {tr("back")}
      </Link>
      <div role="status" aria-busy="true" className="grid gap-6">
        <span className="sr-only">{tc("loading")}</span>
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}
