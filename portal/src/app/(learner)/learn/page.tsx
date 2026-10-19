import { getLocale, getTranslations } from "next-intl/server";
import { requireViewer } from "@/server/auth/viewer";
import { getCatalog, yourPath } from "@/server/queries/catalog";
import { CatalogView } from "./catalog-view";

export async function generateMetadata() {
  const t = await getTranslations("learner.learn");
  return { title: t("title") };
}

export default async function LearnPage() {
  const v = await requireViewer();
  const locale = await getLocale();
  const catalog = await getCatalog(v, locale);
  const pathOrder = new Map(yourPath(catalog).map((m, i) => [m.slug, i]));
  // "My path": For-you recommendations first, then modules in progress, then the rest (each in personal path order).
  const tier = (m: (typeof catalog)[number]) => (m.forYou && m.status === "not_started" ? 0 : m.status === "in_progress" || m.status === "awaiting_attestation" ? 1000 : 2000);
  return (
    <CatalogView
      modules={catalog.map((m) => ({
        slug: m.slug,
        category: m.category,
        audiences: m.audiences,
        title: m.title,
        subtitle: m.subtitle,
        minutes: m.minutes,
        lessons: m.lessons.length,
        xp: m.xp,
        percent: m.percent,
        status: m.status,
        forYou: m.forYou,
        pathRank: tier(m) + (pathOrder.get(m.slug) ?? 500),
        catalogRank: m.sortOrder,
        custom: m.origin !== "library",
      }))}
    />
  );
}
