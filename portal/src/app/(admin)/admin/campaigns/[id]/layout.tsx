import { campaignForPage } from "./campaign";

/** Runs the campaign's 404 checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function CampaignLayout({ children, params }: LayoutProps<"/admin/campaigns/[id]">) {
  await campaignForPage((await params).id);
  return children;
}
