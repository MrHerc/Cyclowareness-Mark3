import { requirePermission } from "@/server/auth/viewer";

/** Runs the wizard's permission check above loading.tsx, so a role that may only read campaigns still answers HTTP 404 before anything streams. */
export default async function NewCampaignLayout({ children }: LayoutProps<"/admin/campaigns/new">) {
  await requirePermission("campaigns.write");
  return children;
}
