import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { BrandMark } from "@/components/brand";

export default async function NotFound() {
  const tc = await getTranslations("common");
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <BrandMark />
        <span className="grid size-16 place-items-center rounded-full bg-sunken text-ink-muted">
          <Compass className="size-7" />
        </span>
        <h1 className="text-title font-bold">{tc("errors.notFoundTitle")}</h1>
        <p className="text-body-sm text-ink-muted">{tc("errors.notFoundBody")}</p>
        <Link href="/" className="inline-flex h-11 items-center rounded-pill bg-brand-600 px-6 font-semibold text-brand-on hover:bg-brand-700">
          {tc("errors.goHome")}
        </Link>
      </div>
    </main>
  );
}
