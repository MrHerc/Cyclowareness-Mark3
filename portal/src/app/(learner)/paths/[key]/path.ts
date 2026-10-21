import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireFeature } from "@/server/auth/viewer";
import { getPaths } from "@/server/queries/paths";

/**
 * The learning path a /paths/[key] page shows, or notFound() when the tenant lacks the feature or the viewer has no such path.
 * The layout runs it before loading.tsx streams the skeleton, so an unknown key answers HTTP 404 instead of a 200 that carries
 * the not-found UI; cache() lets generateMetadata and the page reuse the same lookup.
 */
export const pathForPage = cache(async (key: string) => {
  const v = await requireFeature("paths");
  const locale = await getLocale();
  const p = (await getPaths(v, locale)).find((x) => x.key === key);
  if (!p) notFound();
  return { v, locale, p };
});
