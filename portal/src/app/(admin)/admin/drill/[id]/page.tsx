import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Zap } from "lucide-react";
import { allowed, hasFeature, requirePermission } from "@/server/auth/viewer";
import { db } from "@/server/db";
import { isUuid } from "@/lib/ids";
import { advanceDrill, drillById, drillView } from "@/server/services/drill";
import { PageHeader } from "@/components/ui/layout";
import { LiveDrill } from "@/components/admin/drill/live-drill";

export async function generateMetadata() {
  const tr = await getTranslations("admin.nav");
  return { title: tr("drill") };
}

export default async function DrillPage({ params }: PageProps<"/admin/drill/[id]">) {
  const v = await requirePermission("campaigns.write");
  if (!hasFeature(v, "live_drill")) notFound();
  const { id } = await params;
  if (!isUuid(id) || !(await drillById(db(), v.tenant.id, id))) notFound();
  const [tr, locale] = await Promise.all([getTranslations("admin.drill"), getLocale()]);
  // Catch up on anything that fell due while nobody was watching, then draw the current state.
  const run = await advanceDrill(db(), v.tenant.id, id);
  const view = run ? await drillView(db(), run, locale) : null;
  if (!view) notFound();
  return (
    <div className="grid gap-2">
      <PageHeader title={view.template.name} subtitle={tr("subtitle")} icon={<Zap />} back={{ href: "/admin/drill", label: tr("back") }} />
      <LiveDrill initial={view} canLeadership={allowed(v, "leadership.read")} />
    </div>
  );
}
