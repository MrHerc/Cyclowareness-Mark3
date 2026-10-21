import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { allowed, requireViewer } from "@/server/auth/viewer";
import { getCatalog } from "@/server/queries/catalog";

/**
 * The module a /learn/[slug] page shows, or notFound() when the viewer's catalog has no such module.
 * The layout runs it before loading.tsx streams the skeleton, so a missing module answers HTTP 404
 * instead of a 200 that carries the not-found UI; cache() lets the page reuse the same lookup.
 */
export const moduleForPage = cache(async (slug: string) => {
  const v = await requireViewer();
  const locale = await getLocale();
  const m = (await getCatalog(v, locale, allowed(v, "studio.write"))).find((x) => x.slug === slug);
  if (!m) notFound();
  return { v, locale, m };
});
