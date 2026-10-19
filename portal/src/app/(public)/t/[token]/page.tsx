import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { trackingView } from "@/server/tracking";
import { TeachableMoment } from "@/components/site/teachable";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Simulation link landing: records the click (people only, not mail scanners) and teaches. */
export default async function TrackedLink({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const view = await trackingView(token, "link");
  if (!view) {
    const t = await getTranslations("site.teach");
    return <p className="grid min-h-dvh place-items-center text-body text-ink-muted">{t("expired")}</p>;
  }
  return <TeachableMoment token={token} org={view.org} flags={view.flags} moduleSlug={view.moduleSlug} harvest={view.harvest} alreadySubmitted={view.submitted} brandName={view.brandName} qr={false} />;
}
