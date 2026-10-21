import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/server/auth/viewer";
import { WizardPage } from "./wizard-page";

export async function generateMetadata() {
  const tr = await getTranslations("admin.campaigns");
  return { title: tr("new") };
}

/** A new campaign; a draft or scheduled one is reopened at /admin/campaigns/edit/[id]. */
export default async function NewCampaignPage() {
  const v = await requirePermission("campaigns.write");
  return <WizardPage v={v} campaign={null} />;
}
