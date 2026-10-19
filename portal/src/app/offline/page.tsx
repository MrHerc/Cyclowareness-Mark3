import { getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { RetryButton } from "@/components/retry-button";

export async function generateMetadata() {
  const tr = await getTranslations("site.offline");
  return { title: tr("title") };
}

/** Shown by the service worker when a page is opened without a connection. */
export default async function OfflinePage() {
  const [tr, tc] = await Promise.all([getTranslations("site.offline"), getTranslations("common")]);
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <BrandMark />
        <span className="grid size-16 place-items-center rounded-full bg-sunken text-ink-muted">
          <WifiOff className="size-7" />
        </span>
        <h1 className="text-title font-bold">{tr("title")}</h1>
        <p className="text-body-sm text-ink-muted">{tr("body")}</p>
        <RetryButton label={tc("retry")} />
      </div>
    </main>
  );
}
