import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/viewer";
import { campaignForPage } from "../../[id]/campaign";

/**
 * The campaign the wizard reopens, or notFound() for a role that may not edit campaigns, a junk id or a campaign of another
 * tenant; one that has already launched goes back to its results. The layout runs it before loading.tsx streams the skeleton,
 * so those cases answer HTTP 404 or a real redirect; cache() lets the page reuse the same lookup within the request.
 */
export const editableCampaignForPage = cache(async (id: string) => {
  await requirePermission("campaigns.write");
  const { v, c } = await campaignForPage(id);
  // A teachable-moment re-simulation is not edited either (saveCampaignAction refuses it).
  if ((c.status !== "draft" && c.status !== "scheduled") || c.audience === "person") redirect(`/admin/campaigns/${c.id}`);
  return { v, c };
});
