import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { trackingView } from "@/server/tracking";
import { TeachableMoment } from "@/components/site/teachable";
import { TeachableLocale } from "@/components/site/teachable-locale";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/** QR trap landing (training QR codes in simulations). */
export default async function TrackedQr({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  const view = await trackingView(token, "qr");
  if (!view) {
    const t = await getTranslations("site.teach");
    return <p className="grid min-h-dvh place-items-center text-body text-ink-muted">{t("expired")}</p>;
  }
  return (
    <TeachableLocale view={view}>
      <TeachableMoment token={token} org={view.org} flags={view.flags} moduleSlug={view.moduleSlug} harvest={view.harvest} alreadySubmitted={view.submitted} brandName={view.brandName} qr />
    </TeachableLocale>
  );
}
