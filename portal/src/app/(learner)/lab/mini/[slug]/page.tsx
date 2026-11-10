import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { privileged, requireFeature } from "@/server/auth/viewer";
import { getCatalog } from "@/server/queries/catalog";
import { labScenario } from "@/server/lab/scenarios";
import { MiniLab } from "@/components/lab/labs/mini-lab";
import { PageHeader } from "@/components/ui/layout";
import { dayKey } from "@/lib/domain/gamification";
import { langAttrs } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/lab/mini/[slug]">) {
  const found = labScenario((await params).slug, await getLocale());
  return { title: found?.scenario.title };
}

/** A module's mini-lab, for a module in the viewer's catalog; the module page links here once its lessons are done. */
export default async function MiniLabPage({ params }: PageProps<"/lab/mini/[slug]">) {
  const { slug } = await params;
  const [v, locale] = await Promise.all([requireFeature("lab"), getLocale()]);
  const found = labScenario(slug, locale);
  const m = found && (await getCatalog(v, locale, privileged(v, "studio.write"))).find((x) => x.slug === slug);
  if (!found || !m) notFound();
  return (
    <div className="grid gap-2">
      <PageHeader title={<span {...langAttrs(found.lang)}>{found.scenario.title}</span>} subtitle={<span {...langAttrs(found.lang)}>{found.scenario.intro}</span>} back={{ href: `/learn/${slug}`, label: m.title }} className="sm:mb-6" />
      <MiniLab scenario={found.scenario} lang={found.lang} today={dayKey(new Date(), v.tenant.settings.timeZone)} back={{ href: `/learn/${slug}`, label: m.title }} />
    </div>
  );
}
