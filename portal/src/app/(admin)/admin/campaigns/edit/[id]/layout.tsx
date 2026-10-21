import { editableCampaignForPage } from "./campaign";

/** Runs the campaign's 404 and redirect checks above loading.tsx, so they decide the HTTP status before anything streams. */
export default async function EditCampaignLayout({ children, params }: LayoutProps<"/admin/campaigns/edit/[id]">) {
  await editableCampaignForPage((await params).id);
  return children;
}
