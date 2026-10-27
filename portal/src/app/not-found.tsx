import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { getSession } from "@/server/auth/viewer";

export async function generateMetadata() {
  const tc = await getTranslations("common");
  return { title: tc("errors.notFoundTitle") };
}

export default async function NotFound() {
  const tc = await getTranslations("common");
  // One 404 for the whole site: signed-in people go back to the app, visitors to the public site.
  // A database outage must not turn a 404 into an error page (as in i18n/request.ts).
  const signedIn = !!(await getSession().catch(() => null));
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="grid max-w-sm justify-items-center gap-4">
        <BrandMark />
        <span className="grid size-16 place-items-center rounded-full bg-sunken text-ink-muted">
          <Compass className="size-7" />
        </span>
        <h1 className="text-title font-bold">{tc("errors.notFoundTitle")}</h1>
        <p className="text-body-sm text-ink-muted">{tc("errors.notFoundBody")}</p>
        <Link href={signedIn ? "/app" : "/"} className="inline-flex h-11 items-center rounded-pill bg-brand-600 px-6 font-semibold text-brand-on hover:bg-brand-700">
          {tc("errors.goHome")}
        </Link>
      </div>
    </main>
  );
}
