import { getTranslations } from "next-intl/server";
import { WizardPage } from "../../new/wizard-page";
import { editableCampaignForPage } from "./campaign";

export async function generateMetadata() {
  const tr = await getTranslations("admin.campaigns");
  return { title: tr("edit") };
}

/** A draft or scheduled campaign of this tenant reopened in the wizard; saving updates it. */
export default async function EditCampaignPage({ params }: PageProps<"/admin/campaigns/edit/[id]">) {
  const { v, c } = await editableCampaignForPage((await params).id);
  return <WizardPage v={v} campaign={c} />;
}
