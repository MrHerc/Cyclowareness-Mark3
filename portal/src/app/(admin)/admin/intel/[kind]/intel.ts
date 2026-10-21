import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { hasFeature, requirePermission } from "@/server/auth/viewer";

const FEATURE = { threat: "threat_intel", policy: "policy_intel" } as const;

/**
 * The intel feed a /admin/intel/[kind] page shows, or notFound() for a role without intel.read, an unknown kind or a plan
 * without that feed. The layout runs it before loading.tsx streams the skeleton, so those cases answer HTTP 404 instead of
 * a 200 that carries the not-found UI; cache() lets the page reuse the same check within the request.
 */
export const intelForPage = cache(async (param: string) => {
  const v = await requirePermission("intel.read");
  const kind: keyof typeof FEATURE = param === "threat" || param === "policy" ? param : notFound();
  if (!hasFeature(v, FEATURE[kind])) notFound();
  return { v, kind };
});
